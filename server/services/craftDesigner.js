'use strict';

/**
 * craftDesigner — 人物工艺设计器（离线补设计，LLM 生成/补全）
 *
 * 解决：设计期 charisma/philosophy/quoteLibrary/highlightScenes/catchphrases 为空或写成
 *   第三人称功能说明 → 写作端没有"高光/名言/魅力"可依据 → 正文只能写流水账，编年史也抽不出东西。
 * 做法：对工艺不达标的角色做**一次批量 LLM 调用**，产出符合 craftQualitySpec 判定的工艺，
 *   写入 entities（单一源）；判定/筛选/合并的纯逻辑在 craftTargets，
 *   产出逐个过 validateQuotes/validateHighlights/validateCatchphrases 闸门才落库。
 * 依据：docs/design/角色编年史升级-多维分层与素材质检.md §十 / §十一
 */
const store = require('../store');
const llm = require('./llm');
const logger = require('../shared/logger');
const entityCenter = require('./entityCenter');
const { extractJSON } = require('./jsonUtils');
const { buildCraftGuidance } = require('./craftQualitySpec');
const namingSpec = require('./namingQualitySpec');
const craftTargets = require('./craftTargets');

const { needsCraft, selectCraftTargets, buildCraftPatchFromItem, findTarget, MAX_TARGETS } = craftTargets;

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
        + '{"name":"角色名","charisma":"当【具体处境】时，他宁可【做X】，也不【做Y】",'
        + '"philosophy":"核心信念与价值观","entranceDesign":"首次出场方式+标志性场景",'
        + '"quoteLibrary":[{"scene":"<具体处境，写实不要照抄占位>","quote":"金句原文","why":"它暴露了他的哪条信念/哪段代价"}],'
        + '"highlightScenes":[{"scene":"<具体处境>","what":"他的选择（含动作或台词原文）","cost":"代价","why":"为什么只有他会这样"}],'
        + '"catchphrases":[{"text":"口头禅原文","trigger":"什么场合说","why":"辨识度"}]}';
}

function _buildMessages(targets, ctx) {
    const system = [
        '你是小说人物工艺设计器。给每个角色补齐"人格魅力/哲学观/出场设计/金句库/高光场景/口头禅"。',
        _jsonSchemaHint(),
        '硬性要求：',
        '1. 必须紧扣该角色既有设定（身份/性格/欲望/恐惧/伤口），不得改名、不得改人设',
        '2. 人格魅力必须写成"当【处境】时，他宁可【做X】，也不【做Y】"；禁止第三人称功能说明（"展现了…""他是主角的锚点…"）',
        '3. 金句必须有处境与记忆点；高光必须含代价；口头禅要能反复出现',
        '3b. 【硬性】quoteLibrary 每项必须含 scene/quote/why 三字段；缺 why（记忆点）该项一律作废丢弃——' +
            'why 要写"这句话暴露了他的哪条信念/哪段代价"，不要写"记忆点：强调…"这类空评。',
        '3b-1. 【硬性】scene 必须写**具体处境**（如"对账时发现有人做假账"），' +
            '禁止空壳词：处境/通用场景/场景/情境；quote 只能是原话本身，禁止把处境写进 quote（不要"面对X：“…”"）。',
        '3c. highlightScenes 每项必须含 scene/what/cost/why；缺 cost 作废；' +
            'what 必须是"那一个选择/动作或台词原文"，禁止事件复述（不要"并给出方案""随后…""最终决定…"）。',
        '4. 一律禁评论腔（展现/体现/立住…）、禁过场句（上车。/进去了。）、禁现代网络梗',
        '5. 只输出 JSON，不要解释、不要 Markdown 代码块',
    ].join('\n');
    const body = targets.map((t) => {
        const e = t.entity;
        return [
            '### 角色：' + e.name + '（' + e.roleLevel + '）',
            '缺失/不达标：' + t.missing.join('/'),
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

/**
 * 设计/补全人物工艺
 * @param {string} projectId
 * @param {object} options { apply=false, apiConfig, maxItems, debug }
 * @returns {Promise<{checked:number,targets:number,applied:number,proposals:Array}>}
 */
async function designCharacterCraft(projectId, options) {
    const opts = options || {};
    const stats = { checked: 0, targets: 0, applied: 0, proposals: [], unresolved: [] };
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
        const target = findTarget(targets, item.name);
        if (!target) continue;
        const patch = buildCraftPatchFromItem(target.entity, item);
        if (Object.keys(patch).length === 0) {
            // 回包该角色一个字段都没过闸（如金句缺 why）——此前静默跳过，缺口永不被发现
            stats.unresolved.push({ name: item.name, stillMissing: target.missing, note: '回包未过闸门（如金句缺 why/高光缺 cost）' });
            continue;
        }
        const entry = { name: item.name, fields: Object.keys(patch) };
        if (opts.debug) entry.patch = patch;
        stats.proposals.push(entry);
        if (!opts.apply) continue;
        const updated = await entityCenter.updateEntity(target.entity.id, patch);
        stats.applied++;
        // 应用后复检：印证"写入成功"不等于"缺口已补"（缺 why 的金句会被 validateQuotes 丢弃）
        const remaining = needsCraft(updated || { ...target.entity, ...patch });
        if (remaining.length > 0) stats.unresolved.push({ name: item.name, stillMissing: remaining });
    }
    logger.info('craftDesigner', '补设计完成: 候选 ' + stats.proposals.length + ', 写入 ' + stats.applied + '（apply=' + !!opts.apply + '）');
    if (stats.unresolved.length > 0) {
        logger.warn('craftDesigner', '补设计后仍有缺口（未静默）: ' + stats.unresolved.map((u) => u.name + '(' + u.stillMissing.join('/') + (u.note ? '·' + u.note : '') + ')').join(', '));
    }
    return stats;
}

module.exports = {
    designCharacterCraft,
    needsCraft, selectCraftTargets, buildCraftPatchFromItem, findTarget,
    MAX_TARGETS, DESIGN_ROLE_LEVELS: craftTargets.DESIGN_ROLE_LEVELS,
};
