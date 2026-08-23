const logger = require('../../shared/logger');
const store = require('../../store');
const { resolveConfig } = require('../../config');
const { normalizeTargetChapters } = require('../../config/targetChaptersNormalizer');
const { resolveGenreFromProject } = require('../genreConfig');
const { getDataContext } = require('../dataContext');
const { MAX_ACTIVE_HOOKS, HOOK_TYPES, MODE_STALE_THRESHOLDS, STALE_THRESHOLD_CHAPTERS, MODE_URGENT_THRESHOLDS, URGENT_THRESHOLD_CHAPTERS, INVALID_NOTES_PATTERNS } = require('./hookBudgetConstants');
const { detectResolutions, detectNewHooks } = require('./hookBudgetDetector');

class HookBudgetSystem {
    constructor(projectId) { this.projectId = projectId; }

    async _getHookStore() {
        const ctx = await getDataContext(this.projectId);
        const project = await ctx.getProject();
        if (!project) return { hooks: [], lastUpdated: null };
        if (!project.hookBudget) { project.hookBudget = { hooks: [], lastUpdated: null }; await store.setItem('projects', this.projectId, project); }
        return project.hookBudget;
    }

    async _saveHookStore(data) {
        const ctx = await getDataContext(this.projectId);
        const project = await ctx.getProject();
        if (!project) return;
        project.hookBudget = { ...data, lastUpdated: new Date().toISOString() };
        await store.setItem('projects', this.projectId, project);
    }

    async getActiveHooks() { const s = await this._getHookStore(); return (s.hooks || []).filter(h => h.status === 'open' || h.status === 'active'); }
    async getAllHooks() { const s = await this._getHookStore(); return s.hooks || []; }

    async _getModeThresholds() {
        const ctx = await getDataContext(this.projectId);
        const project = await ctx.getProject();
        const mode = project?.mode || 'novel';
        return { stale: MODE_STALE_THRESHOLDS[mode] || STALE_THRESHOLD_CHAPTERS, urgent: MODE_URGENT_THRESHOLDS[mode] || URGENT_THRESHOLD_CHAPTERS };
    }

    async getBudgetStatus(currentChapter) {
        const activeHooks = await this.getActiveHooks();
        const remaining = Math.max(0, MAX_ACTIVE_HOOKS - activeHooks.length);
        const nearCapacity = activeHooks.length >= MAX_ACTIVE_HOOKS - 2;
        const overCapacity = activeHooks.length > MAX_ACTIVE_HOOKS;
        const thresholds = await this._getModeThresholds();
        const staleHooks = activeHooks.filter(h => { if (!currentChapter) return false; return currentChapter - h.startChapter > thresholds.stale; });
        const urgentHooks = activeHooks.filter(h => { if (!h.expectedPayoffEnd || !currentChapter) return false; return currentChapter >= h.expectedPayoffEnd - thresholds.urgent; });
        return { activeCount: activeHooks.length, maxCapacity: MAX_ACTIVE_HOOKS, remaining, nearCapacity, overCapacity, staleCount: staleHooks.length, urgentCount: urgentHooks.length, staleHooks, urgentHooks };
    }

    async generateHookAgenda(currentChapter) {
        const activeHooks = await this.getActiveHooks();
        const budget = await this.getBudgetStatus(currentChapter);
        const thresholds = await this._getModeThresholds();
        const mustAdvance = [], eligibleResolve = [], staleDebt = [], avoidNewFamilies = new Set();
        for (const hook of activeHooks) {
            const age = currentChapter ? currentChapter - hook.startChapter : 0;
            if (budget.urgentHooks.includes(hook)) { eligibleResolve.push(hook); avoidNewFamilies.add(hook.type); }
            if (age > thresholds.stale) { staleDebt.push(hook); avoidNewFamilies.add(hook.type); }
            if (hook.lastAdvancedChapter && currentChapter && currentChapter - hook.lastAdvancedChapter >= 5) mustAdvance.push(hook);
            else if (!hook.lastAdvancedChapter && currentChapter && currentChapter - hook.startChapter >= 3) mustAdvance.push(hook);
        }
        return {
            mustAdvance: mustAdvance.map(h => ({ id: h.id, type: h.type, notes: h.notes })),
            eligibleResolve: eligibleResolve.map(h => ({ id: h.id, type: h.type, notes: h.notes })),
            staleDebt: staleDebt.map(h => ({ id: h.id, type: h.type, age: currentChapter - h.startChapter, notes: h.notes })),
            avoidNewFamilies: [...avoidNewFamilies],
            budget: { active: budget.activeCount, max: budget.maxCapacity, remaining: budget.remaining, nearCapacity: budget.nearCapacity, overCapacity: budget.overCapacity }
        };
    }

    async formatHookAgendaForPrompt(currentChapter) {
        const agenda = await this.generateHookAgenda(currentChapter);
        const lines = [];
        lines.push('【伏笔预算与Hook Agenda】');
        lines.push(`- 当前 ${agenda.budget.active} 条活跃伏笔 / 上限 ${agenda.budget.max} 条 — 剩余 ${agenda.budget.remaining} 个新坑位`);
        if (agenda.budget.nearCapacity) lines.push('- ⚠ 接近容量上限！优先回收旧债，不要轻易开新线。');
        if (agenda.budget.overCapacity) lines.push('- 🚨 超出容量上限！必须回收旧债后才能开新伏笔。');
        if (agenda.mustAdvance.length > 0) { lines.push('', '### Must Advance (必须推进)'); agenda.mustAdvance.forEach(h => lines.push(`- ${h.id}(${h.type}): ${h.notes}`)); }
        if (agenda.eligibleResolve.length > 0) { lines.push('', '### Eligible Resolve (可回收)'); agenda.eligibleResolve.forEach(h => lines.push(`- ${h.id}(${h.type}): ${h.notes}`)); }
        if (agenda.staleDebt.length > 0) { lines.push('', '### Stale Debt (过期旧债 — 必须优先处理)'); agenda.staleDebt.forEach(h => lines.push(`- ${h.id}(${h.type}, 已${h.age}章未回收): ${h.notes}`)); }
        if (agenda.avoidNewFamilies.length > 0) { lines.push('', '### Avoid New Hook Families (禁止新增此类伏笔)'); agenda.avoidNewFamilies.forEach(f => lines.push(`- ${f}`)); }
        return lines.join('\n');
    }

    async registerHook(hookData) {
        const hookStore = await this._getHookStore();
        const activeHooks = (hookStore.hooks || []).filter(h => h.status === 'open' || h.status === 'active');
        if (activeHooks.length >= MAX_ACTIVE_HOOKS) { logger.warn('index', `[HOOK] 伏笔预算已满(${activeHooks.length}/${MAX_ACTIVE_HOOKS})，拒绝注册新伏笔: ${hookData.notes?.substring(0, 30) || hookData.type}`); return null; }
        const id = hookData.id || `H${String(hookStore.hooks.length + 1).padStart(3, '0')}`;
        const typeConfig = HOOK_TYPES[hookData.type] || HOOK_TYPES['伏笔铺垫'];
        const ctx = await getDataContext(this.projectId);
        const project = await ctx.getProject();
        const totalChapters = normalizeTargetChapters(project);
        const genre = resolveGenreFromProject(project);
        const hookConfig = resolveConfig(genre, project);
        const rangeScale = hookConfig.hook.rangeScale;
        const defaultStart = Math.max(3, Math.round(typeConfig.defaultRange[0] * rangeScale));
        const defaultEnd = Math.max(defaultStart + 3, Math.round(typeConfig.defaultRange[1] * rangeScale));
        const hook = { id, type: hookData.type || '伏笔铺垫', status: 'open', startChapter: hookData.startChapter || 0, lastAdvancedChapter: 0, expectedPayoffStart: hookData.expectedPayoffStart || defaultStart, expectedPayoffEnd: hookData.expectedPayoffEnd || Math.min(defaultEnd, totalChapters), payoffTiming: hookData.payoffTiming || typeConfig.payoffTiming, notes: hookData.notes || '', linkedHookIds: hookData.linkedHookIds || [], createdAt: new Date().toISOString() };
        hookStore.hooks.push(hook);
        await this._saveHookStore(hookStore);
        return hook;
    }

    async advanceHook(hookId, chapterNumber) {
        const hookStore = await this._getHookStore();
        const hook = hookStore.hooks.find(h => h.id === hookId);
        if (!hook) return null;
        hook.lastAdvancedChapter = chapterNumber;
        if (hook.status === 'open') hook.status = 'active';
        await this._saveHookStore(hookStore);
        return hook;
    }

    async resolveHook(hookId, chapterNumber, resolution) {
        const hookStore = await this._getHookStore();
        const hook = hookStore.hooks.find(h => h.id === hookId);
        if (!hook) return null;
        hook.status = 'resolved'; hook.resolvedChapter = chapterNumber; hook.resolution = resolution || ''; hook.resolvedAt = new Date().toISOString();
        await this._saveHookStore(hookStore);
        return hook;
    }

    async updateHooksFromContent(chapterNumber, content) {
        const results = { advanced: [], resolved: [], newDetected: [] };
        if (!content) return results;
        const activeHooks = await this.getActiveHooks();
        for (const hook of activeHooks) {
            const { mentioned, resolved } = detectResolutions(hook, content);
            if (mentioned) {
                if (resolved) { this.resolveHook(hook.id, chapterNumber, `在第${chapterNumber}章正文中检测到回收`); results.resolved.push(hook.id); }
                else { this.advanceHook(hook.id, chapterNumber); results.advanced.push(hook.id); }
            }
        }
        const budget = await this.getBudgetStatus(chapterNumber);
        const newHookCandidates = detectNewHooks(content, activeHooks, chapterNumber, budget);
        for (const candidate of newHookCandidates) {
            const newHook = await this.registerHook({ type: candidate.type, startChapter: chapterNumber, notes: candidate.notes });
            if (newHook) results.newDetected.push(newHook.id);
        }
        return results;
    }

    async syncFromForeshadowingMaterials() {
        const materials = await store.queryItems('materials', { projectId: this.projectId });
        const foreshadowings = materials.filter(m => m.type === 'foreshadowing' && !m.archived);
        const hookStore = await this._getHookStore();
        const existingNotes = new Set((hookStore.hooks || []).map(h => h.notes));
        let imported = 0;
        for (const f of foreshadowings) {
            const content = f.currentContent || f.initialContent || '';
            const isRecycled = content.includes('已回收') || content.includes('已揭示') || content.includes('已解决');
            const nameMatch = f.name.match(/第?(\d+)[章回]?/);
            const startChapter = nameMatch ? parseInt(nameMatch[1]) : 1;
            const existingHook = (hookStore.hooks || []).find(h => h.notes && h.notes.includes(f.name));
            if (existingHook) { if (isRecycled && existingHook.status !== 'resolved') { existingHook.status = 'resolved'; existingHook.resolution = `素材库标记为已回收: ${f.name}`; } }
            else if (!isRecycled && !existingNotes.has(f.name)) { await this.registerHook({ type: '伏笔铺垫', startChapter, notes: f.name, payoffTiming: 'mid-arc' }); imported++; }
        }
        return imported;
    }

    async getHooksSummary() {
        const allHooks = await this.getAllHooks();
        const active = allHooks.filter(h => h.status === 'open' || h.status === 'active');
        const resolved = allHooks.filter(h => h.status === 'resolved');
        const byType = {}; for (const h of active) { byType[h.type] = (byType[h.type] || 0) + 1; }
        return { total: allHooks.length, active: active.length, resolved: resolved.length, byType, hooks: allHooks.map(h => ({ id: h.id, type: h.type, status: h.status, start: h.startChapter, lastAdvanced: h.lastAdvancedChapter, expectedPayoff: `${h.expectedPayoffStart}-${h.expectedPayoffEnd}`, notes: h.notes })) };
    }

    async cleanupInvalidHooks() {
        const hookStore = await this._getHookStore();
        const before = hookStore.hooks.length;
        hookStore.hooks = hookStore.hooks.filter(h => {
            if (!h.notes || h.notes.trim().length < 3) return false;
            for (const pattern of INVALID_NOTES_PATTERNS) { if (pattern.test(h.notes.trim())) return false; }
            return true;
        });
        const removed = before - hookStore.hooks.length;
        if (removed > 0) { await this._saveHookStore(hookStore); logger.info('index', `[HOOK] 清理了${removed}条无效伏笔记录`); }
        return { removed, remaining: hookStore.hooks.length };
    }
}

function getHookBudgetForProject(projectId) { return new HookBudgetSystem(projectId); }

module.exports = { HookBudgetSystem, getHookBudgetForProject, MAX_ACTIVE_HOOKS, HOOK_TYPES };
