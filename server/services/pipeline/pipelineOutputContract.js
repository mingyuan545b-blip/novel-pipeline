/**
 * pipelineOutputContract.js — Pipeline输出契约系统（合并版）
 * 包含：输出契约定义 + 校验逻辑
 */
const { PipelineContractError } = require('./pipelineErrors');
const { PIPELINE_CONTRACT } = require('../../config/systemConfig');

// ── 输出契约定义 ──
const OUTPUT_CONTRACTS = {
    'writer': {
        requiredFields: ['content'],
        checks: [
            { code: 'WO-001', label: 'writer输出必须包含正文content', severity: 'CRITICAL', check: (output) => output.content && output.content.length > PIPELINE_CONTRACT.CONTENT_MIN_LENGTH },
            { code: 'WO-002', label: 'writer输出content不得是审核报告格式', severity: 'HIGH', check: (output) => { const c = output.content || ''; return !/初审结果|复审结果|审核概要|问题列表|通过.*未通过/.test(c.substring(0, 500)); } },
            { code: 'WO-003', label: 'writer输出必须包含至少1个素材中的角色名', severity: 'HIGH', check: (output, context) => { if (!context.materialNames || context.materialNames.length === 0) return true; const content = output.content || ''; const charNames = context.materialNames.filter(n => n.type === 'character'); if (charNames.length === 0) return true; return charNames.some(n => content.includes(n.name)); } },
            { code: 'WO-004', label: 'writer输出字数必须>=rejectMin', severity: 'CRITICAL', check: (output, context) => { const wc = (output.content || '').replace(/\s/g, '').length; return wc >= (context.rejectMin || PIPELINE_CONTRACT.CONTENT_MIN_LENGTH); } }
        ]
    },
    'first-review': {
        requiredFields: ['firstReviewOutput'],
        checks: [{ code: 'RO-001', label: '初审输出必须包含可解析的JSON(passed字段)', severity: 'HIGH', check: (output) => { const text = output.firstReviewOutput || ''; return text.includes('"passed"') || text.includes('通过') || text.includes('未通过'); } }]
    },
    'fast-review': {
        requiredFields: ['firstReviewOutput'],
        checks: [{ code: 'RO-001', label: '快审输出必须包含审核结果', severity: 'HIGH', check: (output) => (output.firstReviewOutput || '').length > 50 }]
    },
    'second-review': {
        requiredFields: ['secondReviewOutput'],
        checks: [{ code: 'RO-003', label: '复审输出必须包含可解析的JSON(passed字段)', severity: 'HIGH', check: (output) => { const text = output.secondReviewOutput || ''; return text.includes('"passed"') || text.includes('通过') || text.includes('未通过'); } }]
    },
    'final-editor': {
        requiredFields: ['finalEditorOutput'],
        checks: [{ code: 'FEO-001', label: '定稿输出必须包含approved字段', severity: 'CRITICAL', check: (output) => { const text = output.finalEditorOutput || ''; return text.includes('"approved"') || /通过|批准|approved|✅/.test(text); } }]
    },
    'reviser': {
        requiredFields: ['content'],
        checks: [
            { code: 'RVO-001', label: '修改后content长度不得低于原文50%', severity: 'HIGH', check: (output, context) => { const newWc = (output.content || '').replace(/\s/g, '').length; const origWc = context.originalWordCount || 0; if (origWc === 0) return true; return newWc >= origWc * PIPELINE_CONTRACT.REVISER_MIN_RATIO; } },
            { code: 'RVO-002', label: '修改后content必须包含素材中的角色名', severity: 'HIGH', check: (output, context) => { if (!context.materialNames || context.materialNames.length === 0) return true; const content = output.content || ''; const charNames = context.materialNames.filter(n => n.type === 'character'); if (charNames.length === 0) return true; return charNames.some(n => content.includes(n.name)); } }
        ]
    },
    'polisher': {
        requiredFields: ['polisherOutput'],
        checks: [{ code: 'PO-001', label: '润色输出长度不得低于输入80%', severity: 'HIGH', check: (output, context) => { const newWc = (output.polisherOutput || '').replace(/\s/g, '').length; const origWc = context.originalWordCount || 0; if (origWc === 0) return true; return newWc >= origWc * PIPELINE_CONTRACT.POLISHER_MIN_RATIO; } }]
    },
    'reader': {
        requiredFields: ['readerOutput'],
        checks: [{ code: 'RDO-001', label: '阅读者输出必须包含hardIssues字段', severity: 'MEDIUM', check: (output) => { const text = output.readerOutput || ''; return text.includes('hardIssues') || text.includes('hard_issues'); } }]
    },
    'material-manager': {
        requiredFields: [],
        checks: [{ code: 'MO-001', label: '素材管理必须产生至少1项操作', severity: 'MEDIUM', check: (output) => (output.materialUpdates || []).length > 0 }]
    },
    'material-organizer': { requiredFields: [], checks: [] },
    'material-registrar': {
        requiredFields: [],
        checks: [{ code: 'MRO-001', label: '素材注册操作数必须>0（除非无整理计划）', severity: 'MEDIUM', check: (output) => { if (output.noPlan) return true; return (output.operations || []).length > 0; } }]
    }
};

// ── 校验逻辑 ──
function validateOutput(step, output, context = {}) {
    const contract = OUTPUT_CONTRACTS[step];
    if (!contract) return { passed: true, results: [], failedChecks: [] };

    const results = [];
    const failedChecks = [];

    for (const field of contract.requiredFields) {
        const value = output[field];
        const hasValue = value != null && value !== '';
        const result = { code: `OUT-FIELD-${field}`, label: `输出必须包含${field}字段`, severity: 'CRITICAL', passed: hasValue };
        results.push(result);
        if (!hasValue) failedChecks.push(result);
    }

    for (const check of contract.checks) {
        let passed;
        try { passed = check.check(output, context); } catch (_) { passed = false; }
        const result = { code: check.code, label: check.label, severity: check.severity, passed };
        results.push(result);
        if (!passed) failedChecks.push(result);
    }

    return { passed: failedChecks.filter(r => r.severity === 'CRITICAL').length === 0, results, failedChecks };
}

function getOutputContractSummary() {
    const summary = {};
    for (const [step, contract] of Object.entries(OUTPUT_CONTRACTS)) {
        summary[step] = { requiredFields: contract.requiredFields, checks: contract.checks.map(c => ({ code: c.code, label: c.label, severity: c.severity })) };
    }
    return summary;
}

module.exports = { OUTPUT_CONTRACTS, validateOutput, getOutputContractSummary };
