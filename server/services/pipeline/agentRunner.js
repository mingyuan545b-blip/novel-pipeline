const logger = require('../../shared/logger');
const store = require('../../store');
const llm = require('../../services/llm');
const { AGENT_DEFAULTS, PROVIDER_DEFAULTS } = require('../../config/systemConfig');
const { DEFAULT_MODEL } = require('../../config/modelResolver');
const { getStyleProfileForProject } = require('../agentPrompts');
const { assembleAgentPrompt } = require('../prompts/agentPromptAssembler');
const { ContextBudget, estimateTokens, truncateToTokens } = require('../contextBudget');
const promptAuditor = require('../promptAuditor');
const { getBeatAllocator } = require('../beatAllocator');
const { getMetrics } = require('../metricsCollector');
const { reportAgentUsage } = require('./agentUsageReporter');
const { resolveGenreFromProject } = require('../genreConfig');
const { getDataContext } = require('../dataContext');
const { classifyMaterials, allocateMaterialsToBudget, buildUserContent, truncateUserContent, getMaterialAccessConfig } = require('./unifiedBudgetPool');
const { scheduleTechniques } = require('./techniqueScheduler');
const { detectSceneTypes, resolveChapterPhase } = require('./contextDecisionRules');
const { buildKnowledgeContext, resolveGenre, buildFeedbackRates, cacheSelectedTechniques } = require('./techniqueContextHelpers');

async function runAgent(agentType, context) {
    const mode = context.mode || 'novel';
    // 预算熔断不在此处断言：统一在 llm.chat 出口拦截，覆盖绕过 agentRunner 的调用方
    // （实测 generate-materials 直连 llm.chat，若只在 agentRunner 拦会漏）
    const projectId = context.projectId || null;

    const agentCfg = AGENT_DEFAULTS[agentType] || { maxTokens: 8192 };
    const defaultMaxTokens = agentCfg.maxTokens;
    const maxTokens = context.maxTokens || defaultMaxTokens;
    const model = context.apiConfig?.model || process.env.ALIYUN_CODING_MODEL || DEFAULT_MODEL;
    const budget = new ContextBudget(model, maxTokens);

    const assembled = projectId
        ? await assembleAgentPrompt(agentType, mode, projectId, { chapterNumber: context.chapterNumber })
        : await _buildFallbackPrompt(agentType, mode);
    if (!assembled) throw new Error(`Unknown agent type: ${agentType}`);

    let genreId = null;
    let profile = null;
    let resolvedGenre = null;  // 陷阱#86修复：保留完整genre对象，避免后续只传styleProfile重新解析丢失subGenre/branchKey
    if (projectId) {
        try {
            profile = await getStyleProfileForProject(projectId);
            const _arCtx = await getDataContext(projectId);
            const _arProject = await _arCtx.getProject();
            resolvedGenre = resolveGenreFromProject(_arProject);
            genreId = resolvedGenre?.id || null;
        } catch(_) { logger.warn('agentRunner', _.message || _); }  // DEGRADE: 影响=getStyleProfileForProject 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    }

    const fullSystem = assembled.system;
    const auditResult = promptAuditor.audit(fullSystem, '', agentType, genreId);
    const auditedSystem = fullSystem;

    budget.allocate('agent_prompt', auditedSystem);
    if (context.memoryContext) budget.allocate('memory_context', `【记忆】${context.memoryContext}`);

    if (context.materials && !context.materialSummary) {
        const genre = resolvedGenre || resolveGenreFromProject({ styleProfile: profile, genre: genreId });
        const accessConfig = getMaterialAccessConfig(genre, agentType);
        const allowedTypes = accessConfig.needs ? new Set(accessConfig.needs) : null;
        const classified = classifyMaterials(context.materials, allowedTypes);
        allocateMaterialsToBudget(budget, classified, accessConfig.detail, budget.isUltraLongContext);
    }

    if (context.chapterOutline) budget.allocate('chapter_outline', `【大纲】${context.chapterOutline}`);
    if (context.previousChapter) budget.allocate('previous_chapter', `【上章结尾参考 - 用于推断承接，禁止逐字复制任何段落】${context.previousChapter}`);
    if (context.reviewContext) budget.allocate('review_feedback', `【审核】${context.reviewContext}`);
    if (context.styleTemplate) budget.allocate('style_template', `【风格】${context.styleTemplate}`);
    if (context.chapterContent) budget.allocate('chapter_content', `【正文】\n${context.chapterContent}`);
    if (context.materialSummary) budget.allocate('material_summary', context.materialSummary);

    if (projectId && ['writer', 'polisher', 'intent-planner'].includes(agentType)) {
        await _injectTechniquesAndBeats(budget, context, agentType, mode);
    }

    const systemContent = budget.buildSystemPrompt();
    let userContent = buildUserContent(budget, context);
    userContent = truncateUserContent(userContent, budget, agentType);

    const messages = [{ role: 'system', content: systemContent }];
    if (userContent) messages.push({ role: 'user', content: userContent });

    const report = budget.getReport();
    logger.info('agentRunner', `runAgent: agent=${agentType}, model=${model}, budget=${report.totalBudget}, allocated=${report.allocated}(${report.utilization})`);

    const chatOptions = _buildChatOptions(context, agentType, maxTokens);
    const result = await _executeWithRetry(messages, chatOptions, context, budget, assembled, userContent, agentType);

    const responseText = result.choices?.[0]?.message?.content || '';
    if (projectId) try { getMetrics(projectId).recordAgentTiming(agentType, Date.now() - (context._startTime || Date.now()), result.usage?.total_tokens || 0); } catch(_) { logger.warn('agentRunner', _.message || _); }  // DEGRADE: 影响=getMetrics 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    // 单点上报：token 账本（花在哪几段提示词上） + 项目账（预算熔断）
    await reportAgentUsage({
        projectId, chapterNumber: context.chapterNumber, step: agentType,
        model, usage: result.usage, contextReport: report, outputChars: responseText.length,
    });

    return { agent: agentType, role: assembled.role, response: responseText, usage: result.usage, contextReport: report, promptAudit: auditResult, timestamp: new Date().toISOString() };
}

async function _injectTechniquesAndBeats(budget, context, agentType, mode) {
    try {
        const outlineText = (context.chapterOutline || '').substring(0, 2000).toLowerCase();
        const chapterNumber = context.chapterNumber || 1;
        const phase = resolveChapterPhase(chapterNumber);
        const sceneTypes = detectSceneTypes(outlineText);

        const [knowledgeContext, genre, feedbackRates] = await Promise.all([
            buildKnowledgeContext(context.projectId),
            resolveGenre(context.projectId),
            buildFeedbackRates(context.projectId),
        ]);

        const techResult = scheduleTechniques({
            agentType, mode, sceneTypes, phase, outlineText, maxTokens: 600, knowledgeContext, genre, feedbackRates,
        });
        if (techResult.formattedPrompt) budget.allocate('technique_injection', techResult.formattedPrompt);
        if (techResult.techniques?.length && context.projectId && context.chapterNumber) {
            cacheSelectedTechniques(context.projectId, context.chapterNumber, techResult.techniques.map(t => t.id));
        }

        if (context.chapterNumber) {
            const _arCtx = await getDataContext(context.projectId);
            const project = await _arCtx.getProject();
            const pMode = project?.mode || 'novel';
            const beatAllocator = getBeatAllocator(context.projectId);
            let beats = await beatAllocator.getChapterBeats(context.chapterNumber);
            if (!beats.length && context.chapterOutline) {
                beats = await beatAllocator.allocateBeatsForChapter(context.chapterNumber, context.chapterOutline, pMode);
            }
            const beatPrompt = await beatAllocator.formatBeatsForPrompt(context.chapterNumber, pMode, beats);
            if (beatPrompt) budget.allocate('beat_allocation', beatPrompt);
        }
    } catch (techErr) {
        logger.warn('agentRunner', `Technique injection failed: ${techErr.message}`);
    }
}

function _buildChatOptions(context, agentType, maxTokens) {
    const chatOptions = { temperature: context.temperature || 0.7, maxTokens };
    // 供 llm.chat 记账时标记消耗归属步骤（预算报表按步骤拆分用）
    chatOptions.usageStep = agentType;
    const agentDefaults = AGENT_DEFAULTS[agentType];
    if (agentDefaults?.timeoutMs) chatOptions.timeout = agentDefaults.timeoutMs;
    if (context.apiConfig) chatOptions.apiConfig = context.apiConfig;
    if (context.signal) chatOptions.signal = context.signal;
    return chatOptions;
}

async function _executeWithRetry(messages, chatOptions, context, budget, assembled, userContent, agentType) {
    try {
        return await llm.chat(messages, chatOptions);
    } catch (err) {
        if (context.projectId) {
            try { getMetrics(context.projectId).recordError(agentType, err.isContextOverflow ? 'context_overflow' : 'llm_error'); } catch(_) { logger.warn('agentRunner', _.message || _); }  // DEGRADE: 影响=getMetrics 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
        }
        if (!err.isContextOverflow) throw err;

        logger.info('agentRunner', 'Context overflow detected, retrying with compressed context...');
        const compressed = _buildCompressedMessages(budget, assembled, context, userContent);
        try {
            return await llm.chat(compressed.messages, chatOptions);
        } catch (retryErr) {
            throw retryErr;
        }
    }
}

function _buildCompressedMessages(budget, assembled, context, userContent) {
    const model = budget.modelName;
    const compressedBudget = new ContextBudget(model, budget.maxTokens);
    compressedBudget.allocate('agent_prompt', assembled.system);
    if (context.memoryContext) compressedBudget.allocate('memory_context', `【分层记忆上下文】\n${truncateToTokens(context.memoryContext, Math.floor(budget.inputBudget * 0.10))}`);
    if (context.materials) {
        const matSummary = Array.isArray(context.materials)
            ? context.materials.map(m => `[${m.type||''}]${m.name||''}:${(m.currentContent||'').substring(0, 60)}`).join('\n')
            : JSON.stringify(context.materials).substring(0, 2000);
        compressedBudget.allocate('materials', `【素材库参考】\n${matSummary}`);
    }
    const compressedSystem = compressedBudget.buildSystemPrompt();
    const compressedUser = userContent ? truncateToTokens(userContent, Math.floor(budget.inputBudget * 0.30)) : '';
    const compressedMessages = [{ role: 'system', content: compressedSystem }];
    if (compressedUser) compressedMessages.push({ role: 'user', content: compressedUser });
    return { messages: compressedMessages, system: compressedSystem, user: compressedUser };
}

async function _buildFallbackPrompt(agentType, mode) {
    const { getAgentTemplate } = require('../prompts/promptBuilder');
    const template = await getAgentTemplate(agentType, mode);
    if (!template) return null;
    return { system: template.system, role: template.role, tool: template.tool, buildLog: [{ slot: 'fallback-template' }] };
}

module.exports = { runAgent };
