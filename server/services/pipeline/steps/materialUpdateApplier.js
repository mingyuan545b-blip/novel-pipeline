/**
 * materialUpdateApplier — 素材更新落地 + L1 失败判定（T1）
 *
 * 为什么要有它（缺陷：静默丢素材）：
 *   原 handleMaterialManager 在 "JSON 解析失败 → markdown 兜底也失败" 后只 logger.warn，
 *   appliedUpdates=[] 继续往下跑，最终章节仍被标 material-updated。
 *   → _runMaterialManager 只对**异常**重试（pipelinePostApproval.js），从不触发；
 *   → materialGate 看到 status=material-updated 判定"已归档"，下一章照常开工；
 *   → 本章素材变更**永久丢失且无人知晓**。
 *
 * 本模块把"到底成没成功"变成可判定的事实：
 *   ok=false → 调用方必须显式失败（打 materialManagerFailed + 抛错交给重试/门槛兜底）。
 *
 * 三条策略（优先级从高到低）：
 *   1. json     ：JSON 解析成功（**含合法的空 updates 数组**）→ processUpdates 落库
 *   2. markdown ：JSON 失败 → markdown 抽取（内部已落库，返回空数组=没抽到）
 *   3. none     ：两条都失败 → ok=false
 */
const logger = require('../../../shared/logger');
const { parseMaterialManagerOutputDetailed } = require('./materialJsonParser');
const { extractFromMarkdown } = require('./materialMarkdownExtractor');
const { processUpdates } = require('./materialUpdateProcessor');
const { validateMaterialUpdates } = require('./materialOutputSchema');

const STRATEGY = Object.freeze({ JSON: 'json', MARKDOWN: 'markdown', NONE: 'none' });
/** 输出不可解析（调用方据此重试 / 打缺口标记）；刻意用独立 errorCode 便于日志检索 */
const UNPARSABLE_CODE = 'MATERIAL_MANAGER_OUTPUT_UNPARSABLE';

function buildUnparsableError(detail) {
    const err = new Error(`素材管理员输出无法解析（JSON 与 Markdown 兜底均失败）: ${detail}`);
    err.code = UNPARSABLE_CODE;
    err.isMaterialOutputUnparsable = true;
    return err;
}

/**
 * 落地 material-manager 输出，并给出**可判定**的成功/失败事实。
 * @returns {Promise<{ok:boolean, strategy:string, updates:Array, error:string|null}>}
 */
async function applyUpdatesWithFallback(params) {
    const { response, chapter, projectId, materials, styleProfile, repairFn } = params;
    const raw = response || '';
    const detailed = parseMaterialManagerOutputDetailed(raw);

    if (detailed.ok) {
        // T3：结构校验 + 定向修复（合规条目直通，不重复消耗 token）
        const checked = await _validateAndRepair(detailed.updates, repairFn);
        if (!checked.ok) {
            logger.error('materialApplier', `ch${chapter?.chapterNumber} 素材指令全部不合规，丢弃 ${checked.stats.dropped} 条`);
            return { ok: false, strategy: STRATEGY.NONE, updates: [], error: checked.error, stats: checked.stats };
        }
        try {
            const applied = await processUpdates(checked.updates, chapter, projectId, materials, styleProfile);
            return { ok: true, strategy: STRATEGY.JSON, updates: applied, error: null, stats: checked.stats };
        } catch (e) {
            logger.warn('materialApplier', `JSON 解析成功但落库失败，转 markdown 兜底: ${e.message}`);
            return _fallbackMarkdown(params, e.message);
        }
    }

    logger.info('materialApplier', `JSON 解析失败(${detailed.reason})，转 markdown 兜底 ch${chapter?.chapterNumber}`);
    return _fallbackMarkdown(params, detailed.reason);
}

/**
 * 校验 → 定向修复 → 再校验。
 * 硬规则：模型给了条目却**一条都落不下来** ⇒ ok=false（交给 T1 的失败链路，不静默）。
 */
async function _validateAndRepair(updates, repairFn) {
    const total = updates.length;
    const first = validateMaterialUpdates(updates);
    const emptyStats = { total, valid: 0, invalid: 0, repaired: 0, rejectedExtra: 0, dropped: 0, errors: [] };
    if (total === 0) return { ok: true, updates: [], stats: emptyStats };
    if (first.ok) return { ok: true, updates, stats: { ...emptyStats, valid: total } };

    logger.warn('materialApplier', `素材指令结构校验: ${first.valid.length} 合规 / ${first.invalid.length} 不合规，尝试定向修复`);
    const repaired = typeof repairFn === 'function'
        ? ((await repairFn(first.invalid, first.errors))?.repaired || [])
        : [];

    // 硬规则：修复只能**改违规条目本身**（按 name 绑定），不得借修复之名注入新素材
    // ——否则"每章最多3个新素材""归属必填"等约束会被修复通道整个绕过。
    const invalidNames = new Set(first.invalid.map(i => i.update?.name).filter(Boolean));
    const accepted = repaired.filter(u => u?.name && invalidNames.has(u.name));
    const rejectedExtra = repaired.length - accepted.length;

    // 防重复：合规条目若被回喂，按 (type,name) 去重（否则同一素材落库两次）
    const seen = new Set();
    const final = [];
    for (const u of [...first.valid, ...accepted]) {
        const key = `${u?.type || ''}::${u?.name || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        final.push(u);
    }

    const stats = {
        total, valid: final.length, invalid: first.invalid.length,
        repaired: accepted.length, rejectedExtra, dropped: total - final.length,
        errors: first.errors.map(e => e.code),
    };
    if (rejectedExtra > 0) {
        logger.warn('materialApplier', `修复响应中有 ${rejectedExtra} 条与违规条目对不上（疑似越权新增），已拒绝`);
    }
    if (final.length === 0) {
        return { ok: false, updates: [], stats, error: `素材指令全部不合规且修复失败（${first.errors.map(e => e.message).join('; ')}）` };
    }
    if (stats.dropped > 0) {
        logger.warn('materialApplier', `仍有 ${stats.dropped} 条未能落库（已计入 stats.dropped，非静默）`);
    }
    return { ok: true, updates: final, stats };
}

async function _fallbackMarkdown(params, reason) {
    const { response, chapter, projectId, materials, styleProfile } = params;
    try {
        const applied = await extractFromMarkdown(response || '', chapter, projectId, materials, styleProfile);
        if (Array.isArray(applied) && applied.length > 0) {
            return { ok: true, strategy: STRATEGY.MARKDOWN, updates: applied, error: null, stats: null };
        }
        return {
            ok: false, strategy: STRATEGY.NONE, updates: [], error: `${reason}; markdown 未抽到任何素材`, stats: null
        };
    } catch (mdErr) {
        return {
            ok: false, strategy: STRATEGY.NONE, updates: [], error: `${reason}; markdown 抛错: ${mdErr.message}`, stats: null
        };
    }
}

module.exports = { applyUpdatesWithFallback, buildUnparsableError, STRATEGY, UNPARSABLE_CODE };
