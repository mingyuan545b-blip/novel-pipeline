/**
 * dataFlowSpec.js — Pipeline数据流规范（合并版）
 * 包含：所有步骤的输入/输出/下游/污染风险定义
 */

const DATA_FLOW_SPEC = {
    'outline-generator': {
        label: '大纲生成器', description: '生成初始素材和章节大纲',
        inputs: [
            { name: 'projectId', source: 'PUSH', from: 'API调用', required: true, format: 'string' },
            { name: 'project', source: 'PULL', from: 'DataContext.getProject()', required: true, format: 'object' },
            { name: 'genre', source: 'PULL', from: 'detectGenre(styleProfile)', required: true, format: 'object|null' },
            { name: 'constraintInjection', source: 'PULL', from: 'constraintInjector.buildConstraintInjection()', required: true, format: 'string' },
            { name: 'styleInjection', source: 'PULL', from: 'styleInjector.buildStyleInjection()', required: true, format: 'string' },
        ],
        outputs: [
            { name: 'created', format: 'array', description: '创建的素材列表' },
            { name: 'count', format: 'number', description: '素材数量' },
            { name: 'syncedFacts', format: 'number', description: '同步到知识库的事实数' },
        ],
        downstream: ['writer', 'first-review', 'material-manager'],
        pollutionRisk: 'LLM可能生成与题材插件示例相同的角色（示例污染）',
        missingDataAction: 'genre为null时无法生成题材特定素材，使用通用配置'
    },
    'writer': {
        label: '执笔', description: '按大纲和素材创作章节正文',
        inputs: [
            { name: 'materials', source: 'PUSH', from: 'materialIndex', required: true, format: 'array' },
            { name: 'chapter', source: 'PUSH', from: 'store.getItem("chapters")', required: true, format: 'object' },
            { name: 'project', source: 'PULL', from: 'DataContext.getProject()', required: true, format: 'object' },
            { name: 'genre', source: 'PULL', from: 'DataContext.getGenre()', required: true, format: 'object|null' },
            { name: 'config', source: 'PULL', from: 'resolveConfig(genre, project)', required: true, format: 'object' },
        ],
        outputs: [
            { name: 'chapter.content', format: 'string', description: '章节正文', minLength: 1500 },
            { name: 'chapter.wordCount', format: 'number', description: '字数' },
        ],
        downstream: ['first-review', 'fast-review'],
        pollutionRisk: '自创素材库外的角色名，或返回审核报告格式而非正文',
        missingDataAction: 'materials为空时fallback到store直接查询'
    },
    'first-review': {
        label: '初审', description: '审核章节正文，检查设定偏移/格式/字数',
        inputs: [
            { name: 'chapter.content', source: 'PUSH', from: 'writer输出', required: true, format: 'string' },
            { name: 'project', source: 'PULL', from: 'DataContext.getProject()', required: true, format: 'object' },
        ],
        outputs: [
            { name: 'chapter.firstReviewOutput', format: 'string', description: '初审结果(Markdown+JSON)' },
            { name: 'passed', format: 'boolean', description: '是否通过' },
        ],
        downstream: ['second-review', 'reviser'],
        pollutionRisk: '幻觉出素材中不存在的角色设定',
        missingDataAction: 'content为空时CRITICAL阻断'
    },
    'fast-review': {
        label: '快审', description: '快速审核（替代初审的轻量版本）',
        inputs: [{ name: 'chapter.content', source: 'PUSH', from: 'writer输出', required: true, format: 'string' }],
        outputs: [{ name: 'chapter.firstReviewOutput', format: 'string', description: '快审结果' }, { name: 'passed', format: 'boolean' }],
        downstream: ['second-review', 'reviser'],
        pollutionRisk: '同first-review', missingDataAction: 'content为空时CRITICAL阻断'
    },
    'second-review': {
        label: '复审', description: '复审章节正文和初审结果',
        inputs: [
            { name: 'chapter.content', source: 'PUSH', from: 'writer/reviser输出', required: true, format: 'string' },
            { name: 'chapter.firstReviewOutput', source: 'PUSH', from: 'first-review输出', required: true, format: 'string' },
            { name: 'project', source: 'PULL', from: 'DataContext.getProject()', required: true, format: 'object' },
        ],
        outputs: [
            { name: 'chapter.secondReviewOutput', format: 'string', description: '复审结果(Markdown+JSON)' },
            { name: 'passed', format: 'boolean' },
        ],
        downstream: ['final-editor'],
        pollutionRisk: '同first-review',
        missingDataAction: 'firstReviewOutput为空时HIGH警告但继续'
    },
    'final-editor': {
        label: '定稿', description: '综合初审+复审结果，决定章节是否通过',
        inputs: [
            { name: 'chapter.content', source: 'PUSH', from: 'writer/reviser输出', required: true, format: 'string' },
            { name: 'chapter.firstReviewOutput', source: 'PUSH', from: 'first-review输出', required: true, format: 'string' },
        ],
        outputs: [
            { name: 'chapter.finalEditorOutput', format: 'string', description: '定稿结果(Markdown+JSON)' },
            { name: 'chapter.status', format: 'string', description: 'approved/rejected' },
        ],
        downstream: ['material-manager', 'reader'],
        pollutionRisk: '定稿人返回小说正文而非审核结果',
        missingDataAction: 'secondReviewOutput为空时MEDIUM警告但继续'
    },
    'reviser': {
        label: '修改员', description: '根据审核反馈修改章节正文',
        inputs: [
            { name: 'chapter.content', source: 'PUSH', from: 'writer输出', required: true, format: 'string' },
            { name: 'reviewFeedback', source: 'PUSH', from: 'review输出', required: true, format: 'string' },
            { name: 'project', source: 'PULL', from: 'store.getItem("projects")', required: true, format: 'object' },
        ],
        outputs: [
            { name: 'chapter.content', format: 'string', description: '修改后正文', minLength: 1500 },
            { name: 'chapter.wordCount', format: 'number', description: '修改后字数' },
        ],
        downstream: ['second-review'],
        pollutionRisk: '修改后引入素材库外的角色名，或字数骤降',
        missingDataAction: 'reviewFeedback为空时HIGH警告'
    },
    'polisher': {
        label: '润色', description: '润色已通过审核的正文',
        inputs: [{ name: 'chapter.content', source: 'PUSH', from: 'final-editor通过的正文', required: true, format: 'string' }],
        outputs: [{ name: 'chapter.polisherOutput', format: 'string', description: '润色后正文' }],
        downstream: [], pollutionRisk: '润色时改变剧情/人物/设定', missingDataAction: 'content为空时CRITICAL阻断'
    },
    'reader': {
        label: '阅读者', description: '跨章节阅读，发现前后矛盾/重复/设定冲突',
        inputs: [{ name: 'recentChapters', source: 'PULL', from: 'store.queryItems("chapters")', required: true, format: 'array' }],
        outputs: [{ name: 'chapter.readerOutput', format: 'string', description: '阅读者评审(JSON)' }],
        downstream: ['reviser', 'final-editor', 'material-manager'], pollutionRisk: '幻觉出跨章节矛盾', missingDataAction: '无已完成章节时CRITICAL阻断'
    },
    'material-manager': {
        label: '素材管理', description: '管理素材生命周期（创建/更新/归档）',
        inputs: [
            { name: 'materials', source: 'PUSH', from: 'materialIndex', required: true, format: 'array' },
            { name: 'chapter', source: 'PUSH', from: 'store.getItem("chapters")', required: true, format: 'object' },
        ],
        outputs: [{ name: 'materialUpdates', format: 'array', description: '素材更新操作列表' }],
        // 拆分模式：material-manager → organizer（整理计划）→ registrar（落地）
        downstream: ['material-organizer', 'material-registrar'], pollutionRisk: '创建重复素材、归档错误素材', missingDataAction: 'materials为空时HIGH警告'
    },
    'material-organizer': {
        label: '素材整理', description: '从本章正文整理出角色状态/新素材/归档候选（organizingPlan）',
        inputs: [
            { name: 'chapter.content', source: 'PUSH', from: 'approved 正文', required: true, format: 'string' },
            { name: 'materials', source: 'PUSH', from: 'materialIndex', required: true, format: 'array' },
            { name: 'kvSummary', source: 'PULL', from: 'stateKVIndex.generateBriefSummary()', required: false, format: 'string' },
        ],
        outputs: [{ name: 'organizingPlan', format: 'object', description: '整理计划（characters/newMaterials/archiveCandidates）' }],
        downstream: ['material-registrar'], pollutionRisk: '把正文里的一次性路人当成长期角色登记', missingDataAction: 'chapter.content为空时跳过整理'
    },
    'material-registrar': {
        label: '素材注册', description: '执行素材的创建/更新/归档操作',
        inputs: [
            { name: 'materials', source: 'PUSH', from: 'materialIndex', required: true, format: 'array' },
            { name: 'chapter', source: 'PUSH', from: 'store.getItem("chapters")', required: true, format: 'object' },
            { name: 'organizingPlan', source: 'PUSH', from: 'material-organizer输出', required: true, format: 'object' },
        ],
        outputs: [
            { name: 'operations', format: 'array', description: '执行的操作列表' },
            { name: 'errors', format: 'array', description: '致命错误（真·写库失败/结构非法）' },
            { name: 'warnings', format: 'array', description: '告警（内容缺口/降级保留，不判失败）' },
        ],
        downstream: ['knowledge-extractor', 'writer'], pollutionRisk: '创建同名素材、角色状态KV冲突', missingDataAction: 'organizingPlan为空时跳过注册'
    },
    'knowledge-extractor': {
        label: '知识提取', description: '把本章事实/时间线同步进知识库（facts + timeline）',
        inputs: [
            { name: 'chapter', source: 'PUSH', from: 'store.getItem("chapters")', required: true, format: 'object' },
            { name: 'materials', source: 'PUSH', from: 'materialIndex', required: true, format: 'array' },
        ],
        outputs: [{ name: 'syncedFacts', format: 'number', description: '同步的事实数' }],
        downstream: ['writer'], pollutionRisk: '把未发生的事写成已知事实', missingDataAction: '正文为空时跳过同步'
    }
};

// 2026-10-11 补：intent-planner/consistency-constraint 等真实步骤的规范条目拆到 supplement
// （S8「dataFlowSpec 与真实步骤对齐」遗漏；闸门因只查 StepRegistry 未迁移步骤而漏检）。
const { SUPPLEMENT_SPEC } = require('./dataFlowSpecSupplement');
Object.assign(DATA_FLOW_SPEC, SUPPLEMENT_SPEC);

// 真实步骤清单（用于 dataFlowSpec 一致性闸门：规范不得漂移到不存在的步骤）
const KNOWN_STEP_KEYS = Object.freeze([
    'outline-generator', 'intent-planner', 'writer', 'fast-review', 'first-review', 'second-review',
    'reviser', 'final-editor', 'polisher', 'reader', 'material-manager', 'material-organizer',
    'material-registrar', 'knowledge-extractor', 'consistency-constraint'
]);

function getDataFlowSpec(step) {
    return DATA_FLOW_SPEC[step] || null;
}

function getDataFlowGraph() {
    const graph = {};
    for (const [step, spec] of Object.entries(DATA_FLOW_SPEC)) {
        graph[step] = {
            label: spec.label,
            inputs: spec.inputs.map(i => ({ name: i.name, source: i.source, from: i.from, required: i.required })),
            outputs: spec.outputs.map(o => ({ name: o.name, format: o.format })),
            downstream: spec.downstream,
            pollutionRisk: spec.pollutionRisk,
            missingDataAction: spec.missingDataAction
        };
    }
    return graph;
}

module.exports = { DATA_FLOW_SPEC, KNOWN_STEP_KEYS, getDataFlowSpec, getDataFlowGraph };
