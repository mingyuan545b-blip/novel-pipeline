const store = require('../store');
const llm = require('./llm');
const { getHookBudgetForProject } = require('./hookBudget');
const { getRuleStackForProject } = require('./ruleStack');
const { getContextTraceForProject } = require('./contextTrace');
const { extractJSON } = require('./jsonUtils');

function getVolumeSubplaneForChapter(projectId, chapterNumber) {
    const volume = Math.floor((chapterNumber - 1) / 30) + 1;
    try {
        const fs = require('fs');
        const path = require('path');
        const orderPath = path.join(__dirname, '..', '..', 'data', 'subplanes', 'volume-order.json');
        const order = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
        if (order && order.volumeOrder) {
            const entry = order.volumeOrder.find(v => v.volume === volume);
            if (entry) return entry;
        }
    } catch (e) {}
    return null;
}

class ChapterIntentPlanner {
    constructor(projectId) {
        this.projectId = projectId;
    }

    async _getIntentStore() {
        const project = store.getItem('projects', this.projectId);
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
        const project = store.getItem('projects', this.projectId);
        if (!project) return;
        project.chapterIntents = data;
        await store.setItem('projects', this.projectId, project);
    }

    async generateIntent(chapterNumber, chapterOutline, options = {}) {
        const hookBudget = getHookBudgetForProject(this.projectId);
        const ruleStack = getRuleStackForProject(this.projectId);
        const contextTrace = getContextTraceForProject(this.projectId);

        const hookAgenda = hookBudget.generateHookAgenda(chapterNumber);
        const hookAgendaText = hookBudget.formatHookAgendaForPrompt(chapterNumber);
        const ruleStackText = ruleStack.formatRuleStackForPrompt('writer');

        const materials = store.queryItems('materials', { projectId: this.projectId });
        const activeMaterials = materials.filter(m => !m.archived && !m.isLocked);

        const chapterScene = options.scene || '主世界';
        const volumeInfo = getVolumeSubplaneForChapter(this.projectId, chapterNumber);
        const currentSubplaneId = volumeInfo ? volumeInfo.subplaneId : null;
        const isInSubplane = chapterScene !== '主世界' && chapterScene !== '';

        const coreCharacters = activeMaterials.filter(m => m.type === 'character').filter(m => {
            if (!m.parentPlane || m.parentPlane === '主世界') return true;
            if (isInSubplane) return m.parentPlane === currentSubplaneId;
            return false;
        });

        const mustKeepItems = [];
        const INTENT_BUDGET = 5000;
        let intentBudgetUsed = 0;
        const intentAppend = (text) => {
            if (intentBudgetUsed + text.length > INTENT_BUDGET) return false;
            mustKeepItems.push(text);
            intentBudgetUsed += text.length;
            return true;
        };

        for (const char of coreCharacters.slice(0, 6)) {
            const content = (char.currentContent || char.initialContent || '').substring(0, 300);
            if (!intentAppend(`- ${char.name}: ${content}`)) break;
        }

        const worldviewMats = activeMaterials.filter(m => m.type === 'worldview');
        for (const wv of worldviewMats.slice(0, 2)) {
            const rules = ruleStack._extractProhibitionRules(wv.currentContent || '', wv.name);
            for (const r of rules.slice(0, 2)) {
                if (!intentAppend(`- ${r.content}`)) break;
            }
        }

        const foreshadowMats = activeMaterials.filter(m => m.type === 'foreshadowing').filter(m => {
            if (!m.parentPlane || m.parentPlane === '主世界') return true;
            if (isInSubplane) return m.parentPlane === currentSubplaneId;
            return false;
        });
        for (const fs of foreshadowMats.slice(0, 3)) {
            const content = (fs.currentContent || fs.initialContent || '');
            if (content.includes('未回收') || content.includes('挂起') || content.includes('待回收')) {
                if (!intentAppend(`- 伏笔[${fs.name}]: ${content.substring(0, 150)}`)) break;
            }
        }

        const equipMats = activeMaterials.filter(m => m.type === 'equipment').filter(m => {
            if (!m.parentPlane || m.parentPlane === '主世界') return true;
            if (isInSubplane) return m.parentPlane === currentSubplaneId;
            return false;
        });
        for (const eq of equipMats.slice(0, 2)) {
            const content = (eq.currentContent || eq.initialContent || '').substring(0, 150);
            if (!intentAppend(`- 装备[${eq.name}]: ${content}`)) break;
        }

        const previousChapter = store.queryItems('chapters', { projectId: this.projectId })
            .filter(ch => ch.chapterNumber === chapterNumber - 1 && ch.content)
            .sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
        const prevChapterSummary = previousChapter
            ? (previousChapter.content || '').substring(0, 500)
            : '无（这是第一章）';

        const intentPrompt = `你是一个小说章节意图规划器。根据以下信息，为本章生成结构化的写作意图。

## 本章大纲
${chapterOutline || '无大纲'}

## 上一章结尾摘要
${prevChapterSummary}

## Must Keep（必须保持的核心要素）
${mustKeepItems.join('\n') || '无特殊要求'}

## 规则栈
${ruleStackText}

## 伏笔预算与Hook Agenda
${hookAgendaText}

请生成JSON格式的章节意图，包含以下字段：
{
    "goal": "本章核心目标（1-2句话，必须具体可执行）",
    "mustKeep": ["必须保持的要素1", "必须保持的要素2"],
    "mustAvoid": ["必须避免的问题1", "必须避免的问题2"],
    "hookAdvance": ["必须推进的伏笔ID或描述"],
    "hookResolve": ["可以回收的伏笔ID或描述"],
    "styleEmphasis": "风格强调（如无特殊则为null）",
    "conflictDesign": "本章冲突设计（冲突类型+对立双方+赌注）",
    "chapterEndHook": "章末钩子设计（悬念/反转/新威胁）"
}

要求：
1. goal必须具体，不能是"推进剧情"这种空话
2. mustKeep至少包含2条核心角色/设定约束
3. mustAvoid至少包含1条（基于规则栈L1/L2层约束）
4. hookAdvance必须包含至少1条（如果有mustAdvance的伏笔）
5. conflictDesign必须明确冲突的对立双方和赌注
6. chapterEndHook必须设计具体的章末悬念`;

        let intent = null;
        try {
            const apiConfig = options.apiConfig || this._getApiConfig();
            const result = await llm.chat([
                { role: 'system', content: '你是专业的小说章节意图规划器。只输出JSON，不要任何其他文字。' },
                { role: 'user', content: intentPrompt }
            ], { apiConfig, maxTokens: 2048, temperature: 0.3 });

            const responseText = result.choices?.[0]?.message?.content || result.response || (typeof result === 'string' ? result : null);
            intent = extractJSON(responseText);
            if (!intent) {
                intent = this._generateFallbackIntent(chapterNumber, chapterOutline, hookAgenda);
            }
        } catch (err) {
            console.warn('[INTENT] LLM generation failed, using fallback:', err.message);
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
            hookAgenda,
            generatedAt: new Date().toISOString()
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
        const staleDebt = (hookAgenda.staleDebt || []).map(h => `${h.id}(${h.type},已${h.age}章)`);

        return {
            goal: chapterOutline ? `执行大纲: ${chapterOutline.substring(0, 100)}` : `完成第${chapterNumber}章的剧情推进`,
            mustKeep: ['保持角色性格一致', '遵循世界观设定'],
            mustAvoid: ['不违反核心设定', '不引入与主线无关的支线'],
            hookAdvance: mustAdvance,
            hookResolve: eligibleResolve,
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
        lines.push('【章节意图 - Chapter Intent】');
        lines.push('');
        lines.push(`## Goal`);
        lines.push(intent.goal);
        lines.push('');
        lines.push('## Must Keep');
        (intent.mustKeep || []).forEach(item => lines.push(`- ${item}`));
        lines.push('');
        lines.push('## Must Avoid');
        (intent.mustAvoid || []).forEach(item => lines.push(`- ${item}`));
        lines.push('');

        if (intent.conflictDesign) {
            lines.push('## 冲突设计');
            lines.push(typeof intent.conflictDesign === 'string' ? intent.conflictDesign : JSON.stringify(intent.conflictDesign));
            lines.push('');
        }

        if (intent.chapterEndHook) {
            lines.push('## 章末钩子');
            lines.push(typeof intent.chapterEndHook === 'string' ? intent.chapterEndHook : JSON.stringify(intent.chapterEndHook));
            lines.push('');
        }

        if (intent.hookAdvance && intent.hookAdvance.length > 0) {
            lines.push('### Hook Must Advance');
            intent.hookAdvance.forEach(h => lines.push(`- ${h}`));
            lines.push('');
        }

        if (intent.hookResolve && intent.hookResolve.length > 0) {
            lines.push('### Hook Eligible Resolve');
            intent.hookResolve.forEach(h => lines.push(`- ${h}`));
            lines.push('');
        }

        if (intent.hookAgenda) {
            const agenda = intent.hookAgenda;
            lines.push('### 伏笔预算');
            lines.push(`- 当前 ${agenda.budget.active} 条活跃伏笔 / 上限 ${agenda.budget.max} 条 — 剩余 ${agenda.budget.remaining} 个新坑位`);
            if (agenda.budget.nearCapacity) {
                lines.push('- ⚠ 接近容量上限！优先回收旧债，不要轻易开新线。');
            }
        }

        return lines.join('\n');
    }

    async getIntent(chapterNumber) {
        const intentStore = await this._getIntentStore();
        const key = `chapter-${String(chapterNumber).padStart(4, '0')}`;
        return intentStore.chapters[key] || null;
    }

    _getApiConfig() {
        const llmConfig = require('./llmConfig');
        return llmConfig.resolveStepConfig('intent-planner', null);
    }
}

function getChapterIntentPlanner(projectId) {
    return new ChapterIntentPlanner(projectId);
}

module.exports = {
    ChapterIntentPlanner,
    getChapterIntentPlanner
};
