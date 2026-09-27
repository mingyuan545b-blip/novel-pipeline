'use strict';

/**
 * tokenSlotLabels.js — Token 面板展示元数据（唯一数据源）
 *
 * 三部分：
 *   1. 提示词分段（与 contextBudget 的 slot 名一一对应，新增 slot 必须登记）
 *   2. 场景类型标签（与 contextDecisionTables.SCENE_KEYWORDS 的 key 对应）
 *   3. 章节阶段标签（opening/development/climax/resolution）
 *
 * 文件位置：server/config/tokenSlotLabels.js
 */

const SLOT_GROUPS = Object.freeze({
    prompt: { label: '提示词与规则', color: '#8b5cf6' },
    memory: { label: '记忆', color: '#06b6d4' },
    material: { label: '素材', color: '#22c55e' },
    content: { label: '正文与大纲', color: '#f59e0b' },
    technique: { label: '技法注入', color: '#ec4899' },
    other: { label: '其他', color: '#64748b' },
});

/** slot → { label, group } */
const TOKEN_SLOT_META = Object.freeze({
    agent_prompt: { label: 'Agent提示词', group: 'prompt' },
    constraint_rules: { label: '架构约束', group: 'prompt' },
    style_guidance: { label: '风格指导', group: 'prompt' },
    style_template: { label: '风格模板', group: 'prompt' },
    memory_context: { label: '分层记忆', group: 'memory' },
    character_states: { label: '角色状态', group: 'memory' },
    worldview_materials: { label: '世界观素材', group: 'material' },
    character_materials: { label: '角色素材', group: 'material' },
    other_materials: { label: '其他素材', group: 'material' },
    material_summary: { label: '素材摘要', group: 'material' },
    foreshadowing: { label: '伏笔追踪', group: 'material' },
    chapter_outline: { label: '章节大纲', group: 'content' },
    previous_chapter: { label: '前序章节', group: 'content' },
    chapter_content: { label: '章节正文', group: 'content' },
    review_feedback: { label: '审核反馈', group: 'content' },
    technique_injection: { label: '写作技法', group: 'technique' },
    beat_allocation: { label: '节拍分配', group: 'technique' },
});

function slotMeta(slot) {
    const meta = TOKEN_SLOT_META[slot];
    if (meta) return { slot, label: meta.label, group: meta.group, color: SLOT_GROUPS[meta.group]?.color || SLOT_GROUPS.other.color };
    return { slot, label: slot, group: 'other', color: SLOT_GROUPS.other.color };
}

/** 分组聚合（前端占比图按组展示时使用） */
function slotGroupLabel(group) {
    return SLOT_GROUPS[group]?.label || SLOT_GROUPS.other.label;
}

/** 场景类型（key 与 contextDecisionTables.SCENE_KEYWORDS 对齐） */
const SCENE_LABELS = Object.freeze({
    combat: '战斗', social: '社交/对话', exploration: '探索', revelation: '揭秘/反转',
    training: '修炼/成长', emotional: '情感', mystery: '悬疑', daily: '日常',
    conflict: '冲突', negotiation: '谈判', journey: '旅途', battle: '大战',
});

/** 章节阶段（contextDecisionTables.CHAPTER_PHASES / PHASE_RATIOS） */
const PHASE_LABELS = Object.freeze({
    opening: '开篇', development: '发展', climax: '高潮', resolution: '收束', unknown: '未判定',
});

function sceneLabel(key) { return SCENE_LABELS[key] || key; }
function phaseLabel(key) { return PHASE_LABELS[key] || key || PHASE_LABELS.unknown; }

module.exports = {
    SLOT_GROUPS, TOKEN_SLOT_META, slotMeta, slotGroupLabel,
    SCENE_LABELS, PHASE_LABELS, sceneLabel, phaseLabel,
};
