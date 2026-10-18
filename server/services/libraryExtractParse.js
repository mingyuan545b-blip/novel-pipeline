/**
 * libraryExtractParse — 提取结果解析与规范化
 *
 * LLM输出不可信（可能带think标签/代码块/多余文本/自创部门名），这里统一收口：
 *   解析 → 字段裁剪 → 部门子类校验 → 生成可入库记录（id/嵌套字段由 libraryStore 承接）。
 * 文件位置：server/services/libraryExtractParse.js
 */
const { ALL_DEPARTMENTS, DEPARTMENT_SUBCATEGORIES } = require('../config/libraryExtractDimensions');
const { resolvePlacement, MAX_RULES, MAX_ANTI, MAX_TAGS } = require('./libraryExtractPrompt');
const { hasProperNounSignal } = require('./properNounGuard');

const MAX_NAME_LEN = 14;
const MAX_DEF_LEN = 120;
const MAX_RULE_LEN = 160;
const MAX_EVIDENCE_LEN = 60;
const MAX_JUDGEMENT_LEN = 120;

/** 去掉think标签与markdown代码块，截取JSON主体 */
function extractJsonText(raw) {
    let text = String(raw || '');
    const thinkEnd = text.indexOf('</think');
    if (thinkEnd !== -1) {
        const close = text.indexOf('>', thinkEnd);
        if (close !== -1) text = text.substring(close + 1);
    }
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    // 兼容两种根节点：{"techniques":[...]} 或 [...]
    const objStart = text.indexOf('{');
    const arrStart = text.indexOf('[');
    const useArray = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
    const start = useArray ? arrStart : objStart;
    const end = useArray ? text.lastIndexOf(']') : text.lastIndexOf('}');
    if (start !== -1 && end > start) return text.substring(start, end + 1);
    return text;
}

function parseTechniques(raw) {
    const jsonText = extractJsonText(raw);
    let data;
    try {
        data = JSON.parse(jsonText);
    } catch (e) {
        throw new Error(`LLM输出不是合法JSON: ${e.message}`);
    }
    const list = Array.isArray(data) ? data : (data.techniques || []);
    return Array.isArray(list) ? list : [];
}

function clampText(v, max) {
    const s = String(v == null ? '' : v).trim();
    return s.length > max ? s.slice(0, max) : s;
}

function clampList(v, maxItems, maxLen) {
    if (!Array.isArray(v)) return [];
    return v.map(x => clampText(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

/** 作品专名粗筛（单一源：properNounGuard，含可扩展信号配置） */

/** 部门/子类校验：不在白名单内则回落到维度首选部门 */
function resolveCategory(dimension, raw) {
    const dept = ALL_DEPARTMENTS.includes(raw.department) && dimension.departments.includes(raw.department)
        ? raw.department
        : dimension.departments[0];
    const allowed = DEPARTMENT_SUBCATEGORIES[dept] || [];
    const sub = allowed.includes(raw.subcategory) ? raw.subcategory : allowed[0];
    return { department: dept, subcategory: sub };
}

/**
 * 规范化单条LLM技法 → 库记录（不含id，id由 makeId 生成）
 * @returns {object|null} 不合格返回null
 */
function normalizeTechnique(raw, dimension) {
    const name = clampText(raw.name, MAX_NAME_LEN);
    const definition = clampText(raw.definition, MAX_DEF_LEN);
    if (!name || !definition) return null;
    if (hasProperNounSignal(name)) return null;
    const rules = clampList(raw.implementation_rules, MAX_RULES, MAX_RULE_LEN);
    if (rules.length < 2) return null;
    const { department, subcategory } = resolveCategory(dimension, raw);
    const placement = resolvePlacement(dimension);
    return {
        display_name: name,
        department,
        subcategory,
        description: definition,
        implementation_rules: rules,
        anti_patterns: clampList(raw.anti_patterns, MAX_ANTI, MAX_RULE_LEN),
        judgement_test: clampText(raw.judgement_test, MAX_JUDGEMENT_LEN),
        evidence: clampList(raw.evidence, 2, MAX_EVIDENCE_LEN),
        retrieval_tags: clampList(raw.tags, MAX_TAGS, 12),
        word_count_impact: clampText(raw.word_count_impact || '+0~+10%', 16),
        applicable_modes: ['novel', 'shuangwen'],
        trigger_condition: { chapter_range: [1, 999], narrative_state: [], emotion_curve: 'any' },
        version: '1.0.0',
        source_type: 'extracted',
        ...placement,
    };
}

/** 生成技法ID：部门_子类_序号（序号取该分类现有最大值+1） */
function makeId(dept, sub, existingIds) {
    const prefix = `${dept}_${sub}_`;
    let max = 0;
    for (const id of existingIds) {
        if (!id.startsWith(prefix)) continue;
        const seq = parseInt(id.slice(prefix.length), 10);
        if (Number.isFinite(seq) && seq > max) max = seq;
    }
    return prefix + String(max + 1).padStart(2, '0');
}

module.exports = { parseTechniques, normalizeTechnique, makeId, extractJsonText, resolveCategory };
