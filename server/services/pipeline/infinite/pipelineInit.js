const store = require("../../../store");
const { resolveConfig } = require("../../../config");
const { LLM_DEFAULTS } = require("../../../config/systemConfig");
const { resolveGenreFromProject } = require("../../genreConfig");
const { getDataContext } = require("../../dataContext");
const { generateChapterOutlines, generateInitialMaterials } = require("../outlineGenerator");
const { catchupMaterialManager } = require("../materialManagerCatchup");
const { startHeartbeat, clearHeartbeat } = require("./heartbeat");
const { STATUS_VALUES } = require("../../chapterStatus");
const { MAX_CONCURRENT_PIPELINES, getState, setState, deleteState, cleanupStaleStateEntries } = require("./stateManager");
const { createPipelineLogger } = require("./pipelineLogger");
const { getHookBudgetForProject } = require("../../hookBudget");
const pipelineRegistry = require("../../pipelineRegistry");
const logger = require("../../../shared/logger");

async function initializePipeline(projectId, options = {}) {
    const _initCtx = await getDataContext(projectId);
    const project = await _initCtx.getProject();
    const _initGenre = resolveGenreFromProject(project);
    const _initConfig = resolveConfig(_initGenre, project);
    const modeMaxRounds = _initConfig.chapter.maxRounds;
    const { maxRounds = modeMaxRounds } = options;

    if ((await getState(projectId))?.running) {
        return { success: false, error: 'Pipeline already running for this project' };
    }

    const activeCount = Object.values(require("./stateManager").INFINITE_PIPELINE_STATE).filter(s => s.running).length;
    if (activeCount >= MAX_CONCURRENT_PIPELINES) {
        return { success: false, error: `Maximum ${MAX_CONCURRENT_PIPELINES} concurrent pipelines reached` };
    }

    await deleteState(projectId);
    cleanupStaleStateEntries();

    const existingPersisted = await store.getItem('infinite-pipeline-state', projectId);
    const actualCompletedCount = (await store.queryItems('chapters', { projectId })).filter(c => c.status === STATUS_VALUES.MATERIAL_UPDATED).length;
    await setState(projectId, { running: true, stopped: false, currentChapter: null, completedChapters: actualCompletedCount, supplementCount: existingPersisted?.supplementCount || 0, logs: [], lastError: null, phase: 'init', batchProgress: '' });

    const state = await getState(projectId);
    startHeartbeat(projectId, state);
    state._clearHeartbeat = () => clearHeartbeat(state);

    const { addLog } = createPipelineLogger(projectId, state);

    try {
        const allChapters = (await store.queryItems('chapters', { projectId })).sort((a, b) => a.chapterNumber - b.chapterNumber);
        const runPipelineStep = _getRunPipelineStep();
        await catchupMaterialManager(projectId, allChapters, runPipelineStep);
    } catch (startupErr) {
        logger.error('infinitePipeline', '启动时素材补跑失败:', { startupErrMessage: startupErr.message });
    }

    try {
        const hookBudget = getHookBudgetForProject(projectId);
        const cleanupResult = await hookBudget.cleanupInvalidHooks();
        if (cleanupResult.removed > 0) {
            addLog(`清理了${cleanupResult.removed}条无效伏笔记录，剩余${cleanupResult.remaining}条`);
        }
        const syncResult = await hookBudget.syncFromForeshadowingMaterials();
        if (syncResult > 0) {
            addLog(`从素材库同步了${syncResult}条伏笔到hookBudget`);
        }
    } catch (hookCleanErr) {
        logger.warn('infinitePipeline', 'Hook cleanup/sync failed:', { hookCleanErrMessage: hookCleanErr.message });
    }

    try {
        const existingMats = await store.queryItems('materials', { projectId });
        const activeMats = existingMats.filter(m => !m.archived);
        if (activeMats.length === 0) {
            addLog('素材库为空，自动生成初始素材...');
            try {
                const matResult = await generateInitialMaterials(projectId, '请根据项目描述生成完整的素材库，包括角色、世界观、装备、伏笔、名场面、金句等。');
                addLog(`生成了${matResult?.created?.length || 0}个初始素材`);
            } catch (matErr) {
                addLog(`生成初始素材失败: ${matErr.message}，继续生成大纲`);
            }
        }
    } catch (matCheckErr) {
        logger.warn('infinitePipeline', 'Material check failed:', { matCheckErrMessage: matCheckErr.message });
    }

    const waitWithStop = (ms) => {
        if (state.stopped) return Promise.resolve();
        let stopResolve;
        const stopPromise = new Promise(r => { stopResolve = r; });
        const timerPromise = new Promise(r => { setTimeout(r, ms); });
        const checker = setInterval(() => {
            if (state.stopped) { clearInterval(checker); stopResolve(); }
        }, 2000);
        return Promise.race([timerPromise, stopPromise]).finally(() => { clearInterval(checker); });
    };

    return { success: true, state, addLog, waitWithStop, maxRounds };
}

async function generateInitialOutlines(projectId, addLog) {
    const chapters = (await store.queryItems('chapters', { projectId })).sort((a, b) => a.chapterNumber - b.chapterNumber);
    if (chapters.length > 0) return { success: true, chapters };

    addLog('没有章节，生成初始大纲...');
    let outlineAttempts = 0;
    const maxOutlineAttempts = 3;
    let lastOutlineError = '';

    while (outlineAttempts < maxOutlineAttempts) {
        outlineAttempts++;
        try {
            const retryHint = outlineAttempts > 1 ? `（第${outlineAttempts}次尝试，上次失败原因：${lastOutlineError}。请严格遵守大纲生成规则）` : '';
            const project = await (await getDataContext(projectId)).getProject();
            // Schema-First：通过归一化函数读取targetChapters，兼容targetChapterCount历史字段名
            const { normalizeTargetChapters } = require("../../../config/targetChaptersNormalizer");
            const chapterTarget = normalizeTargetChapters(project) || 20;
            const initResult = await generateChapterOutlines(projectId, `请根据素材库规划前${chapterTarget}章的章节大纲，确保开篇即冲突、每章有钩子、主角主动行为${retryHint}`, chapterTarget);
            if (initResult.count > 0 || initResult.outlines?.length > 0) {
                addLog(`生成了${initResult.count} 章初始大纲`);
                return { success: true };
            } else {
                lastOutlineError = initResult.error || initResult.rhythmIssues?.join('；') || 'unknown';
                addLog(`生成初始大纲失败(第${outlineAttempts}次): ${lastOutlineError}`);
                if (outlineAttempts >= maxOutlineAttempts) {
                    addLog(`生成初始大纲失败，已重试${maxOutlineAttempts}次，停止`);
                    return { success: false, error: `Failed to generate initial outlines after ${maxOutlineAttempts} attempts: ${lastOutlineError}` };
                }
                addLog('将在5秒后重试...');
                await new Promise(r => setTimeout(r, LLM_DEFAULTS.outlineRetryDelayMs));
            }
        } catch (initErr) {
            lastOutlineError = initErr.message;
            addLog(`生成初始大纲异常(第${outlineAttempts}次): ${initErr.message}`);
            if (outlineAttempts >= maxOutlineAttempts) {
                return { success: false, error: initErr.message };
            }
            addLog('将在5秒后重试...');
            await new Promise(r => setTimeout(r, LLM_DEFAULTS.outlineRetryDelayMs));
        }
    }
    return { success: false, error: 'Failed to generate initial outlines' };
}

let _runPipelineStepRef = null;
function _getRunPipelineStep() {
    if (typeof _runPipelineStepRef === 'function') return _runPipelineStepRef;
    _runPipelineStepRef = pipelineRegistry.getStepFn();
    return _runPipelineStepRef;
}
function setRunPipelineStepRef(fn) { _runPipelineStepRef = fn; pipelineRegistry.registerStepFn(fn); }

module.exports = { initializePipeline, generateInitialOutlines, setRunPipelineStepRef };
