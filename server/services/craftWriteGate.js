'use strict';

/**
 * craftWriteGate — 实体工艺字段的**唯一写入门禁**（纯函数 + 非静默告警）
 *
 * 问题（2026-10-17 取证）：`craftQualitySpec` 写清了"什么是高光/名言/魅力"，但校验只挂在
 * 编年史回流与设计器上；**设计期解析**（characterStateExtractor → buildCharacterEntityPatch）
 * 与 **素材管理员特质增量**（materialCharacterProcessor.processTraitNotes）都能绕过校验直接写实体，
 * 于是"处境混入 quote / 标签式 why / 剧情摘要式 what / 裸字符串口头禅"落库。
 *
 * 本模块在**唯一写入汇合点**（entityCRUD.getOrCreateEntity / updateEntity）执行门禁：
 *   - 不合格的工艺字段**丢弃**（宁缺毋滥，不用垃圾覆盖已有好值）；
 *   - 丢弃**计数并告警**（非静默）；返回过滤后的补丁。
 * 依据：docs/design/角色编年史升级-多维分层与素材质检.md §三/§十、docs/sop/12 §八。
 */
const logger = require('../shared/logger');
const { validateQuotes } = require('./validateQuotes');
const { validateHighlights } = require('./validateHighlights');
const { validateCatchphrases } = require('./validateCatchphrases');
const { hasModernMeme } = require('./craftQualitySpec');

/** 魅力必须写成"当X时，他宁可Y，也不Z"的选择模式（禁形容词堆砌） */
const CHARISMA_FORM_RE = /宁可|也不|宁愿/;

/** 文本型工艺字段 */
const CRAFT_TEXT_FIELDS = Object.freeze(['charisma', 'philosophy', 'entranceDesign']);
/** 数组型工艺字段 → 对应批量校验器 */
const CRAFT_ARRAY_VALIDATORS = Object.freeze({
    quoteLibrary: validateQuotes,
    highlightScenes: validateHighlights,
    catchphrases: validateCatchphrases,
});

function _text(v) { return String(v == null ? '' : v).trim(); }

/** 单个文本工艺字段是否合格 */
function _textFieldOk(field, value) {
    const t = _text(value);
    if (!t) return false;
    if (field === 'charisma') return CHARISMA_FORM_RE.test(t) && !hasModernMeme(t);
    return !hasModernMeme(t);
}

/**
 * 过滤工艺字段补丁（不修改入参；非工艺字段原样保留）。
 * @param {object} patch 待写入实体的补丁（updateEntity 的 updates / getOrCreate 的 defaults）
 * @returns {object} 过滤后的补丁（不合格工艺字段被删除）
 */
function gateEntityCraftPatch(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
    const out = { ...patch };
    const rejected = [];

    for (const field of CRAFT_TEXT_FIELDS) {
        if (out[field] === undefined) continue;
        if (!_textFieldOk(field, out[field])) { rejected.push(field); delete out[field]; }
    }

    for (const [field, validate] of Object.entries(CRAFT_ARRAY_VALIDATORS)) {
        if (out[field] === undefined) continue;
        const raw = out[field];
        if (!Array.isArray(raw)) { rejected.push(`${field}(非数组)`); delete out[field]; continue; }
        if (raw.length === 0) continue;
        const { items, passed } = validate(raw);
        if (passed === 0) { rejected.push(`${field}(0/${raw.length})`); delete out[field]; }
        else if (passed < raw.length) { rejected.push(`${field}(${raw.length - passed}/${raw.length})`); out[field] = items; }
        else out[field] = items;
    }

    if (rejected.length > 0) {
        logger.warn('craftWriteGate', `工艺字段未达门禁，已丢弃: ${rejected.join(', ')}`);
    }
    return out;
}

module.exports = { gateEntityCraftPatch, CRAFT_TEXT_FIELDS, CRAFT_ARRAY_VALIDATORS, CHARISMA_FORM_RE };
