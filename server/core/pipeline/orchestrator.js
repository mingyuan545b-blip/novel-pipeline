const store = require('../../store');
const { getModeConfig } = require('../../services/contentUtils');
const { getModePipelineConfig } = require('../../services/pipelineConfig');
const { getInfinitePipelineStatus } = require('../../services/pipeline/infinitePipeline');
const { getCircuitBreaker } = require('../../services/reviewCircuitBreaker');
const { shouldOverrideReviewRejection } = require('../../services/pipeline/reviewOverride');
const { checkAlertLoop } = require('../../services/pipeline/pipelineUtils');
const { checkWordCountHardLimit, formatFeedbackText, runPostApproval } = require('../../services/pipeline/pipelineHelpers');
const { getChapterIntentPlanner } = require('../../services/chapterIntent');
const { getHookBudgetForProject } = require('../../services/hookBudget');
const { getRuleStackForProject } = require('../../services/ruleStack');
const { getContextTraceForProject } = require('../../services/contextTrace');
const { getMetrics } = require('../../services/metricsCollector');
const { AGENT_ROLE_NAMES } = require('../../services/fileOutput');
const pipelineRegistry = require('../../services/pipelineRegistry');
const logger = require('../../shared/logger');
const { DomainError } = require('../../shared/errors');

const MAX_PIPELINE_LOG_ENTRIES = 200;

class PipelineOrchestrator {
    constructor(config = {}) {
        this.config = config;
        this._runPipelineStepFn = null;
    }

    setRunPipelineStepFn(fn) {
        this._runPipelineStepFn = fn;
        pipelineRegistry.registerStepFn(fn);
    }

    _getRunPipelineStep() {
        if (typeof this._runPipelineStepFn === 'function') return this._runPipelineStepFn;
        try {
            this._runPipelineStepFn = pipelineRegistry.getStepFn();
            return this._runPipelineStepFn;
        } catch (e) {
            throw new DomainError('runPipelineStep is not available - circular dependency may have prevented module loading', 'STEP_FN_MISSING');
        }
    }

    _checkStopped(projectId, chapterNumber) {
        try {
            const state = getInfinitePipelineStatus(projectId);
            if (state && state.running && state.stopped) {
                logger.info('pipeline', `Stop signal detected for ch${chapterNumber}`);
                return true;
            }
        } catch (err) {
            logger.warn('pipeline', 'Check stopped error', { error: err.message });
        }
        return false;
    }

    _getSteps(mode) {
        if (mode === 'shuangwen' || mode === 'tomato-short') {
            return ['writer', 'fast-review', 'final-editor'];
        }
        return ['writer', 'first-review', 'second-review', 'final-editor'];
    }

    async _clearDownstreamOutputs(chapterId, failedStep) {
        const downstreamMap = {
            'writer': ['firstReviewOutput', 'secondReviewOutput', 'finalEditorOutput', 'reviserOutput', 'materialManagerOutput', 'polisherOutput'],
            'first-review': ['secondReviewOutput', 'finalEditorOutput', 'materialManagerOutput', 'polisherOutput'],
            'fast-review': ['finalEditorOutput', 'materialManagerOutput', 'polisherOutput'],
            'second-review': ['finalEditorOutput', 'materialManagerOutput', 'polisherOutput'],
            'final-editor': ['materialManagerOutput', 'polisherOutput']
        };
        const fields = downstreamMap[failedStep] || [];
        if (fields.length === 0) return;

        const ch = store.getItem('chapters', chapterId);
        if (!ch) return;

        let cleared = false;
        for (const f of fields) {
            if (ch[f]) {
                delete ch[f];
                cleared = true;
            }
        }
        if (cleared) {
            ch.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, ch);
            logger.info('pipeline', `${failedStep} failed, cleared downstream outputs`, { fields });
        }
    }

    _generateOverrideOutput(overrideReason, stepName, originalFeedback) {
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

    async _persistPipelineLog(chapterId, projectId, pipelineLog) {
        try {
            const logId = `${chapterId}_pipeline`;
            const entries = pipelineLog.map(e => ({
                ...e,
                timestamp: e.timestamp || new Date().toISOString()
            }));
            const trimmed = entries.length > MAX_PIPELINE_LOG_ENTRIES ? entries.slice(-150) : entries;
            await store.setItem('pipeline-logs', logId, {
                id: logId,
                chapterId,
                projectId,
                entries: trimmed,
                updatedAt: new Date().toISOString()
            });
        } catch (err) {
            logger.warn('pipeline', 'Failed to persist pipeline log', { error: err.message });
        }
    }

    async _runPreflightChecks(projectId, chapterId, pipelineLog, onStep) {
        const chapter = store.getItem('chapters', chapterId);
        if (!chapter || chapter.chapterNumber <= 1) return;

        // 补跑素材管理器
        const allPrevChapters = store.queryItems('chapters', { projectId })
            .filter(c => c.chapterNumber < chapter.chapterNumber)
            .sort((a, b) => a.chapterNumber - b.chapterNumber);

        for (const prevChapter of allPrevChapters) {
            if (prevChapter.status === 'approved' && (!prevChapter.materialManagerOutput || prevChapter.materialManagerFailed)) {
                logger.warn('pipeline', `Chapter ${prevChapter.chapterNumber} material manager not run, catching up`);
                try {
                    const result = await this._getRunPipelineStep()(projectId, prevChapter.id, 'material-manager', 1, { materialGuidance: '' });
                    prevChapter.materialManagerOutput = result?.feedback?.summary || '[补跑完成]';
                    prevChapter.materialManagerFailed = false;
                    delete prevChapter.materialManagerError;
                    prevChapter.status = 'material-updated';
                    prevChapter.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', prevChapter.id, prevChapter);
                    pipelineLog.push({ step: 'material-manager-catchup', chapterNumber: prevChapter.chapterNumber, status: 'completed', timestamp: new Date().toISOString() });
                    if (onStep) onStep({ step: 'material-manager-catchup', round: 0, passed: true, roleName: '素材管理(补跑)', feedback: result?.feedback || { summary: '补跑完成' } });
                } catch (err) {
                    logger.error('pipeline', `Material manager catchup failed for ch${prevChapter.chapterNumber}`, { error: err.message });
                    prevChapter._matManagerRetries = (prevChapter._matManagerRetries || 0) + 1;
                    if (prevChapter._matManagerRetries >= 3) {
                        prevChapter.status = 'material-updated';
                        prevChapter.materialManagerOutput = `[素材管理补跑失败${prevChapter._matManagerRetries}次，跳过]`;
                    }
                    await store.setItem('chapters', prevChapter.id, prevChapter);
                }
            }
        }

        // 恢复空素材
        const allMaterials = store.queryItems('materials', { projectId });
        const emptyMaterials = allMaterials.filter(m =>
            !m.archived && (!m.currentContent || m.currentContent.trim().length < 5) &&
            m.initialContent && m.initialContent.trim().length > 10
        );
        for (const em of emptyMaterials) {
            logger.warn('pipeline', `Material "${em.name}" content empty, restoring initialContent`);
            em.currentContent = em.initialContent;
            em.updatedAt = new Date().toISOString();
            await store.setItem('materials', em.id, em);
        }
    }

    async _handleChapterIntent(projectId, chapterId, chapterNumber, chapterOutline, options, pipelineLog, onStep) {
        try {
            const intentPlanner = getChapterIntentPlanner(projectId);
            let chapterIntent = intentPlanner.getIntent(chapterNumber);

            if (chapterIntent) {
                if (!store.getItem('chapters', chapterId)?.intentPlannerOutput) {
                    const intentText = intentPlanner.formatIntentForPrompt(chapterNumber);
                    const ch = store.getItem('chapters', chapterId);
                    ch.intentPlannerOutput = intentText;
                    await store.setItem('chapters', chapterId, ch);
                }
                if (onStep) {
                    onStep({ step: 'intent-planner', round: 0, passed: true, roleName: '意图规划', feedback: chapterIntent });
                }
                return chapterIntent;
            }

            logger.info('pipeline', `Generating chapter intent for chapter ${chapterNumber}`);
            chapterIntent = await intentPlanner.generateIntent(chapterNumber, chapterOutline, { apiConfig: options.apiConfig, scene: store.getItem('chapters', chapterId)?.scene });
            const intentText = intentPlanner.formatIntentForPrompt(chapterNumber);
            const ch = store.getItem('chapters', chapterId);
            ch.intentPlannerOutput = intentText;
            await store.setItem('chapters', chapterId, ch);

            if (onStep) {
                onStep({ step: 'intent-planner', round: 0, passed: true, roleName: '意图规划', feedback: chapterIntent });
            }
            return chapterIntent;
        } catch (err) {
            logger.warn('pipeline', 'Chapter intent generation failed', { error: err.message });
            pipelineLog.push({ step: 'intent-planner', status: 'error', error: err.message, timestamp: new Date().toISOString() });
            if (onStep) onStep({ step: 'intent-planner', round: 0, passed: false, roleName: '意图规划', feedback: { summary: `意图规划失败: ${err.message}` } });
            return null;
        }
    }

    async _syncHooksAndRules(projectId) {
        try {
            const hookBudget = getHookBudgetForProject(projectId);
            hookBudget.syncFromForeshadowingMaterials();
            const ruleStack = getRuleStackForProject(projectId);
            ruleStack.extractRulesFromMaterials();
        } catch (err) {
            logger.warn('pipeline', 'Hook/Rule sync failed', { error: err.message });
        }
    }

    async _executeStep(projectId, chapterId, step, round, context, options, pipelineLog, onStep) {
        const stepStartMs = Date.now();
        const result = await this._getRunPipelineStep()(projectId, chapterId, step, round, context);
        const durationMs = Date.now() - stepStartMs;

        pipelineLog.push(result);
        if (pipelineLog.length > MAX_PIPELINE_LOG_ENTRIES) {
            pipelineLog.splice(0, pipelineLog.length - MAX_PIPELINE_LOG_ENTRIES);
        }

        if (onStep) {
            const roleName = AGENT_ROLE_NAMES[step] || step;
            onStep({ step, round, passed: result.passed, roleName, feedback: result.feedback });
        }

        return { result, durationMs };
    }

    async _handleReviewOverride(step, stepResult, chapterId, projectId, chapterContent, sysWc, rejectMinWc, materials, project) {
        const overrideResult = shouldOverrideReviewRejection(stepResult, chapterContent, sysWc, rejectMinWc, materials, project);
        if (overrideResult.override) {
            logger.info('pipeline', `Review rejection overridden: ${overrideResult.reason}`);
            stepResult.passed = true;
            stepResult.feedback = stepResult.feedback || {};
            stepResult.feedback.approved = true;
            stepResult.feedback.summary = `系统覆盖通过：${overrideResult.reason}`;
            stepResult.feedback._overridden = true;
            stepResult.feedback._overrideReason = overrideResult.reason;

            const ch = store.getItem('chapters', chapterId);
            if (ch) {
                const outputField = step === 'first-review' ? 'firstReviewOutput' : 'secondReviewOutput';
                ch[outputField] = this._generateOverrideOutput(overrideResult.reason, step === 'first-review' ? '初审' : '复审', stepResult.feedback);
                await store.setItem('chapters', chapterId, ch);
            }
            return true;
        }
        return false;
    }

    async run(projectId, chapterId, maxRounds = 5, options = {}) {
        const project = store.getItem('projects', projectId);
        const mode = project?.mode || options.mode || 'novel';
        const modeConfig = getModeConfig(mode);
        const onStep = options.onStep || null;

        const steps = this._getSteps(mode);
        const minWordCount = getModePipelineConfig(mode).MIN_WORD_COUNT;
        const effectiveMaxRounds = Math.min(maxRounds, getModePipelineConfig(mode).MAX_ROUNDS);

        const pipelineLog = [];
        let materialGuidance = '';
        let lastFeedback = '';
        const allFeedbackParts = [];
        const rejectionTracker = {};
        steps.forEach(s => { rejectionTracker[s] = false; });

        const addFeedbackPart = (header, text) => {
            const existingIdx = allFeedbackParts.findIndex(p => p.startsWith(header));
            if (existingIdx >= 0) {
                allFeedbackParts[existingIdx] = header + '\n' + text;
            } else {
                allFeedbackParts.push(header + '\n' + text);
            }
        };

        // 预检
        await this._runPreflightChecks(projectId, chapterId, pipelineLog, onStep);

        let chapter = store.getItem('chapters', chapterId);
        const chapterNumber = chapter?.chapterNumber || 0;
        const chapterOutline = chapter?.outline || '';

        // 处理已有内容
        if (chapter.content && chapter.status === 'outlined') {
            const contentWc = chapter.content.replace(/\s/g, '').length;
            if (contentWc > 500) {
                chapter.status = 'written';
            } else {
                chapter.content = '';
                chapter.wordCount = 0;
            }
            chapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, chapter);
        }

        // 意图规划
        const chapterIntent = await this._handleChapterIntent(projectId, chapterId, chapterNumber, chapterOutline, options, pipelineLog, onStep);

        // 同步 Hooks 和 Rules
        await this._syncHooksAndRules(projectId);

        // 熔断器
        const circuitBreaker = getCircuitBreaker(projectId);
        const cbConfig = circuitBreaker.getAdjustedConfig();
        if (cbConfig.message) {
            logger.info('pipeline', `Circuit breaker: ${cbConfig.message}`);
        }

        // 主循环
        const startRound = (chapter.round && chapter.round > 0) ? chapter.round + 1 : 1;
        let retryCount = 0;

        for (let round = startRound; round <= effectiveMaxRounds + startRound - 1; round++) {
            await new Promise(r => setImmediate(r));

            chapter = store.getItem('chapters', chapterId) || chapter;

            // 检查停止信号
            if (this._checkStopped(projectId, chapterNumber)) {
                chapter.status = 'outlined';
                delete chapter.skipUntil;
                chapter.updatedAt = new Date().toISOString();
                await store.setItem('chapters', chapterId, chapter);
                await this._persistPipelineLog(chapterId, projectId, pipelineLog);
                return { success: false, rounds: round, log: pipelineLog, message: '流水线已停止' };
            }

            // 清除上一轮输出
            if (round > 1 || startRound === 1) {
                const clearFields = ['firstReviewOutput', 'secondReviewOutput', 'finalEditorOutput', 'reviserOutput', 'materialManagerOutput', 'polisherOutput'];
                let cleared = false;
                for (const f of clearFields) {
                    if (chapter[f]) {
                        delete chapter[f];
                        cleared = true;
                    }
                }
                if (cleared) {
                    chapter.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', chapterId, chapter);
                }
            }

            // Alert loop 检查
            if (round > 1) {
                const alertResult = checkAlertLoop(projectId);
                if (alertResult) {
                    logger.error('pipeline', `Alert loop triggered at round ${round}`);
                    if (circuitBreaker.isTripped() && round >= 5) {
                        await this._persistPipelineLog(chapterId, projectId, pipelineLog);
                        return { success: false, rounds: round, log: pipelineLog, message: '流水线熔断暂停', alertLoopReport: alertResult };
                    }
                }
            }

            let roundFailed = false;

            for (let step of steps) {
                // 检查停止信号
                if (this._checkStopped(projectId, chapterNumber)) {
                    chapter.status = 'outlined';
                    delete chapter.skipUntil;
                    chapter.updatedAt = new Date().toISOString();
                    await store.setItem('chapters', chapterId, chapter);
                    await this._persistPipelineLog(chapterId, projectId, pipelineLog);
                    return { success: false, rounds: round, log: pipelineLog, message: '流水线已停止' };
                }

                // 跳过 second-review 如果有 critical blocker
                if (step === 'second-review' && pipelineLog.find(l => l.step === 'first-review' && l.result?.feedback?._criticalBlocker)) {
                    logger.info('pipeline', 'Skipping second-review due to critical blocker');
                    continue;
                }

                // 字数硬拦截
                const wcCheck = checkWordCountHardLimit(step, chapterId, project, mode);
                if (wcCheck.blocked) {
                    pipelineLog.push(wcCheck.stepResult);
                    if (onStep) onStep({ step, round, passed: false, roleName: AGENT_ROLE_NAMES[step] || step, feedback: wcCheck.stepResult.feedback });
                    await this._clearDownstreamOutputs(chapterId, step);
                    roundFailed = true;
                    break;
                }

                try {
                    let context = {};

                    // 处理 writer/reviser 切换
                    if (round > 1 && step === 'writer') {
                        const multipleRejected = Object.values(rejectionTracker).filter(Boolean).length >= 2;
                        const feedbackToUse = multipleRejected && allFeedbackParts.length > 1
                            ? '【⚠ 多位审核者意见汇总，请同时满足所有修改要求】\n\n' + allFeedbackParts.join('\n\n')
                            : allFeedbackParts.join('\n\n') || lastFeedback;

                        context = { reviewFeedback: feedbackToUse.substring(0, 3000), mode };

                        const currentContent = chapter.content || '';
                        const currentWordCount = currentContent.length;
                        const rejectMinWords = (project?.wordConfig || {}).rejectMin || modeConfig.REJECT_MIN_WORDS || 1800;

                        if (currentWordCount >= rejectMinWords) {
                            logger.info('pipeline', `Word count OK (${currentWordCount}), using reviser`);
                            step = 'reviser';
                        }
                    } else {
                        context = { ...context, mode };
                    }

                    // 注入意图
                    if (step === 'writer' && chapterIntent) {
                        const intentPlanner = getChapterIntentPlanner(projectId);
                        context.chapterIntent = intentPlanner.formatIntentForPrompt(chapterNumber);
                    }

                    // 注入 hooks
                    if (step === 'writer') {
                        try {
                            const hookBudget = getHookBudgetForProject(projectId);
                            context.hookAgenda = hookBudget.formatHookAgendaForPrompt(chapterNumber);
                        } catch (e) {}
                    }

                    // 注入素材指导
                    if (step === 'material-manager' && materialGuidance) {
                        context.materialGuidance = materialGuidance;
                    }

                    logger.info('pipeline', `Round ${round}, Step: ${step}`);

                    // 执行步骤
                    const { result: stepResult } = await this._executeStep(projectId, chapterId, step, round, context, options, pipelineLog, onStep);

                    // 检查停止信号
                    if (this._checkStopped(projectId, chapterNumber)) {
                        chapter.status = 'outlined';
                        delete chapter.skipUntil;
                        chapter.updatedAt = new Date().toISOString();
                        await store.setItem('chapters', chapterId, chapter);
                        await this._persistPipelineLog(chapterId, projectId, pipelineLog);
                        return { success: false, rounds: round, log: pipelineLog, message: '流水线已停止' };
                    }

                    // 处理 writer 失败
                    if (step === 'writer' && !stepResult.passed) {
                        logger.info('pipeline', `Writer failed in round ${round}`);
                        lastFeedback = stepResult.feedback?.summary || '执笔人输出不达标';
                        addFeedbackPart('【执笔人反馈】', lastFeedback);
                        await this._clearDownstreamOutputs(chapterId, 'writer');
                        roundFailed = true;
                        break;
                    }

                    // 处理 final-editor
                    if (step === 'final-editor') {
                        materialGuidance = stepResult.materialGuidance || '';
                        const feApproved = stepResult.passed === true || stepResult.feedback?.approved === true || chapter.status === 'approved';

                        if (feApproved) {
                            chapter = store.getItem('chapters', chapterId);
                            if (chapter) {
                                chapter.normalContent = chapter.content;
                                chapter.status = 'approved';
                                chapter.updatedAt = new Date().toISOString();
                                await store.setItem('chapters', chapterId, chapter);
                            }

                            await runPostApproval(projectId, chapterId, chapter.chapterNumber, round, pipelineLog, onStep, {
                                mode, materialGuidance, generateImages: options.generateImages, imageAspectRatio: options.imageAspectRatio, chapterIntent, circuitBreaker
                            });
                            await this._persistPipelineLog(chapterId, projectId, pipelineLog);
                            return { success: true, rounds: round, log: pipelineLog, message: `Chapter approved after ${round} round(s)` };
                        } else {
                            logger.info('pipeline', `Final editor rejected in round ${round}`);
                            rejectionTracker['final-editor'] = true;

                            // 字数拒绝自动覆盖
                            const feSummary = (stepResult.feedback?.summary || '') + (stepResult.feedback?.scheduleNote || '');
                            const feIssues = stepResult.feedback?.issues || [];
                            const isWordCountRejection = /字数超限|字数过多|字数超标|超过.*字|超过上限|字数.*硬拦截/.test(feSummary) ||
                                feIssues.some(i => /字数超|字数过多|超过/.test(i.description || i.desc || ''));

                            if (isWordCountRejection) {
                                logger.warn('pipeline', 'Final-editor word-count rejection auto-overridden');
                                stepResult.passed = true;
                                stepResult.feedback.approved = true;
                                stepResult.feedback.summary = '系统覆盖通过：字数控制由流水线自动管理';
                                pipelineLog.push(stepResult);

                                chapter = store.getItem('chapters', chapterId) || chapter;
                                chapter.finalEditorOutput = this._generateOverrideOutput('字数控制由流水线自动管理', '定稿人', stepResult.feedback);
                                chapter.status = 'approved';
                                chapter.approvedAt = new Date().toISOString();
                                chapter.round = round;
                                await store.setItem('chapters', chapterId, chapter);

                                // 运行素材管理器
                                try {
                                    const mmResult = await this._getRunPipelineStep()(projectId, chapterId, 'material-manager', round, { materialGuidance });
                                    pipelineLog.push({ step: 'material-manager', status: 'completed', passed: mmResult.passed !== false, feedback: mmResult.feedback || { summary: '素材管理完成' }, timestamp: new Date().toISOString() });
                                    if (onStep) onStep({ step: 'material-manager', round, passed: true, roleName: '素材管理', feedback: mmResult.feedback || { summary: '素材管理完成' } });
                                } catch (mmErr) {
                                    logger.warn('pipeline', 'Material-manager failed after word-count override', { error: mmErr.message });
                                }

                                const mmChapter = store.getItem('chapters', chapterId);
                                if (mmChapter && mmChapter.status !== 'material-updated') {
                                    mmChapter.status = 'material-updated';
                                    mmChapter.updatedAt = new Date().toISOString();
                                    await store.setItem('chapters', chapterId, mmChapter);
                                }

                                await this._persistPipelineLog(chapterId, projectId, pipelineLog);
                                return { success: true, rounds: round, log: pipelineLog, message: 'Chapter approved (word-count override)' };
                            }

                            // 收集反馈
                            if (stepResult.feedback) {
                                const feedbackText = formatFeedbackText(stepResult.feedback);
                                lastFeedback = feedbackText;
                                addFeedbackPart('【定稿人意见】', feedbackText);
                            }
                            await this._clearDownstreamOutputs(chapterId, 'final-editor');
                            roundFailed = true;
                            break;
                        }
                    }

                    // 处理 first-review 失败
                    if (step === 'first-review' && !stepResult.passed) {
                        logger.info('pipeline', `First review failed in round ${round}`);
                        rejectionTracker['first-review'] = true;

                        const currentChapterContent = store.getItem('chapters', chapterId)?.content || '';
                        const currentSysWc = (currentChapterContent || '').replace(/\s/g, '').length;
                        const currentRejectMinWc = (project?.wordConfig || {}).rejectMin || modeConfig.REJECT_MIN_WORDS || 1800;
                        const currentMaterials = store.queryItems('materials', { projectId });

                        const overridden = await this._handleReviewOverride(step, stepResult, chapterId, projectId, currentChapterContent, currentSysWc, currentRejectMinWc, currentMaterials, project);

                        if (!overridden) {
                            const isWordCountOnly = stepResult.feedback?.issues?.every(i => i.desc && i.desc.includes('字数') && i.desc.includes('低于最低要求'));
                            if (!isWordCountOnly) {
                                circuitBreaker.recordFailure('first-review', chapter.chapterNumber);
                            }
                        }

                        if (!stepResult.passed && stepResult.feedback) {
                            const feedbackText = formatFeedbackText(stepResult.feedback);
                            lastFeedback = feedbackText;
                            addFeedbackPart('【初审意见】', feedbackText);
                        }
                        if (!stepResult.passed) {
                            await this._clearDownstreamOutputs(chapterId, 'first-review');
                            roundFailed = true;
                            break;
                        }
                    }

                    // 处理 fast-review 失败
                    if (step === 'fast-review' && !stepResult.passed) {
                        logger.info('pipeline', `Fast review failed in round ${round}`);
                        rejectionTracker['fast-review'] = true;
                        if (stepResult.feedback) {
                            const feedbackText = formatFeedbackText(stepResult.feedback);
                            lastFeedback = feedbackText;
                            addFeedbackPart('【快审意见】', feedbackText);
                        }
                        await this._clearDownstreamOutputs(chapterId, 'fast-review');
                        roundFailed = true;
                        break;
                    }

                    // 处理 second-review 失败
                    if (step === 'second-review' && !stepResult.passed) {
                        logger.info('pipeline', `Second review failed in round ${round}`);
                        rejectionTracker['second-review'] = true;

                        const currentChapterContent2 = store.getItem('chapters', chapterId)?.content || '';
                        const currentSysWc2 = (currentChapterContent2 || '').replace(/\s/g, '').length;
                        const currentRejectMinWc2 = (project?.wordConfig || {}).rejectMin || modeConfig.REJECT_MIN_WORDS || 1800;
                        const currentMaterials2 = store.queryItems('materials', { projectId });

                        const overridden2 = await this._handleReviewOverride(step, stepResult, chapterId, projectId, currentChapterContent2, currentSysWc2, currentRejectMinWc2, currentMaterials2, project);

                        if (!stepResult.passed && stepResult.feedback) {
                            const feedbackText = formatFeedbackText(stepResult.feedback);
                            lastFeedback = feedbackText;
                            addFeedbackPart('【复审意见】', feedbackText);
                        }
                        if (!stepResult.passed) {
                            await this._clearDownstreamOutputs(chapterId, 'second-review');
                            roundFailed = true;
                            break;
                        }
                    }

                } catch (error) {
                    logger.error('pipeline', `Error in round ${round}, step ${step}`, { error: error.message, stack: error.stack });

                    const isOverloaded = error.message && (error.message.includes('529') || error.message.includes('2064') || error.message.includes('负载较高') || error.message.includes('overloaded') || error.message.includes('rate limit'));
                    const isContextErr = error.isContextOverflow || (error.message && (error.message.includes('CONTEXT_OVERFLOW') || error.message.includes('context_length')));
                    const isTimeout = error.message && (error.message.includes('超时') || error.message.includes('timeout') || error.message.includes('ETIMEDOUT') || error.message.includes('aborted'));

                    const errorDetail = isOverloaded
                        ? `AI服务繁忙(529)，步${step}执行失败`
                        : isTimeout
                        ? `步骤${step}超时`
                        : isContextErr
                        ? `步骤${step}上下文溢出`
                        : `步骤${step}执行出错: ${error.message}`;

                    pipelineLog.push({ step, error: errorDetail, passed: false, isOverloaded, isTimeout, isContextErr, timestamp: new Date().toISOString() });

                    // 更新章节状态
                    try {
                        const errChapter = store.getItem('chapters', chapterId);
                        if (errChapter) {
                            if (isContextErr) {
                                errChapter.status = 'context-error';
                                errChapter.skipUntil = Date.now() + 1800000;
                            } else {
                                errChapter.status = 'pipeline-failed';
                            }
                            errChapter.updatedAt = new Date().toISOString();
                            await store.setItem('chapters', chapterId, errChapter);
                        }
                    } catch (saveErr) {
                        logger.warn('pipeline', 'Failed to update chapter status after error', { error: saveErr.message });
                    }

                    // 重试逻辑
                    if (isOverloaded || isTimeout) {
                        const waitMs = isOverloaded ? 60000 : 30000;
                        logger.info('pipeline', `${isOverloaded ? 'API繁忙' : '超时'}，等待${waitMs/1000}秒后重试`);
                        await new Promise(r => setTimeout(r, waitMs));
                        retryCount++;
                        if (retryCount > 3) {
                            await this._persistPipelineLog(chapterId, projectId, pipelineLog);
                            return { success: false, rounds: round, log: pipelineLog, error: errorDetail, isOverloaded, message: `连续${retryCount}次${isOverloaded ? 'API繁忙' : '超时'}，放弃当前章节` };
                        }
                        continue;
                    }

                    await this._persistPipelineLog(chapterId, projectId, pipelineLog);
                    return { success: false, rounds: round, log: pipelineLog, error: errorDetail, isOverloaded, message: errorDetail };
                }
            }
        }

        // 所有轮次结束仍未通过
        const isWordCountFailure = pipelineLog.some(l => l.feedback?.issues?.some(i => i.desc && i.desc.includes('字数') && i.desc.includes('低于最低要求')));
        const failedChapter = store.getItem('chapters', chapterId);
        if (failedChapter) {
            failedChapter.updatedAt = new Date().toISOString();
            await store.setItem('chapters', chapterId, failedChapter);
        }

        await this._persistPipelineLog(chapterId, projectId, pipelineLog);
        return {
            success: false,
            rounds: effectiveMaxRounds,
            log: pipelineLog,
            message: `定稿人经${effectiveMaxRounds}轮审核仍未通过`,
            lastFeedback,
            failureType: isWordCountFailure ? 'word-count' : 'review'
        };
    }
}

module.exports = { PipelineOrchestrator };
