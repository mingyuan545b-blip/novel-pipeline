const logger = require('../../shared/logger');
const store = require('../../store');
const { getInfinitePipelineStatus } = require('./infinitePipeline');
const { getMetrics } = require('../metricsCollector');
const { getCircuitBreaker } = require('../reviewCircuitBreaker');
const { createVersionTag } = require('../versionControl');
const { getStyleProfileForProject } = require('../agentPrompts');
const { checkAlertLoop, runBranchingWrite } = require('./pipelineUtils');
const { getVisibleMaterials, enforceVolumeSubplaneLocks } = require('./volumeHelpers');
const { buildVolumeRhythmGuidance } = require('./volumeRhythm');
const { getHookBudgetForProject } = require('../hookBudget');
const { ContextBudget } = require('../contextBudget');
const memory = require('../memory');
const { AGENT_PROMPTS } = require('../agentPrompts');
const { getChapterIntentPlanner } = require('../chapterIntent');
const { saveAgentOutput, AGENT_ROLE_NAMES } = require('../fileOutput');
const { getRuleStackForProject } = require('../ruleStack');
const { getContextTraceForProject } = require('../contextTrace');
const { extractJSON } = require('../jsonUtils');
const stateSnapshot = require('../stateSnapshot');
const consistency = require('../consistency');
const { shouldOverrideReviewRejection } = require('./reviewOverride');
const speechStyleRegistry = require('../speechStyleRegistry');
const pipelineRegistry = require('../pipelineRegistry');
const { formatFeedbackText, checkWordCountHardLimit, runPostApproval } = require('./pipelineHelpers');

let _runPipelineStepFn = null;
function setRunPipelineStepFn(fn) { _runPipelineStepFn = fn; pipelineRegistry.registerStepFn(fn); }
function getRunPipelineStep() {
    if (typeof _runPipelineStepFn === 'function') return _runPipelineStepFn;
    try {
        _runPipelineStepFn = pipelineRegistry.getStepFn();
        return _runPipelineStepFn;
    } catch(e) {
        throw new Error('runPipelineStep is not available - circular dependency may have prevented module loading');
    }
}

async function clearDownstreamOutputs(chapterId, failedStep) {
    const downstreamMap = {
        'writer': ['firstReviewOutput', 'secondReviewOutput', 'finalEditorOutput', 'reviserOutput', 'materialManagerOutput', 'materialOrganizerOutput', 'materialRegistrarOutput', 'polisherOutput'],
        'first-review': ['secondReviewOutput', 'finalEditorOutput', 'materialManagerOutput', 'materialOrganizerOutput', 'materialRegistrarOutput', 'polisherOutput'],
        'fast-review': ['finalEditorOutput', 'materialManagerOutput', 'materialOrganizerOutput', 'materialRegistrarOutput', 'polisherOutput'],
        'second-review': ['finalEditorOutput', 'materialManagerOutput', 'materialOrganizerOutput', 'materialRegistrarOutput', 'polisherOutput'],
        'final-editor': ['materialManagerOutput', 'materialOrganizerOutput', 'materialRegistrarOutput', 'polisherOutput'],
        'polisher': ['materialManagerOutput', 'materialOrganizerOutput', 'materialRegistrarOutput'],
        'material-organizer': ['materialRegistrarOutput']
    };
    const fields = downstreamMap[failedStep] || [];
    if (fields.length === 0) return;
    const ch = await store.getItem('chapters', chapterId);
    if (!ch) return;
    let cleared = false;
    const clearedFields = [];
    for (const f of fields) {
        if (ch[f]) {
            clearedFields.push(`${f}=${ch[f].substring(0, 30)}...`);
            delete ch[f];
            cleared = true;
        }
    }
    if (cleared) {
        ch.updatedAt = new Date().toISOString();
        await store.setItem('chapters', chapterId, ch);
        logger.debug('fullPipeline', `clearDownstreamOutputs: failedStep=${failedStep}, chapterId=${chapterId}, cleared: ${clearedFields.join(', ')}`);
    }
}

function generateOverrideOutput(overrideReason, stepName, originalFeedback) {
    const origSummary = originalFeedback?.summary || '（无原审核摘要）';
    const origIssues = (originalFeedback?.issues || []).slice(0, 3).map((i, idx) => {
        const desc = typeof i === 'string' ? i : (i.desc || i.description || JSON.stringify(i));
        return `${idx + 1}. ${desc}`;
    }).join('\n');

    return `## ${stepName}结果：✅ 系统覆盖通过

### 覆盖原因
${overrideReason}

### 原审核意见
**摘要**：${origSummary}
${origIssues ? '**主要问题**：\n' + origIssues : ''}

### 覆盖判定依据
系统判定原审核意见不适用本项目审核标准，自动覆盖为通过。
覆盖不是忽略问题，而是系统已确认这些问题属于误判或非关键问题。

\`\`\`json
${JSON.stringify({
    passed: true,
    approved: true,
    _overridden: true,
    _overrideReason: overrideReason,
    summary: `系统覆盖通过：${overrideReason}`,
    issues: [],
    suggestions: [],
    _originalSummary: origSummary
}, null, 2)}
\`\`\``;
}

const { PipelineOrchestrator } = require('../../core/pipeline/orchestrator');

async function runFullPipeline(projectId, chapterId, maxRounds = 5, options = {}) {
    const orchestrator = new PipelineOrchestrator();
    orchestrator.setRunPipelineStepFn(getRunPipelineStep());
    return await orchestrator.run(projectId, chapterId, maxRounds, options);
}

module.exports = { runFullPipeline, setRunPipelineStepFn, shouldOverrideReviewRejection };
