'use strict';

/**
 * craftDesigner — 人物工艺设计器（离线补设计，LLM 生成/补全）
 *
 * 解决：设计期 charisma/philosophy/quoteLibrary/highlightScenes 普遍为空 →
 *   写作端没有"高光/名言/魅力"可依据 → 正文只能写流水账，编年史也抽不出东西。
 * 做法：对工艺不达标的角色做**一次批量 LLM 调用**，产出符合 craftQualitySpec 判定的工艺，
 *   写入 entities（单一源），并逐个过 validateQuotes/validateHighlights/validateCatchphrases 闸门。
 * 依据：docs/design/角色编年史升级-多维分层与素材质检.md §十 / §四（离线设计器）
 */
const store = require('../store');
const llm = require('./llm');
const logger = require('../shared/logger');
const entityCenter = require('./entityCenter');
const { extractJSON } = require('./jsonUtils');
const { buildCraftGuidance } = require('./craftQualitySpec');
const namingSpec = require('./namingQualitySpec');
const { validateQuotes, quoteKey } = require('./validateQuotes');
const { validateHighlights, highlightKey } = require('./validateHighlights');
const { validateCatchphrases, catchphraseKey } = require('./validateCatchphrases');

const DESIGN_ROLE_LEVELS = ['protagonist', 'key-supporting', 'supporting'];
const MAX_TARGETS = 6;

/** 工艺是否达标（纯函数）：文本字段非空，台词/高光/口头禅有合格项 */
function needsCraft(entity) {
    const missing = [];
    if (!String(entity.charisma || '').trim()) missing.push('人格魅力');
    if (!String(entity.philosophy || '').trim()) missing.push('哲学观');
    if (!String(entity.entranceDesign || '').trim()) missing.push('出场设计');
    if (validateQuotes(entity.quoteLibrary || []).passed === 0) missing.push('金句库');
    if (validateHighlights(entity.highlightScenes || []).passed === 0) missing.push('高光场景');
    if (validateCatchphrases(entity.catchphrases || []).passed === 0) missing.push('口头禅');
    return missing;
}

function selectCraftTargets(entities, limit) {
    const max = Number(limit) || MAX_TARGETS;
    return (entities || [])
        .filter((e) => DESIGN_ROLE_LEVELS.indexOf(e.roleLevel) >= 0)
        .map((e) => ({ entity: e, missing: needsCraft(e) }))
        .filter((t) => t.missing.length > 0)
        .slice(0, max);
}

function _parseItems(raw) {
    if (!raw) return [];
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fenced ? fenced[1] : raw;
    const arr = body.match(/\[[\s\S]*\]/);
    if (arr) { try { const p = JSON.parse(arr[0]); if (Array.isArray(p)) return p; } catch (_) { /* fallthrough */ } }
    const parsed = extractJSON(body);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
        const keys = ['characters', 'items', 'data', 'result'];
        for (let i = 0; i < keys.length; i++) if (Array.isArray(parsed[keys[i]])) return parsed[keys[i]];
        if (parsed.name) return [parsed];
    }
    return [];
}

function _jsonSchemaHint() {
    return '输出 JSON 数组，每项：'
        + '{"name":"角色名","charisma":"当【处境】时，他宁可【做X】，也不【做Y】",'
        + '"philosophy":"核心信念与价值观","entranceDesign":"首次出场方式+标志性场景",'
        + '"quoteLibrary":[{"scene":"处境","quote":"金句原文","why":"它暴露了他的哪条信念/哪段代价"}],'
        + '"highlightScenes":[{"scene":"处境","what":"他的选择（含动作或台词原文）","cost":"代价","why":"为什么只有他会这样"}],'
        + '"catchphrases":[{"text":"口头禅原文","trigger":"什么场合说","why":"辨识度"}]}';
}

function _buildMessages(targets, ctx) {
    const system = [
        '你是小说人物工艺设计器。给每个角色补齐"人格魅力/哲学观/出场设计/金句库/高光场景/口头禅"。',
        _jsonSchemaHint(),
        '硬性要求：',
        '1. 必须紧扣该角色既有设定（身份/性格/欲望/恐惧/伤口），不得改名、不得改人设',
        '2. 金句必须有处境与记忆点；高光必须含代价；口头禅要能反复出现',
        '3. 一律禁评论腔（展现/体现/立住…）、禁过场句（上车。/进去了。）、禁现代网络梗',
        '4. 只输出 JSON，不要解释、不要 Markdown 代码块',
    ].join('\n');
    const body = targets.map((t) => {
        const e = t.entity;
        return [
            '### 角色：' + e.name + '（' + e.roleLevel + '）',
            '缺失工艺：' + t.missing.join('/'),
            e.personality ? '性格：' + e.personality : '',
            e.position ? '身份：' + e.position : '',
            e.profile && e.profile.desire ? '核心欲望：' + e.profile.desire : '',
            e.profile && e.profile.fear ? '核心恐惧：' + e.profile.fear : '',
            e.profile && e.profile.trauma ? '核心创伤：' + e.profile.trauma : '',
            (e.briefText || e.detailText) ? '既有设定：' + String(e.briefText || e.detailText).slice(0, 600) : '',
        ].filter(Boolean).join('\n');
    }).join('\n\n');
    const user = buildCraftGuidance() + '\n\n' + namingSpec.buildNamingGuidance(ctx.eraKey) + '\n\n'
        + '请为以下 ' + targets.length + ' 个角色补齐工艺（名字已定，不要改名）：\n\n' + body;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

function _text(v) { return String(v == null ? '' : v).trim(); }

/** 单角色补丁（纯函数）：只填空缺项，数组按 key 合并去重，不做删除 */
function buildCraftPatchFromItem(entity, item) {
    const patch = {};
    if (_text(item.charisma) && !_text(entity.charisma)) patch.charisma = _text(item.charisma);
    if (_text(item.philosophy) && !_text(entity.philosophy)) patch.philosophy = _text(item.philosophy);
    if (_text(item.entranceDesign) && !_text(entity.entranceDesign)) patch.entranceDesign = _text(item.entranceDesign);
    const q = validateQuotes(item.quoteLibrary);
    if (q.passed > 0) patch.quoteLibrary = _mergeUnique(entity.quoteLibrary, q.items, quoteKey);
    const h = validateHighlights(item.highlightScenes);
    if (h.passed > 0) patch.highlightScenes = _mergeUnique(entity.highlightScenes, h.items, highlightKey);
    const c = validateCatchphrases(item.catchphrases);
    if (c.passed > 0) patch.catchphrases = _mergeUnique(entity.catchphrases, c.items, catchphraseKey);
    return patch;
}

function _mergeUnique(existing, incoming, keyOf) {
    const out = Array.isArray(existing) ? existing.slice() : [];
    const seen = new Set(out.map(keyOf));
    for (let i = 0; i < incoming.length; i++) {
        const k = keyOf(incoming[i]);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push(incoming[i]);
    }
    return out;
}

/**
 * 设计/补全人物工艺
 * @param {string} projectId
 * @param {object} options { apply=false, apiConfig, maxItems }
 * @returns {Promise<{checked:number,targets:number,applied:number,proposals:Array}>}
 */
async function designCharacterCraft(projectId, options) {
    const opts = options || {};
    const stats = { checked: 0, targets: 0, applied: 0, proposals: [] };
    const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
    stats.checked = entities.length;
    const targets = selectCraftTargets(entities, opts.maxItems);
    stats.targets = targets.length;
    if (targets.length === 0) return stats;

    const project = await store.getItem('projects', projectId);
    const ctx = { eraKey: namingSpec.inferEraKey((project && project.genre) || '') };
    logger.info('craftDesigner', '补设计目标: ' + targets.map((t) => t.entity.name + '(' + t.missing.join('/') + ')').join(', '));

    const result = await llm.chat(_buildMessages(targets, ctx), {
        maxTokens: 8192, temperature: 0.7, enableThinking: false, apiConfig: opts.apiConfig, usageStep: 'craft-designer',
    });
    const raw = (result && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) || '';
    const items = _parseItems(raw);
    if (items.length === 0) {
        logger.warn('craftDesigner', '响应无法解析，前200字: ' + raw.slice(0, 200));
        return stats;
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || !item.name) continue;
        const target = targets.find((t) => t.entity.name === item.name);
        if (!target) continue;
        const patch = buildCraftPatchFromItem(target.entity, item);
        if (Object.keys(patch).length === 0) continue;
        stats.proposals.push({ name: item.name, fields: Object.keys(patch) });
        if (!opts.apply) continue;
        await entityCenter.updateEntity(target.entity.id, patch);
        stats.applied++;
    }
    logger.info('craftDesigner', '补设计完成: 候选 ' + stats.proposals.length + ', 写入 ' + stats.applied + '（apply=' + !!opts.apply + '）');
    return stats;
}

module.exports = { designCharacterCraft, needsCraft, selectCraftTargets, buildCraftPatchFromItem, DESIGN_ROLE_LEVELS, MAX_TARGETS };
