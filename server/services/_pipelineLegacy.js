/**
 * 流水线核心服务 - Pipeline Service
 *
 * 负责管理AI小说创作的完整自动化流水线，包含5个Agent角色：
 * - writer (执笔人: 根据章节大纲和素材库创作正文
 * - first-review (初审): 审核正文与素材库的一致性
 * - second-review (复审): 审核逻辑、字数和风格
 * - final-editor (定稿人: 最高裁定权限，控制IP方向
 * - material-manager (素材管理员: 管理和更新素材库
 *
 * 流水线执行流程：
 * 1. 用户输入需求生成素材库生成章节大纲
 * 2. 每章循环：执笔人 → 初审 → 复审 → 定稿人 → 素材更新
 * 3. 未通过则重写（携带审核反馈），直到通过或达到最大轮次
 *
 * 数据存储：使用JSON文件存储（server/store.js），位于 data/ 目录
 * AI模型：通过MiniMax API调用（server/services/llm.js）
 */
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const store = require('../store');
const llm = require('../services/llm');
const { getVolumeOrder, getVolumeSubplane, getVisibleMaterials, enforceVolumeSubplaneLocks, buildVolumeRhythmGuidance } = require('./pipeline/volumeHelpers');
const { validateOutlineRhythm, buildGenreOutlineInjection } = require('./pipeline/outlineHelpers');
const { checkAlertLoop, runBranchingWrite } = require('./pipeline/pipelineUtils');
const { generateInitialMaterials, parseMarkdownOutlines, generateChapterOutlines, generateFromTemplate, supplementChapterOutlines } = require('./pipeline/outlineGenerator');
const { runInfinitePipeline, stopInfinitePipeline, forceResetPipeline, getInfinitePipelineStatus, setRunFullPipelineRef } = require('./pipeline/infinitePipeline');
const { runAgent: _runAgent } = require('./pipeline/agentRunner');
const { handleMaterialManager } = require('./pipeline/steps/materialManager');
const { handleWriter } = require('./pipeline/steps/writer');
const { handleFirstReview, handleFastReview, handleSecondReview } = require('./pipeline/steps/review');
const { runFullPipeline: _runFullPipeline } = require('./pipeline/fullPipeline');

setRunFullPipelineRef(_runFullPipeline);

async function runAgent(agentType, context) {
    return _runAgent(agentType, context);
}

function getOutlineApiConfig() {
    if (process.env.LLM_PROVIDER === 'lmstudio') {
        return { provider: 'lmstudio', apiKey: 'lmstudio', model: process.env.LMSTUDIO_MODEL || 'default', baseURL: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1' };
    }
    if (process.env.LLM_PROVIDER === 'deepseek' && process.env.DEEPSEEK_API_KEY) {
        return { provider: 'deepseek', apiKey: process.env.DEEPSEEK_API_KEY, model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com' };
    }
    const aliyunKey = process.env.ALIYUN_CODING_API_KEY;
    if (aliyunKey) {
        return { provider: 'aliyunCoding', apiKey: aliyunKey, model: process.env.ALIYUN_CODING_MODEL || 'qwen3.6-plus', baseURL: 'https://coding.dashscope.aliyuncs.com/v1' };
    }
    if (process.env.MINIMAX_API_KEY) {
        return { provider: 'minimax', apiKey: process.env.MINIMAX_API_KEY, groupId: process.env.MINIMAX_GROUP_ID || '', model: process.env.MINIMAX_MODEL || 'MiniMax-M2.7', baseURL: 'https://api.minimaxi.com/v1' };
    }
    return undefined;
}
const imageGen = require('../services/imageGen');
const memory = require('../services/memory');
const stateSnapshot = require('../services/stateSnapshot');
const consistency = require('../services/consistency');
const { AGENT_PROMPTS, SHUANGWEN_AGENT_PROMPTS, TOMATO_SHORT_AGENT_PROMPTS, CONSTRAINT_PRESETS, buildConstraintInjection, buildFoundationPrompt, buildStyleInjection, getStyleProfileForProject, getAgentPrompt, deduplicateSystemPrompt } = require('./agentPrompts');
const { MAX_CHAPTER_WORDS, MODE_CONFIGS, getModeConfig, deduplicateContent, truncateChapter, cleanFinalContent, cleanChapterContent, ensureCliffhanger, validateTomatoMetrics, detectTellVerbs, extractEndingTension, calcInfoDripScore, detectModernSlang, detectAdultPerspective, detectTechJargon, detectPipelineMetadataLeak, detectCrossChapterRepetition, detectOnomatopoeiaDensity, detectVisualAnchors, detectMotherChildDialogue } = require('./contentUtils');
const { extractJSON } = require('./jsonUtils');
const { detectGenre, runGenreFirstReviewIntercept, runGenreSecondReviewIntercept, getGenreWriterInjection, getGenreReviewRules, getGenrePerspectiveSchema, validateNewMaterial, validateChapterContent, getGenrePlugin } = require('./genreConfig');
const llmConfig = require('./llmConfig');
const { OUTPUT_DIR, AGENT_ROLE_NAMES, ensureOutputDir, getChapterFileName, saveAgentOutput, saveFinalContent, getAgentOutputPaths } = require('./fileOutput');

const { ContextBudget, estimateTokens, truncateToTokens, COMPACT_PRIORITIES, LONG_PRIORITIES, ULTRA_LONG_PRIORITIES } = require('./contextBudget');
const trendingSearch = require('./trendingSearch');
const reviewRemediation = require('./reviewRemediation');
const materialIndex = require('./materialIndex');
const { validateMaterial, getMaterialValidationPrompt } = require('./materialValidator');
const { getCircuitBreaker } = require('./reviewCircuitBreaker');
const { createVersionTag } = require('./versionControl');
const { getMetrics } = require('./metricsCollector');
const { PIPELINE_CONFIG, getModePipelineConfig } = require('./pipelineConfig');
const techIndex = require('./techIndex');
const { ValidationEngine } = require('./validationEngine');
const { getBeatAllocator } = require('./beatAllocator');
const { getHookBudgetForProject } = require('./hookBudget');
const { getRuleStackForProject } = require('./ruleStack');
const { getContextTraceForProject } = require('./contextTrace');
const { getChapterIntentPlanner } = require('./chapterIntent');
const { scanContent: scanSensitiveWords } = require('./sensitiveWordGuard');
const promptAuditor = require('./promptAuditor');

const { CHAPTER_STATUS, STUCK_STATUSES, validateStatusConsistency } = require('./chapterStatus');

async function runPipelineStep(projectId, chapterId, step, round, context = {}) {
    let chapter = store.getItem('chapters', chapterId);
    if (!chapter) throw new Error('Chapter not found');

    let roundFailed = false;
    const allFeedbackParts = [];

    const materials = (step === 'writer')
        ? materialIndex.getMaterialsForScene(projectId, chapter.scene || '主世界', chapter.chapterNumber)
        : getVisibleMaterials(projectId, chapter.chapterNumber, { purpose: 'review' }).materials;
    const project = store.getItem('projects', projectId);
    const mode = project?.mode || context.mode || 'novel';
    const modeConfig = getModeConfig(mode);
    const projectWordConfig = project?.wordConfig || {};
    const maxChapterWords = projectWordConfig.maxWords || modeConfig.MAX_CHAPTER_WORDS;

    const agentKeyConfig = store.getItem('api-keys', `agent-${step}`);
    const apiConfig = llmConfig.resolveStepConfig(step, project);

    const model = apiConfig?.model || process.env.LLM_MODEL || process.env.MINIMAX_MODEL || 'default';

    const budget = new ContextBudget(model, context.maxTokens || 8192);
    budget.allocate('agent_prompt', getAgentPrompt(step, mode, projectId)?.system || '');

    const priorities = budget.isUltraLongContext ? ULTRA_LONG_PRIORITIES : (budget.isLongContext ? LONG_PRIORITIES : COMPACT_PRIORITIES);
    const memorySlotBudget = Math.floor(budget.inputBudget * (priorities.memory_context.maxRatio));

    const recentWindowSize = budget.isUltraLongContext ? 10 : 5;
    const maxMemoryTokens = budget.isUltraLongContext ? memorySlotBudget * 2 : memorySlotBudget;

    let memoryContextStr = '';
    try {
        const assembledContext = await memory.assembleContext(
            projectId,
            chapter.chapterNumber,
            chapter.outline || '',
            model,
            { mentionedCharacters: [], recentWindowSize, maxTokens: maxMemoryTokens }
        );
        memoryContextStr = memory.formatContextForPrompt(assembledContext);
    } catch (memErr) {
        console.warn('[PIPELINE] Memory context assembly failed:', memErr.message);
    }

    const _chapterScene = chapter.scene || '主世界';
    const _volumeInfo = getVolumeSubplane(projectId, chapter.chapterNumber);
    const _currentSubplaneId = _volumeInfo ? _volumeInfo.subplaneId : null;
    const _isInSubplane = _chapterScene !== '主世界' && _chapterScene !== '';

    if (memoryContextStr) {
        const otherSubplaneCharNames = new Set();
        const allMats = store.queryItems('materials', { projectId });
        allMats.filter(m => m.type === 'character' && m.parentPlane && m.parentPlane !== '主世界' && m.parentPlane !== _currentSubplaneId)
            .forEach(m => otherSubplaneCharNames.add(m.name));
        if (otherSubplaneCharNames.size > 0) {
            const lines = memoryContextStr.split('\n');
            const filteredLines = lines.filter(line => {
                for (const name of otherSubplaneCharNames) {
                    if (line.includes(name)) return false;
                }
                return true;
            });
            memoryContextStr = filteredLines.join('\n');
        }
    }

    const memoryCoveredTypes = new Set(['character', 'worldview', 'power-system', 'relationship', 'foreshadowing', 'growth-history', 'equipment', 'faction']);
    const nonMemoryMaterials = materials.filter(m => !memoryCoveredTypes.has(m.type));
    const materialsData = nonMemoryMaterials.reduce((acc, m) => {
        if (!acc[m.type]) acc[m.type] = [];
        const content = (m.currentContent || '').substring(0, 150);
        const entry = { n: m.name, c: content, t: m.tags };
        if (m.parentPlane) entry.pp = m.parentPlane;
        if (m.parentFaction) entry.pf = m.parentFaction;
        acc[m.type].push(entry);
        return acc;
    }, {});

    const agentContext = {
        ...context,
        projectId,
        mode,
        materials: Object.keys(materialsData).length > 0 ? materialsData : undefined,
        memoryContext: memoryContextStr.length > 100 ? memoryContextStr : undefined,
        apiConfig
    };

    const allChapters = store.queryItems('chapters', { projectId }).filter(c => !c.archived).sort((a, b) => a.chapterNumber - b.chapterNumber);
    const chapterIndex = allChapters.findIndex(c => c.id === chapterId);

    if (chapterIndex > 0) {
        const prevChapter = allChapters[chapterIndex - 1];
        agentContext.previousChapter = (prevChapter.content || '').substring(0, 1500);
    }

    let result;

    console.log(`[PIPELINE] runPipelineStep: step=${step}, chapter=${chapterId}, round=${round}, materialsCount=${materials.length}`);

    if (step === 'writer' && round > 1 && chapter.content) {
        const currentSnapshot = {
            round: chapter.round || 1,
            content: (chapter.content || '').substring(0, 500),
            wordCount: (chapter.content || '').length,
            status: chapter.status,
            timestamp: new Date().toISOString()
        };
        if (!chapter.history) chapter.history = [];
        chapter.history.push(currentSnapshot);
        if (chapter.history.length > 8) {
            chapter.history = chapter.history.slice(-8);
        }
    }

    switch (step) {
        case 'writer': {
            const writerResult = await handleWriter({ projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput, round, mode, modeConfig, maxChapterWords, budget });
            if (writerResult.passed) {
                Object.assign(chapter, writerResult.chapter);
                result = writerResult.result || { response: chapter.content };
            } else {
                Object.assign(chapter, writerResult.chapter);
                return writerResult;
            }
            break;
        }
        case 'first-review': {
            const frResult = await handleFirstReview({ projectId, chapter, agentContext, runAgent, saveAgentOutput, round, roundFailed, allFeedbackParts, chapterId });
            if (frResult.roundFailed) { roundFailed = true; if (frResult.feedbackPart) allFeedbackParts.push(frResult.feedbackPart); }
            if (!frResult.passed) return frResult;
            result = frResult.result || { response: chapter.firstReviewOutput };
            break;
        }
        case 'fast-review': {
            const fstrResult = await handleFastReview({ projectId, chapter, agentContext, runAgent, saveAgentOutput, round, mode, chapterId });
            if (fstrResult.roundFailed) { roundFailed = true; if (fstrResult.feedbackPart) allFeedbackParts.push(fstrResult.feedbackPart); }
            if (!fstrResult.passed) return fstrResult;
            result = fstrResult.result || { response: chapter.firstReviewOutput };
            break;
        }
        case 'second-review': {
            const srResult = await handleSecondReview({ projectId, chapter, agentContext, runAgent, saveAgentOutput, round, chapterId });
            if (srResult.roundFailed) { roundFailed = true; if (srResult.feedbackPart) allFeedbackParts.push(srResult.feedbackPart); }
            if (!srResult.passed) return srResult;
            result = srResult.result || { response: chapter.secondReviewOutput };
            break;
        }
        case 'final-editor': {
            const _feStyleProfile = getStyleProfileForProject(projectId);
            const _feReviewRules = getGenreReviewRules(detectGenre(_feStyleProfile));
            const _fePerspectiveRule = _feReviewRules?.finalEditor?.perspectiveRule || '';
            agentContext.content = `【任务】你是定稿人，请定稿，绝不输出小说正文。\n\n【正文（仅供审核参考）】\n系统实际字数：${(chapter.content || '').length}字（此为系统精确计算，以此为准，忽略初审/复审中的估算字数）\n前500字：${(chapter.content || '').substring(0, 500)}\n末500字：${(chapter.content || '').substring(Math.max(0, (chapter.content || '').length - 500))}\n\n【初审结果】\n${(chapter.firstReviewOutput || '').substring(0, 1500)}\n\n【复审结果】\n${(chapter.secondReviewOutput || '').substring(0, 1500)}${reviewRemediation.getReviewPromptInjection(projectId)}\n${_fePerspectiveRule ? '\n' + _fePerspectiveRule + '\n' : ''}\n【输出格式】先输出可读Markdown定稿意见，末尾附JSON数据块：\n${'```'}json\n{"approved":true/false,"action":"approve/reject/revise","edits":[],"ipDirection":"","materialGuidance":"","scheduleNote":""}\n${'```'}`;
            result = await runAgent('final-editor', agentContext);
            chapter.finalEditorOutput = result.response;
            chapter.status = 'final-editing';
            saveAgentOutput(projectId, chapter, 'final-editor', result.response);
            try {
                const parsed = extractJSON(result.response);
                if (!parsed) throw new Error('JSON extraction failed');
                const revId3 = uuidv4();
                await store.setItem('reviews', revId3, {
                    id: revId3,
                    chapterId,
                    projectId,
                    step: 'final-editor',
                    type: 'final-editor',
                    reviewer: 'final-editor-agent',
                    result: parsed,
                    passed: !!parsed.approved,
                    content: parsed.summary || parsed.scheduleNote || '',
                    issues: parsed.edits || [],
                    suggestions: parsed.suggestions || [],
                    round,
                    createdAt: new Date().toISOString()
                });
                if (parsed.approved) {
                    try { getMetrics(projectId).recordAgentPassRate('final-editor', true, chapter.chapterNumber); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }

                    const endingCheck = extractEndingTension(chapter.content || '');
                    if (!endingCheck.hasTension) {
                        console.warn(`[PIPELINE] Final-editor approved but ending lacks tension. Last para: ${endingCheck.lastParagraph}`);
                        if (!parsed.edits) parsed.edits = [];
                        parsed.edits.push({ priority: 'medium', description: `章节收尾缺乏张力点（悬念/抉择/伏笔/转折），建议在末段增加未闭合张力`, type: 'ending-tension' });
                    }

                    const tellCheck = detectTellVerbs(chapter.content || '');
                    if (tellCheck.count > 3) {
                        console.warn(`[PIPELINE] Tell-verb density high: ${tellCheck.count} instances (density: ${tellCheck.density}/千字)`);
                    }

                    chapter.status = 'approved';
                    chapter.content = cleanFinalContent(chapter.content || '');
                    chapter.wordCount = chapter.content.replace(/\s/g, '').length;

                    const feMaxWords = (store.getItem('projects', projectId)?.wordConfig || {}).maxWords || modeConfig.MAX_CHAPTER_WORDS || 3500;
                    if (chapter.wordCount > feMaxWords) {
                        console.warn(`[PIPELINE] Final-editor后字数超限: ${chapter.wordCount}字 > 上限${feMaxWords}字，截断`);
                        chapter.content = truncateChapter(chapter.content, feMaxWords).content;
                        chapter.wordCount = chapter.content.replace(/\s/g, '').length;
                    }
                    saveFinalContent(projectId, chapter);
                }

                const relatedQuests = store.listItems('quests').filter(q =>
                    q.projectId === projectId && (q.chapterIds || []).includes(chapterId)
                );
                if (relatedQuests.length > 0) {
                    const quest = relatedQuests[0];
                    if (parsed.approved) {
                        await store.setItem('quests', quest.id, {
                            ...quest,
                            status: 'completed',
                            progress: 100,
                            completedAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                    } else {
                        await store.setItem('quests', quest.id, {
                            ...quest,
                            status: 'active',
                            updatedAt: new Date().toISOString()
                        });
                    }
                }

                if (parsed.ipDirection) {
                    const existingTimelines = store.listItems('timelines').filter(t => t.projectId === projectId);
                    const tlId1 = uuidv4();
                    await store.setItem('timelines', tlId1, {
                        id: tlId1,
                        projectId,
                        title: `第${chapter.chapterNumber}章IP方向`,
                        description: typeof parsed.ipDirection === 'string' ? parsed.ipDirection.substring(0, 500) : JSON.stringify(parsed.ipDirection).substring(0, 500),
                        eventType: 'revelation',
                        storyOrder: existingTimelines.length,
                        sortOrder: existingTimelines.length,
                        storyTime: `第${chapter.chapterNumber}章`,
                        chapterIds: [chapterId],
                        questIds: relatedQuests.map(q => q.id),
                        materialIds: [],
                        characterIds: [],
                        location: '',
                        importance: 'high',
                        isKeyEvent: true,
                        notes: '',
                        tags: ['auto-generated', 'ip-direction'],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
                chapter.updatedAt = new Date().toISOString();
                await store.setItem('chapters', chapterId, chapter);
                return {
                    step,
                    result,
                    passed: parsed.approved,
                    feedback: parsed,
                    materialGuidance: parsed.materialGuidance,
                    ipDirection: parsed.ipDirection
                };
            } catch (e) {
                console.warn('[PIPELINE] final-editor JSON parse failed, fallback to markdown analysis');
                const text = result.response || '';
                const hasPipelineBlock = /\[PIPELINE_BLOCK:/.test(text);
                const isNovelContent = text.length > 500 && !hasPipelineBlock && !/\{/.test(text.substring(0, 50));
                let fallbackApproved = false;
                if (hasPipelineBlock) {
                    fallbackApproved = false;
                } else if (isNovelContent) {
                    console.warn('[PIPELINE] final-editor returned novel content instead of review, treating as rejection');
                    fallbackApproved = false;
                } else {
                    const hasApproval = /通过|批准|approved|✅|合格|达标/.test(text);
                    const hasRejection = /不通过|拒绝|rejected|❌/.test(text);
                    const hasCriticalIssue = /严重|矛盾|逻辑错误|人设崩塌|视角混乱|critical/.test(text);
                    if (hasCriticalIssue) {
                        fallbackApproved = false;
                    } else if (hasApproval && !hasRejection) {
                        fallbackApproved = true;
                    } else if (hasApproval && hasRejection) {
                        const formatOnly = /进度追踪|合作约定|断章.*格式|格式.*模块|缺失.*模块/.test(text);
                        fallbackApproved = formatOnly;
                    } else {
                        fallbackApproved = false;
                    }
                }
                const fallbackFeedback = {
                    approved: fallbackApproved,
                    action: fallbackApproved ? 'approve' : 'reject',
                    summary: hasPipelineBlock ? `定稿阻断（PIPELINE_BLOCK: ${text.match(/\[PIPELINE_BLOCK:([^\]]*)/)?.[1] || ''}）` : (isNovelContent ? '定稿人返回了小说正文而非审核结果，视为拒绝' : (fallbackApproved ? '定稿通过（Markdown格式）' : '定稿未通过（Markdown格式）')),
                    edits: fallbackApproved ? [] : [{ description: hasPipelineBlock ? text.match(/\[PIPELINE_BLOCK:([^\]]*)/)?.[1] || '阻断问题' : (isNovelContent ? '定稿人未返回JSON审核结果' : '审核返回Markdown格式'), severity: 'critical' }]
                };
                const revIdFEfb = uuidv4();
                await store.setItem('reviews', revIdFEfb, {
                    id: revIdFEfb,
                    chapterId,
                    projectId,
                    step: 'final-editor',
                    type: 'final-editor',
                    reviewer: 'final-editor-agent',
                    result: fallbackFeedback,
                    passed: fallbackApproved,
                    content: fallbackFeedback.summary,
                    issues: fallbackFeedback.edits,
                    suggestions: [],
                    round,
                    createdAt: new Date().toISOString()
                });
                if (fallbackApproved) {
                    chapter.status = 'approved';
                    chapter.content = cleanFinalContent(chapter.content || '');
                    chapter.wordCount = chapter.content.replace(/\s/g, '').length;
                    const fbMaxWords = (store.getItem('projects', projectId)?.wordConfig || {}).maxWords || modeConfig.MAX_CHAPTER_WORDS || 3500;
                    if (chapter.wordCount > fbMaxWords) {
                        console.warn(`[PIPELINE] Final-editor(fallback)后字数超限: ${chapter.wordCount}字 > 上限${fbMaxWords}字，截断`);
                        chapter.content = truncateChapter(chapter.content, fbMaxWords).content;
                        chapter.wordCount = chapter.content.replace(/\s/g, '').length;
                    }
                    saveFinalContent(projectId, chapter);
                }
                chapter.updatedAt = new Date().toISOString();
                await store.setItem('chapters', chapterId, chapter);
                return {
                    step,
                    result,
                    passed: fallbackApproved,
                    feedback: fallbackFeedback,
                    materialGuidance: ''
                };
            }
            break;
        }
        case 'material-manager': {
            const mmResult = await handleMaterialManager({ projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput });
            result = { response: mmResult.response };
            return {
                step,
                result,
                passed: mmResult.passed !== false,
                feedback: mmResult.feedback || { summary: '素材管理完成', updates: [] },
                materialUpdates: mmResult.updates || []
            };
        }
        case 'reviser': {
            const chapterContent = chapter.content || '';
            agentContext.chapterContent = chapterContent;
            agentContext.chapterOutline = (chapter.outline || '').substring(0, 1000);

            const feedbackMentions = [];
            const feedbackText = context.reviewFeedback || '';
            const mentionPatterns = [/[\u4e00-\u9fa5]{2,10}/g];
            const activeMaterials = materials.filter(m => m.projectId === projectId && !m.archived);
            const mentionedNames = new Set();
            activeMaterials.forEach(m => {
                if (feedbackText.includes(m.name)) {
                    mentionedNames.add(m.name);
                }
            });
            const relevantMats = activeMaterials.filter(m => mentionedNames.has(m.name));
            if (relevantMats.length > 0) {
                const relevantSummary = relevantMats.map(m =>
                    `[${m.type}]${m.name}:${(m.currentContent || '').substring(0, 200)}`
                ).join('\n');
                agentContext.relevantMaterials = `【相关素材（仅审核反馈中提及的）】\n${relevantSummary}`;
            }

            const coreSettingMats = activeMaterials.filter(m => ['worldview', 'power-system', 'craft'].includes(m.type));
            if (coreSettingMats.length > 0) {
                const coreSettingsText = coreSettingMats.map(m =>
                    `--- ${m.name} ---\n${(m.currentContent || '').substring(0, 800)}`
                ).join('\n\n');
                agentContext.coreSettings = `【⚠️ 核心设定 - 修改时必须遵守】\n${coreSettingsText}`;
            }

            const _reviserProj = store.getItem('projects', projectId);
            const _reviserGenre = detectGenre(_reviserProj?.styleProfile);
            const _reviserReviewRules = getGenreReviewRules(_reviserGenre);
            const _reviserTerminologyDimmingRule = _reviserReviewRules?.reviser?.terminologyDimmingRule || '';
            const _reviserPerspectiveRule = _reviserReviewRules?.reviser?.perspectiveRule || '';
            const _reviserRepairRules = _reviserReviewRules?.reviser?.repairRules || '';
            const _reviserStyleRule = _reviserGenre?.styleProfile?.behaviorRule
                ? '禁止在修改中引入与题材风格不符的表述'
                : '禁止在修改中引入与题材风格不符的表述';

            agentContext.content = `请根据审核反馈对正文进行精准修改。

${agentContext.coreSettings || ''}

【当前正文】
${chapterContent.substring(0, 12000)}

【审核反馈（必须逐条修改以下所有问题，不可遗漏任何一条）】
${feedbackText.substring(0, 4000)}

【修改规则 - 极其重要】
1. 必须逐条修改反馈中列出的每一个问题，不可跳过或遗漏任何一条
2. 每个问题必须定位到原文具体位置，替换为反馈中建议的改法
3. 修改后必须保持上下文连贯，不能出现断裂或重复
4. 修改后字数不得低于原文字数的95%，若原文字数不足目标区间则必须扩充
5. ${_reviserStyleRule}
6. 直接输出修改后的完整正文，不要加任何标题标记（如"修改后的正文"等）
7. 严禁在修改中引入新的视角越界、系统机制直述或信息注入节奏违规
${_reviserTerminologyDimmingRule ? '\n' + _reviserTerminologyDimmingRule + '\n' : ''}
${_reviserPerspectiveRule ? '\n' + _reviserPerspectiveRule + '\n' : ''}
${_reviserRepairRules ? '\n' + _reviserRepairRules + '\n' : ''}`;

            result = await runAgent('reviser', agentContext);
            console.log(`[PIPELINE] Reviser response length: ${(result.response || '').length}`);
            if (result.response) {
                let reviserContent = cleanChapterContent(result.response);
                const originalContent = chapter.content || chapter.writerOutput || '';
                const originalWordCount = originalContent.replace(/\s/g, '').length;
                const reviserWordCount = reviserContent.replace(/\s/g, '').length;
                const modeConfig = getModeConfig(mode);
                const rejectMin = modeConfig.REJECT_MIN_WORDS || 1200;
                const targetMin = modeConfig.TARGET_MIN_WORDS || rejectMin;

                if (reviserWordCount < rejectMin && originalWordCount >= rejectMin) {
                    console.warn(`[PIPELINE] reviser字数异常: ${reviserWordCount}字 < 最低${rejectMin}字，原文${originalWordCount}字，回退到原文`);
                    reviserContent = originalContent;
                } else if (reviserWordCount < targetMin && reviserWordCount >= rejectMin && originalWordCount >= targetMin) {
                    console.warn(`[PIPELINE] reviser字数低于目标: ${reviserWordCount}字 < 目标${targetMin}字，原文${originalWordCount}字，保留原文避免审核死循环`);
                    reviserContent = originalContent;
                } else if (reviserWordCount < originalWordCount * 0.5 && originalWordCount > 500) {
                    console.warn(`[PIPELINE] reviser字数骤降: ${reviserWordCount}字 仅为原文${originalWordCount}字的${(reviserWordCount/originalWordCount*100).toFixed(0)}%，回退到原文`);
                    reviserContent = originalContent;
                }

                const maxChapterWords = (project?.wordConfig || {}).maxChapter || getModeConfig(mode).MAX_CHAPTER_WORDS || 3500;
                const reviserCleanWc = reviserContent.replace(/\s/g, '').length;
                if (reviserCleanWc > maxChapterWords) {
                    console.warn(`[PIPELINE] reviser字数超限: ${reviserCleanWc}字 > 上限${maxChapterWords}字，截断到上限`);
                    const sentences = reviserContent.match(/[^。！？\n]+[。！？\n]?/g) || [reviserContent];
                    let truncated = '';
                    for (const s of sentences) {
                        if ((truncated + s).replace(/\s/g, '').length > maxChapterWords) break;
                        truncated += s;
                    }
                    if (truncated.replace(/\s/g, '').length >= rejectMin) {
                        reviserContent = truncated.trim();
                        console.log(`[PIPELINE] 截断后字数: ${reviserContent.replace(/\s/g, '').length}`);
                    } else {
                        console.warn(`[PIPELINE] 截断后字数不足最低要求，回退到原文`);
                        reviserContent = originalContent;
                    }
                }

                chapter.content = reviserContent;
                chapter.writerOutput = reviserContent;
                chapter.reviserOutput = reviserContent;
                chapter.reviserOutputRaw = result.response.substring(0, 5000);
                chapter.round = round;
                chapter.wordCount = reviserContent.replace(/\s/g, '').length;
                const dedup = deduplicateContent(reviserContent);
                if (dedup.removed > 0) {
                    chapter.content = dedup.content;
                    chapter.wordCount = dedup.content.replace(/\s/g, '').length;
                }
                saveAgentOutput(projectId, chapter, 'reviser', result.response);
                console.log(`[PIPELINE] Reviser saved: ${reviserWordCount} chars (original: ${originalWordCount})`);
            } else {
                console.warn('[PIPELINE] Reviser returned empty response - marking as failed');
                chapter.reviserOutput = '[返修员返回空响应，保留原文]';
                return { step, result, passed: false, feedback: { summary: '返修员返回空响应，审核问题未被修复', issues: [{ desc: '返修员返回空响应', severity: 'high' }], suggestions: [] } };
            }
            break;
        }
        case 'polisher': {
            agentContext.content = `请润色以下已通过审核的正文。

【规则】
1. 只做文采提升，不改变剧情/人物/设定/字数
2. 只输出润色后的正文，不输出任何分析、注释、说明、比较、思考过程
3. 不要逐段分析原文，不要标注修改了哪里，不要解释为什么这样改
4. 直接输出完整的润色后正文，格式与原文一致

【正文】
${(chapter.content || '').substring(0, 8000)}`;
            result = await runAgent('polisher', agentContext);
            chapter.polisherOutput = cleanChapterContent(result.response);
            saveAgentOutput(projectId, chapter, 'polisher', chapter.polisherOutput);
            break;
        }
        case 'reader': {
            const chapterNum = chapter.chapterNumber;
            const readStart = Math.max(1, chapterNum - 14);
            const readEnd = chapterNum;
            const allChaptersForRead = store.queryItems('chapters', { projectId })
                .filter(c => !c.archived)
                .sort((a, b) => a.chapterNumber - b.chapterNumber);

            const recentChapters = allChaptersForRead.filter(
                c => c.chapterNumber >= readStart && c.chapterNumber <= readEnd && c.content
            );

            const nextOutlines = allChaptersForRead.filter(
                c => c.chapterNumber > readEnd && c.chapterNumber <= readEnd + 5
            ).map(c => `第${c.chapterNumber}章 ${c.title}: ${(c.outline || '').substring(0, 200)}`).join('\n');

            const baseChapters = allChaptersForRead.filter(
                c => c.chapterNumber >= 1 && c.chapterNumber <= 8 && c.content
            );

            let readerContent = '【基底章节（第1-8章，不可修改）摘要】\n';
            if (baseChapters.length > 0) {
                readerContent += baseChapters.map(c =>
                    `第${c.chapterNumber}章 ${c.title}: ${(c.normalContent || c.content || '').substring(0, 200)}`
                ).join('\n');
            } else {
                readerContent += '（无基底章节）';
            }

            readerContent += '\n\n【本次阅读章节（近15章已完成正文摘要）】\n';
            readerContent += recentChapters.map(c =>
                `=== 第${c.chapterNumber}章 ${c.title} ===\n${(c.normalContent || c.content || '').substring(0, 800)}`
            ).join('\n\n');

            if (nextOutlines) {
                readerContent += `\n\n【后续5章大纲】\n${nextOutlines}`;
            } else {
                readerContent += '\n\n【后续5章大纲暂无】';
            }

            const activeMats = materials.filter(m => m.projectId === projectId && !m.archived);
            const characterMats = activeMats.filter(m => m.type === 'character').map(m =>
                `${m.name}: ${(m.currentContent || '').substring(0, 200)}`
            ).join('\n');

            if (characterMats) {
                readerContent += `\n\n【角色素材参考】\n${characterMats}`;
            }

            readerContent += `

【你是真实读者——核心原则】
1. 你是花钱看书的真实读者，只关注跨章节的硬伤问题
2. 你的独特价值是发现单章审核无法发现的问题：前后矛盾、连续比喻重复、行为逻辑跳跃、设定前后不一致
3. 单章内的问题（术语直述、视角越界等）初审/复审已经检查过，你不需要重复报告
4. 必须引用原文作为证据，不能凭空指控
5. 前8章是基底不可修改

【输出格式 - 严格JSON】
{
  "chapterRange": "第X章-第Y章",
  "hardIssues": [
    {
      "type": "contradiction|logic-flaw|character-break|setting-conflict|foreshadow-forgot|repetition-pattern",
      "chapter": 涉及章节号,
      "location": "问题在章节中的大致位置",
      "description": "具体问题描述——用读者语言说'我读到这里觉得不对'",
      "evidence": "原文引用",
      "fixSuggestion": "给返修员的具体修改建议——只改这一处，不要大改"
    }
  ],
  "readerExperience": "作为真实读者的感受：这15章读下来连贯吗？哪里让你想弃书？",
  "overallScore": 1-10,
  "wantToContinue": true/false
}

【硬伤判断标准——只有以下跨章节情况才算hardIssue】
- 前后矛盾：第A章明确说了X，第B章却说了相反的Y
- 逻辑断裂：事件发生毫无因果，读者无法理解为什么
- 人设崩塌：角色行为严重偏离已建立的性格，且没有合理解释
- 设定冲突：能力体系/世界观规则前后不一致
- 伏笔遗忘：已埋伏笔在应回收时完全未被提及
- 连续重复：连续3章以上使用相同比喻/句式/场景结构（单章审核无法发现）

【不算硬伤——不要放进hardIssues】
- 单章内的术语/视角问题 → 初审/复审已检查
- 文笔不够好 → 不是跨章节问题
- 你个人不喜欢的剧情走向 → 不是问题`;

            agentContext.content = readerContent;
            result = await runAgent('reader', agentContext);
            chapter.readerOutput = result.response;
            saveAgentOutput(projectId, chapter, 'reader', result.response);
            break;
        }
        case 'adjuster': {
            const readerOutput = chapter.readerOutput || context.readerOutput || '';
            if (!readerOutput) {
                result = { response: '无阅读者输出，跳过调整' };
                chapter.adjusterOutput = result.response;
                saveAgentOutput(projectId, chapter, 'adjuster', result.response);
                break;
            }

            const project = store.getItem('projects', projectId);
            const writerRules = project?.writerPromptAdditions || [];
            const reviewRules = project?.reviewPromptAdditions || [];
            const activeMats2 = materials.filter(m => m.projectId === projectId && !m.archived);
            const writingTechMats = activeMats2.filter(m => m.type === 'writing-technique').map(m =>
                `${m.name}: ${(m.currentContent || '').substring(0, 300)}`
            ).join('\n');

            let adjusterContent = `【阅读者评审意见】\n${readerOutput}\n\n`;
            if (writerRules.length > 0) {
                adjusterContent += `【当前执笔人追加规则（共${writerRules.length}条，上限15条）】\n${writerRules.map((r, i) => `${i + 1}. ${r.rule || r}`).join('\n')}\n\n`;
            }
            if (reviewRules.length > 0) {
                adjusterContent += `【当前审核员追加规则（共${reviewRules.length}条，上限15条）】\n${reviewRules.map((r, i) => `${i + 1}. ${r.rule || r}`).join('\n')}\n\n`;
            }
            if (writingTechMats) {
                adjusterContent += `【当前写作手法素材】\n${writingTechMats}\n\n`;
            }

            adjusterContent += `
【调整员权限边界——绝对不可逾越】
1. 只能追加规则，不能删除或修改已有规则
2. 不能提出与基底约束相反的规则（如基底说"禁止恐怖"，你不能说"允许恐怖"）
3. 不能提出改变核心视角的规则（如基底是"有限视角"，你不能说"切换到全知视角"）
4. 不能修改世界观/设定类素材，只能修改写作手法/伏笔/角色行为类素材
5. 每类规则最多追加2条（避免规则膨胀）
6. 素材修改只能微调，不能大幅删减（新内容不得少于原内容的30%）
7. 如果阅读者没有发现硬伤，不要强制追加规则——没病不要开药

【输出格式 - 严格JSON】
{
  "writerRuleAdditions": ["规则1", "规则2"],
  "reviewRuleAdditions": ["规则1", "规则2"],
  "materialConstraintUpdates": [
    {
      "materialName": "素材名称（必须是写作手法/伏笔/角色类型）",
      "field": "修改的字段",
      "update": "修改后的完整内容"
    }
  ],
  "adjustmentSummary": "本次调整的简要说明"
}

如果阅读者没有发现需要调整的问题，输出：
{
  "writerRuleAdditions": [],
  "reviewRuleAdditions": [],
  "materialConstraintUpdates": [],
  "adjustmentSummary": "无需调整"
}
`;

            agentContext.content = adjusterContent;
            result = await runAgent('adjuster', agentContext);
            chapter.adjusterOutput = result.response;
            saveAgentOutput(projectId, chapter, 'adjuster', result.response);

            try {
                const parsed = extractJSON(result.response);
                if (parsed) {
                    const proj = store.getItem('projects', projectId);
                    if (!proj) {
                        console.warn(`[PIPELINE] Adjuster: project ${projectId} not found, cannot apply rules`);
                    } else {
                        const MAX_WRITER_RULES = 15;
                        const MAX_REVIEW_RULES = 15;
                        const PROTECTED_RULE_KEYWORDS = ['视角铁律', '有限视角', '科技描写降维', '禁止恐怖', '禁止克苏鲁', '简单好读', 'pov-lock', 'no-horror', 'tech-jargon'];
                        const CONFLICT_PATTERNS = [
                            { existing: /禁止.*恐怖|禁用.*恐怖/, newRule: /恐怖|惊悚|克苏鲁|黑暗|诡异/ },
                            { existing: /有限视角|视角铁律|POV锁定/, newRule: /全知视角|上帝视角|上帝旁白/ },
                            { existing: /科技描写降维|术语降维/, newRule: /专业术语|科技术语|工程术语/ },
                            { existing: /简单好读|口语化/, newRule: /文学化|书面语|文言/ }
                        ];

                        const isRuleConflicting = (newRule, existingRules) => {
                            for (const existing of existingRules) {
                                const existingStr = typeof existing === 'string' ? existing : (existing.rule || '');
                                for (const pattern of CONFLICT_PATTERNS) {
                                    if (pattern.existing.test(existingStr) && pattern.newRule.test(newRule)) {
                                        return { conflict: true, existingRule: existingStr, reason: `新规则"${newRule.substring(0, 50)}"与基底规则"${existingStr.substring(0, 50)}"冲突` };
                                    }
                                }
                            }
                            return { conflict: false };
                        };

                        const isRuleDuplicate = (newRule, existingRules) => {
                            const normalized = newRule.replace(/\s+/g, '').substring(0, 80);
                            return existingRules.some(r => {
                                const existing = (typeof r === 'string' ? r : (r.rule || '')).replace(/\s+/g, '').substring(0, 80);
                                return existing === normalized || (normalized.length > 20 && existing.includes(normalized.substring(0, 20)));
                            });
                        };

                        if (parsed.writerRuleAdditions?.length > 0) {
                            if (!proj.writerPromptAdditions) proj.writerPromptAdditions = [];
                            let addedCount = 0;
                            let skippedCount = 0;
                            for (const rule of parsed.writerRuleAdditions) {
                                const ruleStr = typeof rule === 'string' ? rule : (rule.rule || rule);
                                if (proj.writerPromptAdditions.length >= MAX_WRITER_RULES) {
                                    console.warn(`[PIPELINE] Adjuster: writer rules limit (${MAX_WRITER_RULES}) reached, skipping "${ruleStr.substring(0, 40)}"`);
                                    skippedCount++;
                                    continue;
                                }
                                if (isRuleDuplicate(ruleStr, proj.writerPromptAdditions)) {
                                    console.warn(`[PIPELINE] Adjuster: duplicate writer rule skipped: "${ruleStr.substring(0, 40)}"`);
                                    skippedCount++;
                                    continue;
                                }
                                const conflict = isRuleConflicting(ruleStr, proj.writerPromptAdditions);
                                if (conflict.conflict) {
                                    console.warn(`[PIPELINE] Adjuster: conflicting writer rule blocked: ${conflict.reason}`);
                                    skippedCount++;
                                    continue;
                                }
                                proj.writerPromptAdditions.push({
                                    rule: ruleStr,
                                    source: 'adjuster',
                                    addedAt: new Date().toISOString()
                                });
                                addedCount++;
                            }
                            console.log(`[PIPELINE] Adjuster writer rules: added ${addedCount}, skipped ${skippedCount}`);
                        }
                        if (parsed.reviewRuleAdditions?.length > 0) {
                            if (!proj.reviewPromptAdditions) proj.reviewPromptAdditions = [];
                            let addedCount = 0;
                            let skippedCount = 0;
                            for (const rule of parsed.reviewRuleAdditions) {
                                const ruleStr = typeof rule === 'string' ? rule : (rule.rule || rule);
                                if (proj.reviewPromptAdditions.length >= MAX_REVIEW_RULES) {
                                    console.warn(`[PIPELINE] Adjuster: review rules limit (${MAX_REVIEW_RULES}) reached, skipping "${ruleStr.substring(0, 40)}"`);
                                    skippedCount++;
                                    continue;
                                }
                                if (isRuleDuplicate(ruleStr, proj.reviewPromptAdditions)) {
                                    console.warn(`[PIPELINE] Adjuster: duplicate review rule skipped: "${ruleStr.substring(0, 40)}"`);
                                    skippedCount++;
                                    continue;
                                }
                                const conflict = isRuleConflicting(ruleStr, proj.reviewPromptAdditions);
                                if (conflict.conflict) {
                                    console.warn(`[PIPELINE] Adjuster: conflicting review rule blocked: ${conflict.reason}`);
                                    skippedCount++;
                                    continue;
                                }
                                proj.reviewPromptAdditions.push({
                                    rule: ruleStr,
                                    source: 'adjuster',
                                    addedAt: new Date().toISOString()
                                });
                                addedCount++;
                            }
                            console.log(`[PIPELINE] Adjuster review rules: added ${addedCount}, skipped ${skippedCount}`);
                        }
                        await store.setItem('projects', projectId, proj);
                    }
                    if (parsed.materialConstraintUpdates?.length > 0) {
                        const ALLOWED_MATERIAL_TYPES = ['writing-technique', 'foreshadowing', 'character'];
                        const PROTECTED_MATERIAL_NAMES = [];
                        const baseMats = store.queryItems('materials', { projectId }).filter(m => !m.archived && !m.isLocked);
                        for (const baseCh of baseMats.slice(0, 8)) {
                            if (baseCh.name) PROTECTED_MATERIAL_NAMES.push(baseCh.name);
                        }

                        let matUpdated = 0;
                        let matSkipped = 0;
                        for (const mcu of parsed.materialConstraintUpdates) {
                            const mat = activeMats2.find(m => m.name.includes(mcu.materialName));
                            if (!mat) {
                                console.warn(`[PIPELINE] Adjuster: material "${mcu.materialName}" not found, skipping`);
                                matSkipped++;
                                continue;
                            }
                            if (!ALLOWED_MATERIAL_TYPES.includes(mat.type)) {
                                console.warn(`[PIPELINE] Adjuster: material "${mat.name}" type "${mat.type}" not in allowed types [${ALLOWED_MATERIAL_TYPES.join(',')}], skipping`);
                                matSkipped++;
                                continue;
                            }
                            if (PROTECTED_MATERIAL_NAMES.includes(mat.name)) {
                                console.warn(`[PIPELINE] Adjuster: material "${mat.name}" is a base material (first 8), skipping`);
                                matSkipped++;
                                continue;
                            }
                            const oldContent = mat.currentContent || '';
                            const newContent = mcu.update || '';
                            if (newContent.length < oldContent.length * 0.3 && oldContent.length > 100) {
                                console.warn(`[PIPELINE] Adjuster: material "${mat.name}" update would shrink content to ${(newContent.length/oldContent.length*100).toFixed(0)}%, skipping`);
                                matSkipped++;
                                continue;
                            }
                            await store.setItem('materials', mat.id, {
                                ...mat,
                                currentContent: newContent || mat.currentContent,
                                changeLog: [...(mat.changeLog || []), {
                                    from: oldContent.substring(0, 100),
                                    to: newContent.substring(0, 100),
                                    reason: `Adjuster update: ${mcu.field}`,
                                    chapterNumber: chapter.chapterNumber,
                                    timestamp: new Date().toISOString()
                                }],
                                updatedAt: new Date().toISOString()
                            });
                            matUpdated++;
                        }
                        console.log(`[PIPELINE] Adjuster material updates: ${matUpdated} applied, ${matSkipped} skipped`);
                    }
                }
            } catch (e) {
                console.warn('[PIPELINE] Adjuster output parse failed:', e.message);
            }
            break;
        }
        default:
            throw new Error(`Unknown pipeline step: ${step}`);
    }

    chapter.updatedAt = new Date().toISOString();
    await store.setItem('chapters', chapterId, chapter);

    const stepFeedbackMap = {
        'reviser': { summary: chapter.reviserOutput?.startsWith('[返修员') ? '返修员返回空响应，保留原文' : `返修完成，${chapter.wordCount || 0}字`, issues: [], suggestions: [] },
        'polisher': { summary: '润色完成', issues: [], suggestions: [] },
        'reader': { summary: '阅读者评审完成', issues: [], suggestions: [] },
        'adjuster': { summary: '调整完成', issues: [], suggestions: [] },
        'final-editor': { summary: '定稿完成', issues: [], suggestions: [] }
    };
    const stepFeedback = stepFeedbackMap[step] || { summary: `${step}完成`, issues: [], suggestions: [] };

    return { step, result, passed: true, feedback: stepFeedback };
}

module.exports = {
    getAgentPrompt,
    runAgent,
    runPipelineStep,
    runFullPipeline: _runFullPipeline,
    generateInitialMaterials,
    generateChapterOutlines,
    getAgentOutputPaths,
    saveAgentOutput,
    saveFinalContent,
    supplementChapterOutlines,
    runInfinitePipeline,
    stopInfinitePipeline,
    forceResetPipeline,
    getInfinitePipelineStatus,
    generateFromTemplate,
    getVisibleMaterials,
    getVolumeOrder,
    getVolumeSubplane,
    AGENT_PROMPTS,
    SHUANGWEN_AGENT_PROMPTS,
    TOMATO_SHORT_AGENT_PROMPTS
};
