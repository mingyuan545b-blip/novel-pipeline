/**
 * pipelineStepRunner.js — Pipeline步骤执行器
 * 负责单步骤的上下文组装、契约校验和步骤调度
 *
 * 陷阱#79防护：节点级契约校验（pre/post/postMaterial）
 * 基于YAML配置驱动，真实数据校验，不靠LLM
 */
const logger = require('../../shared/logger');
const { saveAgentOutput } = require('../fileOutput');
const StepRegistry = require('../../core/pipeline/steps/StepRegistry');
const { preflight } = require('./pipelinePreflight');
const { runAgent } = require('./agentRunner');
const { buildStepContext } = require('./stepContextBuilder');
const { recordReviewFeedback } = require('./techniqueContextHelpers');
const auditLog = require('../auditLog');
const contractValidator = require('./contractValidator');
const { enrichMaterialsForContract } = require('./contractMaterialEnricher');
const { assertChapterReady, buildGateError } = require('./materialGate');

const REVIEW_STEPS = new Set(['first-review', 'fast-review', 'second-review']);
// 节点级契约校验覆盖的agent（阶段1+2：9个agent全覆盖）
// 阶段1：writer/first-review/material-manager
// 阶段2：reviser/fast-review/second-review/final-editor/polisher/consistency-constraint
const CONTRACT_AGENTS = new Set([
    'writer', 'first-review', 'material-manager',
    'reviser', 'fast-review', 'second-review', 'final-editor', 'polisher', 'consistency-constraint'
]);

async function runPipelineStep(projectId, chapterId, step, round, context = {}) {
    const { chapter, materials, project, agentContext, _legacyConfig, _legacyGenre, maxChapterWords, budget, memoryError } = await buildStepContext(projectId, chapterId, step, round, context);

    logger.info('pipeline', `runPipelineStep: step=${step}, chapter=${chapterId}, round=${round}, hasNewStep=${StepRegistry.hasNewStep(step)}`);

    // P1-4a 章节因果门槛（兜底网）：正文创作入口步（writer）前，前序章节素材必须已归档。
    // 只判不修不写（修复由主循环/orchestrator 负责），避免 catchup 递归与额外写盘。
    if (step === 'writer' && chapter && chapter.chapterNumber > 1) {
        const gate = await assertChapterReady({ projectId, chapterNumber: chapter.chapterNumber, repair: false, persist: false });
        if (!gate.ready) {
            logger.error('pipeline', `[materialGate] writer 被门槛拦下：${gate.report}`, { blockedBy: gate.blockedBy });
            throw buildGateError(gate.report);
        }
    }

    try {
        preflight(step, { materials, chapter, project, config: _legacyConfig, genre: _legacyGenre, memoryError });
    } catch (contractErr) {
        logger.error('pipeline', `契约校验失败: ${contractErr.message}`);
        return {
            step, passed: false,
            feedback: { summary: contractErr.message, issues: [{ code: contractErr.code, severity: contractErr.severity }], suggestions: [contractErr.fixGuide] },
            contractError: { code: contractErr.code, message: contractErr.message, fix: contractErr.fixGuide }
        };
    }

    // 陷阱#79防护：节点级输入素材契约校验（pre-execution）
    if (CONTRACT_AGENTS.has(step) && chapter?.chapterNumber) {
        // 陷阱#79根因修复：契约校验数据源统一
        // writer 通过 buildStateJson 合并 entity+KV store，契约校验此前读 materials 表原始 stateJson
        // 导致深度字段误判，这里统一合并 KV store 深度字段
        const enrichedMaterials = await enrichMaterialsForContract(materials, projectId);
        const ctxForValidation = { chapter, materials: enrichedMaterials, project };
        const inputCheck = contractValidator.validateInput(step, ctxForValidation, chapter.chapterNumber);
        if (!inputCheck.passed) {
            const errSummary = inputCheck.errors.map(e => `[${e.errorCode}]${e.message}`).join('; ');
            logger.error('pipeline', `[trap#79] 节点级契约校验失败(pre): step=${step} ${errSummary}`);
            return {
                step, passed: false,
                feedback: { summary: `节点级契约校验失败: ${errSummary}`, issues: inputCheck.errors.map(e => ({ code: e.errorCode, severity: e.severity, description: e.message })) },
                contractError: { code: 'NODE_CONTRACT_PRE_FAIL', message: errSummary }
            };
        }
        if (inputCheck.warnings.length > 0) {
            // WARN也阻断（用户要求）
            const warnSummary = inputCheck.warnings.map(w => `[${w.errorCode}]${w.message}`).join('; ');
            logger.warn('pipeline', `[trap#79] 节点级契约校验WARN阻断(pre): step=${step} ${warnSummary}`);
            return {
                step, passed: false,
                feedback: { summary: `节点级契约校验WARN: ${warnSummary}`, issues: inputCheck.warnings.map(w => ({ code: w.errorCode, severity: w.severity, description: w.message })) },
                contractError: { code: 'NODE_CONTRACT_PRE_WARN', message: warnSummary }
            };
        }
    }

    if (StepRegistry.hasNewStep(step)) {
        const stepParams = { projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput, round, mode: project?.mode || 'novel', modeConfig: _legacyConfig, maxChapterWords, budget, chapterId, project, ctx: context };
        const stepResult = await StepRegistry.executeStep(step, stepParams);
        if (stepResult.chapter) Object.assign(chapter, stepResult.chapter);

        // 陷阱#79防护：节点级输出契约校验（post-execution）
        if (CONTRACT_AGENTS.has(step) && stepResult.result) {
            const outputCheck = contractValidator.validateOutput(step, stepResult.result);
            if (!outputCheck.passed) {
                const errSummary = outputCheck.errors.map(e => `[${e.errorCode}]${e.message}`).join('; ');
                logger.error('pipeline', `[trap#79] 节点级契约校验失败(post): step=${step} ${errSummary}`);
                return {
                    step, passed: false,
                    feedback: { summary: `输出契约校验失败: ${errSummary}`, issues: outputCheck.errors.map(e => ({ code: e.errorCode, severity: e.severity, description: e.message })) },
                    contractError: { code: 'NODE_CONTRACT_POST_FAIL', message: errSummary }
                };
            }
        }

        // 陷阱#79防护：material-manager专属post-material校验（校验素材已落库）
        if (step === 'material-manager' && projectId && chapter?.chapterNumber) {
            try {
                // 源头修复（陷阱#87）：markChapterProcessed和syncKnowledgeBase已移至
                // handleMaterialManager和handleMaterialRegistrar内部自然执行，不再外部补标记
                const postMatCheck = await contractValidator.validatePostMaterial(projectId, chapter.chapterNumber);
                if (!postMatCheck.passed) {
                    const errSummary = postMatCheck.errors.map(e => `[${e.errorCode}]${e.message}`).join('; ');
                    logger.error('pipeline', `[trap#79] post-material校验失败: step=${step} ${errSummary}`);
                    return {
                        step, passed: false,
                        feedback: { summary: `素材落库校验失败: ${errSummary}`, issues: postMatCheck.errors.map(e => ({ code: e.errorCode, severity: e.severity, description: e.message })) },
                        contractError: { code: 'NODE_CONTRACT_POSTMAT_FAIL', message: errSummary }
                    };
                }
            } catch (e) {
                logger.warn('pipeline', `[trap#79] post-material校验异常: ${e.message}`);
            }
        }

        if (REVIEW_STEPS.has(step) && projectId && chapter?.chapterNumber) {
            await recordReviewFeedback(projectId, chapter.chapterNumber, !!stepResult.passed);
        }

        auditLog.log(stepResult.passed ? auditLog.ACTIONS.PIPELINE_COMPLETE : auditLog.ACTIONS.PIPELINE_ERROR, {
            projectId, summary: `Step ${step} Ch${chapter?.chapterNumber || chapterId} ${stepResult.passed ? 'passed' : 'failed'}`,
            metadata: { step, chapterNumber: chapter?.chapterNumber, round, passed: stepResult.passed },
        });

        return {
            step: stepResult.step, result: stepResult.result, passed: stepResult.passed,
            feedback: stepResult.feedback, materialGuidance: stepResult.materialGuidance || ''
        };
    }

    throw new Error(`Unknown pipeline step: ${step}`);
}

module.exports = { runPipelineStep };
