'use strict';

/**
 * Agent岗位模板
 * 每个agent声明自己需要哪些Slot，组装引擎按声明填充
 * 核心原则：
 *   - 写作agent（writer/reviser/prefixer）拿全套：红线+技法+约束+风格+风味+注册表
 *   - 审核agent（review类）只拿审核相关：约束词（审核标准版）+风格+注册表
 *   - 管理类agent（material-manager/reader）只拿角色边界
 */

const AGENT_JOB_TEMPLATES = {
    'writer': {
        label: '执笔人',
        task: '根据大纲和素材撰写章节正文',
        slots: [
            'role-boundary', 'redlines-writer', 'quality-check', 'craft-rules',
            'genre-foundation', 'constraints', 'style-profile', 'flavor',
            'genre-registry', 'memory-pyramid', 'output-novel',
        ],
    },
    'reviser': {
        label: '返修员',
        task: '根据审核反馈修改章节内容',
        slots: [
            'role-boundary', 'redlines-reviser', 'genre-foundation',
            'constraints', 'style-profile', 'flavor', 'genre-registry',
            'memory-pyramid', 'output-novel',
        ],
    },
    'polisher': {
        label: '润色师',
        task: '对章节进行润色优化',
        slots: [
            'role-boundary', 'redlines-polisher', 'genre-foundation',
            'style-profile', 'flavor', 'genre-registry', 'output-novel',
        ],
    },
    'first-review': {
        label: '初审',
        task: '对章节初稿进行质量审核',
        slots: ['role-boundary', 'constraints', 'style-profile', 'genre-registry'],
    },
    'second-review': {
        label: '复审',
        task: '对初审通过的稿件进行复审',
        slots: ['role-boundary', 'constraints', 'style-profile', 'genre-registry'],
    },
    'fast-review': {
        label: '快审',
        task: '快速审核章节节奏和关键节点',
        slots: ['role-boundary', 'constraints', 'style-profile', 'genre-registry'],
    },
    'final-editor': {
        label: '定稿人',
        task: '对稿件进行最终定稿编辑',
        slots: ['role-boundary', 'constraints', 'style-profile', 'genre-registry'],
    },
    'material-manager': {
        label: '素材管理员',
        task: '管理素材库的增删改查',
        slots: ['role-boundary', 'constraints', 'style-profile', 'genre-registry'],
    },
    'material-organizer': {
        label: '素材整理师',
        task: '整理章节素材变化和限知认知变化，输出organizingPlan',
        // 陷阱#90修复：此前只有2个slot（缺constraints/style-profile），导致system prompt仅305字符
        // LLM不理解任务要求，输出空organizingPlan（0项认知变化），连锁导致：
        // character_states表0条 / knowledgeChanges为空 / 角色素材无深度字段
        // 与material-manager对齐，补齐constraints和style-profile，确保LLM获得完整约束上下文
        slots: ['role-boundary', 'constraints', 'style-profile', 'genre-registry'],
    },
    'intent-planner': {
        label: '意图规划',
        task: '规划章节写作意图和大纲',
        slots: ['role-boundary', 'genre-foundation', 'constraints', 'style-profile', 'genre-registry', 'memory-pyramid'],
    },
    'reader': {
        label: '阅读者',
        task: '以读者视角评价章节阅读体验',
        slots: ['role-boundary'],
    },
};

function getJobTemplate(agentType) {
    return AGENT_JOB_TEMPLATES[agentType] || null;
}

function listJobTemplates() {
    return Object.entries(AGENT_JOB_TEMPLATES).map(([id, t]) => ({
        agentType: id,
        label: t.label,
        task: t.task,
        slots: [...t.slots],
    }));
}

module.exports = {
    AGENT_JOB_TEMPLATES,
    getJobTemplate,
    listJobTemplates,
};
