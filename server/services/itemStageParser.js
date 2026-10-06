/**
 * itemStageParser.js — 从装备/功法素材正文解析"成长阶段"（纯函数）
 *
 * 背景（2026-10-05 勘定压测 P0-D）：
 *   item-definitions.propertiesJson.stages 全为 0 —— 阶段寻址（每阶属性/特效）无数据可验。
 *   这里把素材正文里的阶段描述解析成结构化 stages，写入 propertiesJson。
 *
 * 支持两种来源（按优先级）：
 *   1. 正文内嵌 JSON：包含 "stages": [...] 的代码块/对象
 *   2. 中文分节：
 *        【成长阶段】
 *        一阶：攻击+4，微光
 *        二阶·凝罡：攻击+12，罡气外放
 *      （也兼容 【阶段】/【阶数】/【进阶】标签）
 * 可选：【当前阶段】一阶
 */
'use strict';

const STAGE_HEADING = /【(?:成长阶段|进阶阶段|阶段|阶数|等级)】\s*([\s\S]*?)(?=【[^】]+】|$)/;
const CURRENT_HEADING = /【(?:当前阶段|当前阶|当前等级)】\s*([^【\n]{1,20})/;
const STAGE_LINE = /^\s*(?:[-*•]|\d+[.、)）])?\s*([一二三四五六七八九十百\d第]+[阶层次级品重境])[·\s]*([^：:\n]{0,14})[：:]\s*(.+?)\s*$/;
const ATTR_RE = /([\u4e00-\u9fa5]{1,6})([+＋]?\d+(?:\.\d+)?%?)/g;

function _splitEffectsAndAttrs(text) {
    const attributes = {};
    const effects = [];
    let m;
    ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(text)) !== null) {
        const key = m[1];
        if (['第', '共', '约', '至', '需'].includes(key)) continue;
        attributes[key] = m[2];
    }
    // 剩余非属性短语视为特效（按逗号/顿号切分后过滤）
    for (const part of String(text).split(/[，,、;；]/)) {
        const p = part.trim();
        if (!p) continue;
        ATTR_RE.lastIndex = 0;
        if (!ATTR_RE.test(p)) effects.push(p);
    }
    return { attributes, effects };
}

/** 从正文解析阶段；解析不到返回 null */
function parseStagesFromContent(content) {
    if (!content || typeof content !== 'string') return null;

    // 1) 内嵌 JSON
    const jsonMatch = content.match(/\{[\s\S]*?"stages"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.stages) && parsed.stages.length > 0) {
                return {
                    currentStage: parsed.currentStage || parsed.stages[parsed.stages.length - 1].key || '',
                    stages: parsed.stages,
                    attributes: parsed.attributes || (parsed.stages[parsed.stages.length - 1].attributes || {}),
                };
            }
        } catch (_) { /* 落到中文分节 */ }
    }

    // 2) 中文分节
    const blockMatch = content.match(STAGE_HEADING);
    if (!blockMatch) return null;
    const lines = blockMatch[1].split('\n').map(s => s.trim()).filter(Boolean);
    const stages = [];
    for (const line of lines) {
        const m = line.match(STAGE_LINE);
        if (!m) continue;
        const key = m[1].trim();
        const label = [key, m[2].trim()].filter(Boolean).join('·');
        const { attributes, effects } = _splitEffectsAndAttrs(m[3]);
        stages.push({ key, label, attributes, effects, desc: m[3].trim() });
    }
    if (stages.length === 0) return null;
    const curMatch = content.match(CURRENT_HEADING);
    return {
        currentStage: curMatch ? curMatch[1].trim() : '',
        stages,
        attributes: stages[stages.length - 1].attributes || {},
    };
}

/** 生成 propertiesJson 增量（无阶段时返回 {currentStage:'',stages:[]}） */
function buildItemProperties(content) {
    const s = parseStagesFromContent(content);
    if (!s) return { currentStage: '', stages: [] };
    return { currentStage: s.currentStage || '', attributes: s.attributes || {}, stages: s.stages };
}

module.exports = { parseStagesFromContent, buildItemProperties };
