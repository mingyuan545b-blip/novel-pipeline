'use strict';

/**
 * 约束词作用域定义
 * 每个约束词属于一个作用域：writing（仅写作agent）、review（仅审核agent）、all（两者都适用）
 * agentPromptAssembler 根据此映射决定哪些约束词注入给哪个agent
 */

// 陷阱#90/#91修复：material-organizer必须与material-manager一样在WRITING_AGENTS中，
// 否则shouldApplyConstraint对所有约束词返回false，constraints slot返回null，
// 触发PROMPT_INCOMPLETE阻断pipeline，导致material-organizer不执行
const WRITING_AGENTS = new Set(['writer', 'reviser', 'polisher', 'intent-planner', 'outline-generator', 'material-manager', 'material-organizer']);
const REVIEW_AGENTS = new Set(['first-review', 'second-review', 'fast-review', 'final-editor']);
const READER_AGENTS = new Set(['reader']);

const BASE_CONSTRAINT_SCOPES = {
    'pov-lock': 'all',
    'no-derailment': 'all',
    'character-consistency': 'all',
    'anti-tool-character': 'all',
    'character-depth': 'all',
    'worldview-consistency': 'all',
    'hook-every-chapter': 'all',
    'fast-escalation': 'writing',
    'reader-satisfaction': 'writing',
    'simple-readable-style': 'all',
    'face-slapping': 'writing',
    'power-fantasy': 'writing',
};

const DEFAULT_GENRE_CONSTRAINT_SCOPE = 'all';

function getConstraintScope(constraintId, genreConstraintIds) {
    if (BASE_CONSTRAINT_SCOPES[constraintId]) {
        return BASE_CONSTRAINT_SCOPES[constraintId];
    }
    if (genreConstraintIds && genreConstraintIds.includes(constraintId)) {
        return DEFAULT_GENRE_CONSTRAINT_SCOPE;
    }
    return 'all';
}

function shouldApplyConstraint(constraintId, agentType, genreConstraintIds) {
    const scope = getConstraintScope(constraintId, genreConstraintIds);
    if (scope === 'all') return WRITING_AGENTS.has(agentType) || REVIEW_AGENTS.has(agentType) || READER_AGENTS.has(agentType);
    if (scope === 'writing') return WRITING_AGENTS.has(agentType);
    if (scope === 'review') return REVIEW_AGENTS.has(agentType);
    return false;
}

function isWritingAgent(agentType) {
    return WRITING_AGENTS.has(agentType);
}

function isReviewAgent(agentType) {
    return REVIEW_AGENTS.has(agentType);
}

function isReaderAgent(agentType) {
    return READER_AGENTS.has(agentType);
}

function getConstraintHeader(agentType) {
    if (REVIEW_AGENTS.has(agentType)) return '审核标准（必须检查）';
    if (READER_AGENTS.has(agentType)) return '阅读体验参考';
    return '写作约束（必须遵守）';
}

module.exports = {
    WRITING_AGENTS,
    REVIEW_AGENTS,
    READER_AGENTS,
    BASE_CONSTRAINT_SCOPES,
    DEFAULT_GENRE_CONSTRAINT_SCOPE,
    getConstraintScope,
    shouldApplyConstraint,
    isWritingAgent,
    isReviewAgent,
    isReaderAgent,
    getConstraintHeader,
};
