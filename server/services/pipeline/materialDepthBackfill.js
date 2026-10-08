'use strict';

/**
 * materialDepthBackfill — 深度键的多来源**确定性**回填（T6）
 *
 * 问题（线上实测）：7 份契约都要求角色 stateJson 含任一深度键
 * （innerConflict / independentStance / fateArc / protagonistMirror），
 * 但深度键的**唯一生产者**是 material-organizer 的自由文本 Note 字段，
 * 而 prompt 里写的是"（如有）"= 可选 → 实测 40 个角色实体里只有 1 个有深度键
 * → 契约断链、writer 拿不到角色深度 → 工具人化。
 *
 * 本模块把"只有模型自由文本能产"改成**多来源确定性派生**（全部是真实数据，绝不用模型/绝不臆造）：
 *   1. 实体中心 / KV 已有字段（优先级最高，不改）
 *   2. 素材正文里的【标签】值（如「【内在矛盾】想活命又怕连累同伴」）—— 别名表来自 fieldRegistry
 *   3. 编年史（character_chronicle）当章的 innerConflict / stance
 *
 * 硬规则：
 *   · **只填补缺失键，绝不覆盖已有值**（覆盖 = 把人设冲掉，是历史 P0）
 *   · **没有真实来源就不产生键**（宁可空，也不编一句假的内在矛盾）
 */
const { FIELD_MAPPINGS } = require('../../config/fieldRegistry');
const { CHARACTER_DEPTH_KEYS } = require('./contracts/_registry');

/** 深度键 → 素材正文里可能出现的中文标签（由 fieldRegistry 的落点映射派生，避免第二份清单） */
const DEPTH_LABEL_ALIASES = Object.freeze({
    innerConflict: ['内在矛盾', '内心矛盾', '核心矛盾', '内心挣扎'],
    independentStance: ['独立立场', '自主立场'],
    fateArc: ['成长弧光', '命运弧光', '角色弧光', '成长轨迹'],
    protagonistMirror: ['主角镜像', '镜像对比', '与主角对照'],
});

/** 由 fieldRegistry 反查"某标签落在哪个 stateJsonKey"（单一源；标签改了这里自动跟随） */
function stateKeyOfLabel(label) {
    const m = FIELD_MAPPINGS[label];
    return m ? m.stateJsonKey : null;
}

/**
 * 从素材正文抽取【标签】值。
 * @returns {Object<string,string>} 标签 → 值
 */
function extractTaggedFields(content) {
    const out = {};
    if (typeof content !== 'string' || !content) return out;
    const re = /【([^】]{1,12})】\s*([^\n【]*)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        const label = m[1].trim();
        const value = m[2].trim();
        if (!label || !value) continue;
        if (!out[label]) out[label] = value;
    }
    return out;
}

/** 从素材正文按别名表提取深度键 */
function deriveDepthFromContent(content) {
    const tags = extractTaggedFields(content);
    const out = {};
    for (const [key, aliases] of Object.entries(DEPTH_LABEL_ALIASES)) {
        for (const label of aliases) {
            if (tags[label]) { out[key] = tags[label]; break; }
        }
    }
    // 兜底：正文里出现任何 fieldRegistry 登记且映射到深度键的标签
    for (const [label, value] of Object.entries(tags)) {
        const stateKey = stateKeyOfLabel(label);
        if (stateKey && CHARACTER_DEPTH_KEYS.includes(stateKey) && !out[stateKey]) out[stateKey] = value;
    }
    return out;
}

/** 占位/垃圾值（"无"、"暂无"、"无 | 无"、"n/a"、"—"）——它们不是深度 */
const PLACEHOLDER_RE = /^(无|暂无|未知|待定|无变化|没有|none|na|无内容)+$/i;

/**
 * 深度键是否"有意义"。
 * 关键：先去分隔符与空白再判 —— "无 | 无" 这类带空格的垃圾值曾经能骗过判据
 * （实测线上真实数据里就有 `tone="无 | 无"`）。
 */
function hasDepth(value) {
    if (value === null || value === undefined) return false;
    const s = String(value).trim();
    if (s.length < 2) return false;
    const stripped = s.replace(/[\s|｜、,，/\\-—–:：]/g, '');
    if (!stripped) return false;
    return !PLACEHOLDER_RE.test(stripped);
}

/**
 * 多来源派生（按优先级）：只在**缺失**时填补。
 * @param {object} sources { stateJson, entity, kvState, materialContent, chronicle }
 * @returns {{merged:object, filled:string[], unresolved:string[]}}
 */
function backfillDepthKeys(sources = {}) {
    const stateJson = { ...(sources.stateJson || {}) };
    const filled = [];

    const entity = sources.entity || {};
    const profile = entity.profile || {};
    const kv = sources.kvState || {};
    const fromEntity = {};
    for (const k of CHARACTER_DEPTH_KEYS) {
        const v = [entity[k], profile[k], kv[k]].find(hasDepth);
        if (v) fromEntity[k] = v;
    }
    const fromContent = deriveDepthFromContent(sources.materialContent);
    const chronicle = sources.chronicle || {};
    const fromChronicle = {};
    if (hasDepth(chronicle.innerConflict)) fromChronicle.innerConflict = chronicle.innerConflict;

    for (const k of CHARACTER_DEPTH_KEYS) {
        if (hasDepth(stateJson[k])) continue;                    // 已有值 → 绝不覆盖
        const v = fromEntity[k] || fromContent[k] || fromChronicle[k];
        if (v) { stateJson[k] = v; filled.push(k); }
    }

    const unresolved = CHARACTER_DEPTH_KEYS.filter(k => !hasDepth(stateJson[k]));
    return { merged: stateJson, filled, unresolved };
}

/** 契约判定口径：任一深度键有意义即算"有深度"（与 contractValidator 的 anyOf 对齐） */
function hasAnyDepthKey(stateJson) {
    return CHARACTER_DEPTH_KEYS.some(k => hasDepth((stateJson || {})[k]));
}

module.exports = {
    backfillDepthKeys, deriveDepthFromContent, extractTaggedFields,
    hasAnyDepthKey, hasDepth, stateKeyOfLabel,
    DEPTH_LABEL_ALIASES, CHARACTER_DEPTH_KEYS,
};
