/**
 * chapterIntent.js — 章节意图规划器
 * 核心类：生成/格式化/查询章节写作意图
 * Prompt构建已提取到intentPromptBuilder.js
 */
const logger = require('../shared/logger');
const store = require('../store');
const { getDataContext } = require('./dataContext');
const { extractJSON } = require('./jsonUtils');
const { getHookBudgetForProject } = require('./hookBudget');
const { getRuleStackForProject } = require('./ruleStack');
const { getContextTraceForProject } = require('./contextTrace');
const { getReaderAdvisory, formatAdvisoryForIntent } = require('./pipeline/readerAdvisory');
const { getVolumeSubplaneForChapter, buildMustKeepItems, buildIntentPrompt } = require('./intentPromptBuilder');

class ChapterIntentPlanner {
    constructor(projectId) {
        this.projectId = projectId;
    }

    async _getIntentStore() {
        const ctx = await getDataContext(this.projectId);
        const project = await ctx.getProject();
        if (!project) return { chapters: {} };
        if (!project.chapterIntents) {
            project.chapterIntents = { chapters: {} };
            await store.setItem('projects', this.projectId, project);
        }
        if (Array.isArray(project.chapterIntents.chapters)) {
            project.chapterIntents.chapters = {};
            await store.setItem('projects', this.projectId, project);
        }
        return project.chapterIntents;
    }

    async _saveIntentStore(data) {
        const ctx = await getDataContext(this.projectId);
        const project = await ctx.getProject();
        if (!project) return;
        project.chapterIntents = data;
        await store.setItem('projects', this.projectId, project);
    }

    async generateIntent(chapterNumber, chapterOutline, options = {}) {
        const ctx = await getDataContext(this.projectId);
        const hookBudget = getHookBudgetForProject(this.projectId);
        const ruleStack = getRuleStackForProject(this.projectId);
        const contextTrace = getContextTraceForProject(this.projectId);

        const hookAgenda = await hookBudget.generateHookAgenda(chapterNumber);
        const hookAgendaText = await hookBudget.formatHookAgendaForPrompt(chapterNumber);
        const ruleStackText = await ruleStack.formatRuleStackForPrompt('writer');

        const chapterScene = options.scene || '主世界';
        const volumeInfo = getVolumeSubplaneForChapter(this.projectId, chapterNumber);
        const currentSubplaneId = volumeInfo ? volumeInfo.subplaneId : null;
        const isInSubplane = chapterScene !== '主世界' && chapterScene !== '';

        const mustKeepItems = await buildMustKeepItems(ctx, chapterNumber, chapterScene, currentSubplaneId, isInSubplane);

        const readerAdvisory = await getReaderAdvisory(this.projectId, chapterNumber);
        const readerAdvisoryText = formatAdvisoryForIntent(readerAdvisory);

        const previousChapter = (await ctx.getChapters())
            .filter(ch => ch.chapterNumber === chapterNumber - 1 && ch.content)
            .sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
        const prevChapterSummary = previousChapter
            ? (previousChapter.content || '').slice(-500)
            : '无（这是第一章）';

        // SOP-1修复：读取项目povRule传入意图规划（确保意图规划阶段就考虑视角约束）
        const project = await ctx.getProject();
        const povRule = project?.styleProfile?.povRule || '';

        const intentPrompt = buildIntentPrompt(chapterOutline, prevChapterSummary, mustKeepItems, ruleStackText, hookAgendaText, readerAdvisoryText, povRule);

        let intent = null;
        try {
            const { runAgent } = require('./pipeline/agentRunner');
            const agentResult = await runAgent('intent-planner', {
                projectId: this.projectId, chapterNumber,
                content: intentPrompt,
                apiConfig: options.apiConfig || this._getApiConfig(),
                maxTokens: 2048, temperature: 0.3
            });
            const responseText = agentResult.response || '';
            intent = extractJSON(responseText);
            if (!intent) intent = this._generateFallbackIntent(chapterNumber, chapterOutline, hookAgenda);
        } catch (err) {
            logger.warn('chapterIntent', '[INTENT] LLM generation failed, using fallback:', err.message);
            intent = this._generateFallbackIntent(chapterNumber, chapterOutline, hookAgenda);
        }

        const fullIntent = {
            chapter: chapterNumber,
            goal: intent.goal || `执行第${chapterNumber}章大纲`,
            outlineNode: chapterOutline || '',
            mustKeep: intent.mustKeep || mustKeepItems.slice(0, 3).map(s => s.replace(/^-\s*/, '')),
            mustAvoid: intent.mustAvoid || [],
            styleEmphasis: intent.styleEmphasis || null,
            hookAdvance: intent.hookAdvance || [],
            hookResolve: intent.hookResolve || [],
            conflictDesign: typeof intent.conflictDesign === 'string' ? intent.conflictDesign : (intent.conflictDesign ? JSON.stringify(intent.conflictDesign) : ''),
            chapterEndHook: intent.chapterEndHook || '',
            readerConcerns: intent.readerConcerns || null,
            outlineAdjustment: intent.outlineAdjustment || null,
            hookAgenda, generatedAt: new Date().toISOString()
        };

        const intentStore = await this._getIntentStore();
        intentStore.chapters[`chapter-${String(chapterNumber).padStart(4, '0')}`] = fullIntent;
        await this._saveIntentStore(intentStore);

        contextTrace.recordChapterTrace(chapterNumber, {
            plannerInputs: ['chapter-outline', 'previous-chapter', 'hook-budget', 'rule-stack', 'core-materials'],
            selectedSources: ['hook-agenda', 'rule-stack', 'core-characters', 'worldview-rules'],
            notes: [`Intent generated for chapter ${chapterNumber}`]
        });

        return fullIntent;
    }

    _generateFallbackIntent(chapterNumber, chapterOutline, hookAgenda) {
        const mustAdvance = (hookAgenda.mustAdvance || []).map(h => `${h.id}(${h.type})`);
        const eligibleResolve = (hookAgenda.eligibleResolve || []).map(h => `${h.id}(${h.type})`);
        return {
            goal: chapterOutline ? `执行大纲: ${chapterOutline.substring(0, 100)}` : `完成第${chapterNumber}章的剧情推进`,
            mustKeep: ['保持角色性格一致', '遵循世界观设定'],
            mustAvoid: ['不违反核心设定', '不引入与主线无关的支线'],
            hookAdvance: mustAdvance, hookResolve: eligibleResolve,
            styleEmphasis: null,
            conflictDesign: '延续上一章冲突或根据大纲设计新冲突',
            chapterEndHook: '设置悬念钩子，引导读者继续阅读'
        };
    }

    async formatIntentForPrompt(chapterNumber) {
        const intentStore = await this._getIntentStore();
        const key = `chapter-${String(chapterNumber).padStart(4, '0')}`;
        const intent = intentStore.chapters[key];
        if (!intent) return '';

        const lines = [];
        lines.push('【章节意图 - Chapter Intent】', '');
        lines.push('## Goal', intent.goal, '');
        lines.push('## Must Keep');
        (intent.mustKeep || []).forEach(item => lines.push(`- ${item}`));
        lines.push('', '## Must Avoid');
        (intent.mustAvoid || []).forEach(item => lines.push(`- ${item}`));
        lines.push('');

        if (intent.conflictDesign) lines.push('## 冲突设计', typeof intent.conflictDesign === 'string' ? intent.conflictDesign : JSON.stringify(intent.conflictDesign), '');
        if (intent.chapterEndHook) lines.push('## 章末钩子', typeof intent.chapterEndHook === 'string' ? intent.chapterEndHook : JSON.stringify(intent.chapterEndHook), '');
        if (intent.readerConcerns) lines.push('## 阅读者反馈注意事项', typeof intent.readerConcerns === 'string' ? intent.readerConcerns : JSON.stringify(intent.readerConcerns), '');
        if (intent.outlineAdjustment) lines.push('## ⚠️ 大纲微调（基于阅读者反馈）', typeof intent.outlineAdjustment === 'string' ? intent.outlineAdjustment : JSON.stringify(intent.outlineAdjustment), '');
        if (intent.hookAdvance?.length > 0) { lines.push('### Hook Must Advance'); intent.hookAdvance.forEach(h => lines.push(`- ${h}`)); lines.push(''); }
        if (intent.hookResolve?.length > 0) { lines.push('### Hook Eligible Resolve'); intent.hookResolve.forEach(h => lines.push(`- ${h}`)); lines.push(''); }
        if (intent.hookAgenda) {
            const agenda = intent.hookAgenda;
            lines.push('### 伏笔预算', `- 当前 ${agenda.budget.active} 条活跃伏笔 / 上限 ${agenda.budget.max} 条 — 剩余 ${agenda.budget.remaining} 个新坑位`);
            if (agenda.budget.nearCapacity) lines.push('- ⚠ 接近容量上限！优先回收旧债，不要轻易开新线。');
        }
        return lines.join('\n');
    }

    async getIntent(chapterNumber) {
        const intentStore = await this._getIntentStore();
        const key = `chapter-${String(chapterNumber).padStart(4, '0')}`;
        return intentStore.chapters[key] || null;
    }

    async _getApiConfig() {
        const llmConfig = require('./llmConfig');
        return await llmConfig.resolveStepConfig('intent-planner', null);
    }
}

function getChapterIntentPlanner(projectId) { return new ChapterIntentPlanner(projectId); }

module.exports = { ChapterIntentPlanner, getChapterIntentPlanner };
