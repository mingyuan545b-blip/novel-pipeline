const store = require('../../store');
const llm = require('../../services/llm');
const { AGENT_DEFAULTS } = require('../../config/systemConfig');
const { AGENT_PROMPTS, SHUANGWEN_AGENT_PROMPTS, TOMATO_SHORT_AGENT_PROMPTS, buildConstraintInjection, buildFoundationPrompt, getAgentPrompt, deduplicateSystemPrompt } = require('../agentPrompts');
const { ContextBudget, estimateTokens, truncateToTokens } = require('../contextBudget');
const promptAuditor = require('../promptAuditor');
const techIndex = require('../techIndex');
const { getBeatAllocator } = require('../beatAllocator');
const { getMetrics } = require('../metricsCollector');
const { detectGenre, getStyleProfileForProject } = require('../genreConfig');

async function runAgent(agentType, context) {
    const mode = context.mode || 'novel';
    const projectId = context.projectId || null;
    let agent = getAgentPrompt(agentType, mode, projectId);
    if (!agent) throw new Error(`Unknown agent type: ${agentType}`);

    const defaultMaxTokens = (agentType === 'writer' || agentType === 'final-editor') ? 32768 : 8192;
    const maxTokens = context.maxTokens || defaultMaxTokens;
    const model = context.apiConfig?.model || process.env.MINIMAX_MODEL || 'default';
    const budget = new ContextBudget(model, maxTokens);

    const foundationPrompt = buildFoundationPrompt(agentType, mode, projectId);
    const constraintInjection = projectId ? buildConstraintInjection(projectId) : '';
    const rawSystem = foundationPrompt + '\n\n' + (agent.system || '') + constraintInjection;
    const fullSystem = deduplicateSystemPrompt(rawSystem, agentType);

    let genreId = null;
    if (projectId) {
        try {
            const profile = getStyleProfileForProject(projectId);
            const genre = detectGenre(profile);
            genreId = genre?.id || null;
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    }

    const auditResult = promptAuditor.audit(fullSystem, '', agentType, genreId);
    let auditedSystem = fullSystem;
    if (auditResult.healthScore < 70) {
        const dedupResult = promptAuditor.autoDeduplicate(fullSystem, agentType);
        auditedSystem = dedupResult.text;
        if (dedupResult.removed > 0) {
            console.log(`[PIPELINE] PromptAuditor auto-dedup: ${agentType} removed ${dedupResult.removed} blocks, saved ${dedupResult.saved} chars, health ${auditResult.healthScore}->re-audit`);
            const reAudit = promptAuditor.audit(auditedSystem, '', agentType, genreId);
            console.log(`[PIPELINE] PromptAuditor re-audit: ${agentType} health=${reAudit.healthScore} duplicates=${reAudit.totalDuplicates} inflation=${reAudit.totalInflation}`);
        }
    }

    budget.allocate('agent_prompt', auditedSystem);

    if (context.memoryContext) {
        budget.allocate('memory_context', `【记忆】{context.memoryContext}`);
    }

    if (context.materials && !context.materialSummary) {
        const worldviewMats = [];
        const characterMats = [];
        const otherMats = [];
        const indexMats = [];
        const matArray = Array.isArray(context.materials) ? context.materials :
            (typeof context.materials === 'object' ? Object.values(context.materials) : []);

        for (const m of matArray) {
            const type = m.type || m.category || '';
            if (type === 'worldview' || type === 'power-system' || type === 'relationship' || type === 'scene' || type === 'phenomenon' || type === 'institution' || type === 'organization' || type === 'faction' || type === 'geography' || type === 'technology') {
                worldviewMats.push(m);
            } else if (type === 'character' || type === 'character-psychology' || type === 'character-combat' || type === 'character-personality' || type === 'character-relationship' || type === 'character-dialogue' || type === 'character-behavior' || type === 'foreshadowing') {
                characterMats.push(m);
            } else if (type === 'index') {
                indexMats.push(m);
            } else {
                otherMats.push(m);
            }
        }

        if (budget.isUltraLongContext) {
            if (worldviewMats.length > 0) {
                budget.allocate('worldview_materials', `【世界观素材】\n${worldviewMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`);
            }
            if (characterMats.length > 0) {
                budget.allocate('character_materials', `【角色素材】\n${characterMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`);
            }
            if (otherMats.length > 0) {
                budget.allocate('other_materials', `【其他素材】\n${otherMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`);
            }
        } else {
            if (indexMats.length > 0) {
                budget.allocate('worldview_materials', `【素材索引（按需加载）】\n${indexMats.map(m => m.currentContent || '').join('\n\n')}`);
            } else {
                if (worldviewMats.length > 0) {
                    budget.allocate('worldview_materials', `【世界观素材】${worldviewMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, 200)}`).join('\n')}`);
                }
                if (characterMats.length > 0) {
                    budget.allocate('character_materials', `【角色素材】${characterMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, 200)}`).join('\n')}`);
                }
            }
            if (otherMats.length > 0) {
                budget.allocate('other_materials', `【其他素材】${otherMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, 150)}`).join('\n')}`);
            }
        }
    }

    if (context.chapterOutline) {
        budget.allocate('chapter_outline', `【大纲】{context.chapterOutline}`);
    }

    if (context.previousChapter) {
        budget.allocate('previous_chapter', `【上章】{context.previousChapter}`);
    }

    if (context.reviewContext) {
        budget.allocate('review_feedback', `【审核】{context.reviewContext}`);
    }

    if (context.styleTemplate) {
        budget.allocate('style_template', `【风格】{context.styleTemplate}`);
    }

    if (context.chapterContent) {
        budget.allocate('chapter_content', `【正文】\n${context.chapterContent}`);
    }

    if (context.materialSummary) {
        budget.allocate('material_summary', context.materialSummary);
    }

    if (context.projectId && (agentType === 'writer' || agentType === 'polisher' || agentType === 'intent-planner')) {
        try {
            const project = store.getItem('projects', context.projectId);
            const mode = project?.mode || 'novel';
            const techniques = techIndex.getTechniquesByInjectionPoint(agentType, mode);
            const techPrompt = techIndex.formatTechniquesForPrompt(techniques.slice(0, 5), 600);
            if (techPrompt) {
                budget.allocate('technique_injection', techPrompt);
            }

            if (context.chapterNumber) {
                const beatAllocator = getBeatAllocator(context.projectId);
                let beats = beatAllocator.getChapterBeats(context.chapterNumber);
                if (!beats.length && context.chapterOutline) {
                    beats = beatAllocator.allocateBeatsForChapter(context.chapterNumber, context.chapterOutline, mode);
                }
                const beatPrompt = beatAllocator.formatBeatsForPrompt(context.chapterNumber, mode, beats);
                if (beatPrompt) {
                    budget.allocate('beat_allocation', beatPrompt);
                }
            }
        } catch (techErr) {
            console.warn(`[PIPELINE] Technique injection failed: ${techErr.message}`);
        }
    }

    const systemContent = budget.buildSystemPrompt();

    let userContent = '';
    if (context.content) {
        userContent += context.content;
    }

    const userSlots = ['chapter_outline', 'review_feedback', 'chapter_content'];
    for (const slotName of userSlots) {
        const slot = budget.slots[slotName];
        if (slot?.content) {
            if (userContent) userContent += '\n\n';
            userContent += slot.content;
        }
    }

    if (context.userMessage) {
        if (userContent) userContent += '\n\n';
        userContent += context.userMessage;
    }

    const userTokenEstimate = estimateTokens(userContent);
    const isInputHeavyAgent = ['material-manager', 'first-review', 'second-review', 'final-editor'].includes(agentType);
    const userBudgetRatio = isInputHeavyAgent ? 0.55 : 0.25;
    const userBudget = budget.inputBudget * userBudgetRatio;
    if (userTokenEstimate > userBudget) {
        userContent = truncateToTokens(userContent, Math.floor(userBudget));
    }

    const messages = [{ role: 'system', content: systemContent }];
    if (userContent) messages.push({ role: 'user', content: userContent });

    const report = budget.getReport();
    console.log(`[PIPELINE] runAgent: agent=${agentType}, model=${model}, budget=${report.totalBudget}, allocated=${report.allocated}(${report.utilization}), slots=${Object.keys(report.slots).length}`);

    const chatOptions = {
        temperature: context.temperature || 0.7,
        maxTokens
    };
    const agentDefaults = AGENT_DEFAULTS[agentType];
    if (agentDefaults?.timeoutMs) chatOptions.timeout = agentDefaults.timeoutMs;
    if (context.apiConfig) chatOptions.apiConfig = context.apiConfig;

    let result;

    const agentStartTime = Date.now();
    try {
        result = await llm.chat(messages, chatOptions);
    } catch (err) {
        if (context.projectId) {
            try { getMetrics(context.projectId).recordError(agentType, err.isContextOverflow ? 'context_overflow' : 'llm_error'); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        }
        if (err.isContextOverflow) {
            console.log(`[PIPELINE] Context overflow detected, retrying with compressed context...`);
            const compressedBudget = new ContextBudget(model, maxTokens);
            compressedBudget.allocate('agent_prompt', agent.system);
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
            console.log(`[PIPELINE] Compressed retry: systemLen=${compressedSystem.length}, userLen=${compressedUser.length}`);
            try {
                result = await llm.chat(compressedMessages, chatOptions);
            } catch (retryErr) {
                console.error(`[PIPELINE] Compressed retry also failed: ${retryErr.message}`);
                if (isInputHeavyAgent && context.apiConfig?.provider === 'minimax' && process.env.LLM_PROVIDER === 'lmstudio') {
                    console.log(`[PIPELINE] Falling back to LM Studio for ${agentType}...`);
                    const fallbackConfig = {
                        provider: 'lmstudio',
                        apiKey: 'lmstudio',
                        model: process.env.LMSTUDIO_MODEL || 'default',
                        baseURL: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'
                    };
                    const fallbackBudget = new ContextBudget(fallbackConfig.model, maxTokens);
                    fallbackBudget.allocate('agent_prompt', agent.system);
                    if (context.memoryContext) fallbackBudget.allocate('memory_context', context.memoryContext);
                    if (context.materials) fallbackBudget.allocate('materials', `【素材库参考】\n${matSummary || JSON.stringify(context.materials).substring(0, 2000)}`);
                    const fallbackSystem = fallbackBudget.buildSystemPrompt();
                    const fallbackUser = userContent || '';
                    const fallbackMessages = [{ role: 'system', content: fallbackSystem }];
                    if (fallbackUser) fallbackMessages.push({ role: 'user', content: fallbackUser });
                    result = await llm.chat(fallbackMessages, { ...chatOptions, apiConfig: fallbackConfig });
                    console.log(`[PIPELINE] LM Studio fallback succeeded for ${agentType}`);
                } else {
                    throw retryErr;
                }
            }
        } else {
            throw err;
        }
    }

    const responseText = result.choices?.[0]?.message?.content || '';

    if (context.projectId) {
        try {
            const agentDuration = Date.now() - agentStartTime;
            const tokenCount = result.usage?.total_tokens || 0;
            getMetrics(context.projectId).recordAgentTiming(agentType, agentDuration, tokenCount);
        } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
    }

    return {
        agent: agentType,
        role: agent.role,
        response: responseText,
        usage: result.usage,
        contextReport: report,
        promptAudit: auditResult,
        timestamp: new Date().toISOString()
    };
}

module.exports = { runAgent };
