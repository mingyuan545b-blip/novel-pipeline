/**
 * agentMaterialFormatter.js — 实体/素材深度格式化器
 *
 * 从 agentMaterialScheduler.js 拆出，负责根据深度级别(L0-L4)格式化实体和素材文本。
 * - _resolveEntityDepth: 实体深度解析（意图提及→L3，大纲提及→L3，否则按declaredDetail）
 * - _formatEntityByDepth: 实体文本格式化（L0标签 / L1简表 / L2摘要 / L3详细 / L4全量JSON）
 * - _formatMaterialByDepth: 素材文本格式化（同上深度分级）
 */
const { resolveDepth } = require('./contextDepthConstants');
const { resolveEntityIntentDepth } = require('./intentDepthResolver');

/** 解析实体深度：意图提及 > 大纲提及 > 声明深度 */
function _resolveEntityDepth(entity, declaredDetail, outlineText, intentResult) {
    const baseDepth = resolveDepth(declaredDetail);

    // 意图提及的角色→至少L3（最高优先级）
    const intentDepth = resolveEntityIntentDepth(entity, intentResult);
    if (intentDepth) {
        const baseNum = parseInt(baseDepth.replace('L', ''), 10);
        const intentNum = parseInt(intentDepth.replace('L', ''), 10);
        if (intentNum > baseNum) return intentDepth;
    }

    if (!outlineText) return baseDepth;
    const nameLower = (entity.name || '').toLowerCase();
    const isMentioned = outlineText.includes(nameLower);
    if (entity.roleLevel === 'protagonist') return baseDepth;
    const depthNum = parseInt(baseDepth.replace('L', ''), 10);
    if (isMentioned && depthNum < 3) return 'L3';
    return baseDepth;
}

/** 根据深度级别格式化实体文本 */
function formatEntityByDepth(entity, depth) {
    const d = resolveDepth(depth);
    const name = entity.name || '未命名';
    const roleLabels = { protagonist: '主角', 'key-supporting': '关键配角', supporting: '配角', background: '背景' };
    const roleTag = roleLabels[entity.roleLevel] || entity.roleLevel || '';

    if (d === 'L0') return `${name} | ${roleTag}${entity.position ? '·' + entity.position : ''}`;
    if (d === 'L1') {
        const parts = [`【${name}】${roleTag}`];
        if (entity.position) parts.push(`身份: ${entity.position}`);
        if (entity.personality) parts.push(`性格: ${entity.personality}`);
        if (entity.speakingTone) parts.push(`语调: ${entity.speakingTone}`);
        if (entity.briefText) parts.push(entity.briefText);
        return parts.join(' | ').substring(0, 200);
    }
    if (d === 'L4') return JSON.stringify(entity, null, 2);
    // L2/L3: 完整摘要
    const parts = [`【${name}】${roleTag}`];
    if (entity.position) parts.push(`身份: ${entity.position}`);
    if (entity.personality) parts.push(`性格: ${entity.personality}`);
    if (entity.speakingTone) parts.push(`语调: ${entity.speakingTone}`);
    if (entity.signatureDetail) parts.push(`标志: ${entity.signatureDetail}`);
    if (entity.summaryText) parts.push(entity.summaryText);
    if (d === 'L3' && entity.detailText) parts.push(entity.detailText);
    return parts.join('\n').substring(0, d === 'L2' ? 500 : 1500);
}

/** 根据深度级别格式化素材文本 */
function formatMaterialByDepth(material, depth) {
    const d = resolveDepth(depth);
    const raw = material.currentContent || material.initialContent || '';
    if (d === 'L0') return `${material.name || ''} | ${material.type || ''} — ${(raw.substring(0, 40))}`;
    if (d === 'L1') return `【${material.name}】${raw.substring(0, 180)}`;
    if (d === 'L4') return raw;
    if (d === 'L3') return `【${material.name}】(${material.type || '素材'})\n${raw}`.substring(0, 1500);
    return `【${material.name}】(${material.type || '素材'})\n${raw}`.substring(0, 500);
}

module.exports = { _resolveEntityDepth, formatEntityByDepth, formatMaterialByDepth };
