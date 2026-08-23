const {
    CONTEXT_BUDGETS, COMPACT_MODELS, LONG_CONTEXT_MODELS, ULTRA_LONG_CONTEXT_MODELS,
    COMPACT_PRIORITIES, LONG_PRIORITIES, ULTRA_LONG_PRIORITIES,
    estimateTokens, truncateToTokens, resolveModelBudget, resolveModelCategory
} = require('./contextBudgetConstants');

class ContextBudget {
    constructor(model = 'default', maxTokens = 8192) {
        this.model = model;
        this.totalBudget = resolveModelBudget(model);
        const maxOutput = Math.floor(this.totalBudget * 0.3);
        this.outputReserve = Math.min(maxTokens, maxOutput, 16384);
        this.inputBudget = this.totalBudget - this.outputReserve;
        const category = resolveModelCategory(model);
        this.isLongContext = category === 'long' || category === 'ultra_long' || LONG_CONTEXT_MODELS.includes(model) || this.totalBudget >= 100000;
        this.isUltraLongContext = category === 'ultra_long' || ULTRA_LONG_CONTEXT_MODELS.includes(model) || this.totalBudget >= 400000;
        this.isCompact = category === 'compact' || COMPACT_MODELS.includes(model) || this.totalBudget <= 40000;
        this.slotPriorities = this.isUltraLongContext ? ULTRA_LONG_PRIORITIES : (this.isLongContext ? LONG_PRIORITIES : COMPACT_PRIORITIES);
        this.slots = {};
        this.allocated = 0;
    }

    allocate(slotName, content, options = {}) {
        const slot = this.slotPriorities[slotName];
        if (!slot) {
            const tokens = estimateTokens(content);
            this.slots[slotName] = { content, tokens, priority: 0, critical: false };
            this.allocated += tokens;
            return content;
        }
        const maxTokens = Math.floor(this.inputBudget * slot.maxRatio);
        const tokens = estimateTokens(content);
        const critical = options.critical || /\[NEEDS_CONTEXT\]/.test(content);
        if (tokens <= maxTokens) {
            this.slots[slotName] = { content, tokens, priority: slot.priority, maxTokens, critical };
            this.allocated += tokens;
            return content;
        }
        if (critical) {
            const overflow = tokens - maxTokens;
            const stealFrom = Object.entries(this.slots)
                .filter(([n, s]) => !s.critical && s.priority < slot.priority)
                .sort((a, b) => a[1].priority - b[1].priority);
            let recovered = 0;
            for (const [name, s] of stealFrom) {
                if (recovered >= overflow) break;
                const shrinkTo = Math.max(50, Math.floor(s.tokens * 0.5));
                const saved = s.tokens - shrinkTo;
                s.content = truncateToTokens(s.content, shrinkTo);
                s.tokens = estimateTokens(s.content);
                this.allocated -= saved;
                recovered += saved;
            }
            this.slots[slotName] = { content, tokens, priority: slot.priority, maxTokens: tokens, critical };
            this.allocated += tokens;
            return content;
        }
        const truncated = truncateToTokens(content, maxTokens);
        const newTokens = estimateTokens(truncated);
        this.slots[slotName] = { content: truncated, tokens: newTokens, priority: slot.priority, maxTokens, originalTokens: tokens, wasTruncated: true };
        this.allocated += newTokens;
        return truncated;
    }

    buildSystemPrompt() {
        const sorted = Object.entries(this.slots)
            .sort((a, b) => (b[1].priority || 0) - (a[1].priority || 0));
        const parts = [];
        let usedTokens = 0;
        const systemLimit = Math.floor(this.inputBudget * 0.75);
        for (const [name, slot] of sorted) {
            if (name === 'chapter_content' || name === 'chapter_outline' || name === 'review_feedback') continue;
            if (!slot.content) continue;
            const tokens = estimateTokens(slot.content);
            if (usedTokens + tokens > systemLimit) {
                if (slot.critical) { parts.push(slot.content); usedTokens += tokens; continue; }
                const remaining = Math.floor(systemLimit - usedTokens);
                if (remaining > 100) { const truncated = truncateToTokens(slot.content, remaining); parts.push(truncated); usedTokens += estimateTokens(truncated); }
                break;
            }
            parts.push(slot.content);
            usedTokens += tokens;
        }
        return parts.filter(p => p).join('\n\n');
    }

    buildUserPrompt(mainContent) { return mainContent || ''; }

    getReport() {
        return {
            model: this.model, totalBudget: this.totalBudget, outputReserve: this.outputReserve,
            inputBudget: this.inputBudget, allocated: this.allocated,
            utilization: ((this.allocated / this.inputBudget) * 100).toFixed(1) + '%',
            slots: Object.fromEntries(Object.entries(this.slots).map(([k, v]) => [k, { tokens: v.tokens, maxTokens: v.maxTokens, wasTruncated: v.wasTruncated || false, originalTokens: v.originalTokens }]))
        };
    }
}

async function calculateMaxBatchChapters(projectId, model) {
    const store = require('../../store');
    const { getAgentPrompt, buildConstraintInjection } = require('../agentPrompts');
    const { getDataContext } = require('../dataContext');

    const budget = new ContextBudget(model, 8192);
    const priorities = budget.isUltraLongContext ? ULTRA_LONG_PRIORITIES : (budget.isLongContext ? LONG_PRIORITIES : COMPACT_PRIORITIES);
    const FIXED_SLOTS = ['agent_prompt', 'worldview_materials', 'character_materials', 'other_materials', 'style_guidance', 'constraint_rules', 'memory_context', 'style_template', 'foreshadowing', 'character_states'];
    const PER_CHAPTER_SLOTS = ['chapter_outline', 'previous_chapter', 'review_feedback'];
    const fixedTokens = {};
    let totalFixed = 0;

    const writerPrompt = await getAgentPrompt('writer', 'novel', projectId);
    if (writerPrompt?.system) { const t = estimateTokens(writerPrompt.system); fixedTokens.agent_prompt = t; totalFixed += t; }

    const materials = (await store.queryItems('materials', { projectId })).filter(m => !m.archived && m.type !== 'index');
    const worldviewMats = materials.filter(m => ['worldview', 'power-system', 'scene', 'phenomenon', 'institution', 'organization', 'faction', 'geography', 'technology'].includes(m.type));
    const characterMats = materials.filter(m => ['character', 'character-psychology', 'character-combat', 'character-personality', 'character-relationship', 'character-dialogue', 'character-behavior', 'foreshadowing'].includes(m.type));
    const otherMats = materials.filter(m => !['worldview', 'power-system', 'scene', 'phenomenon', 'institution', 'organization', 'faction', 'geography', 'technology', 'character', 'character-psychology', 'character-combat', 'character-personality', 'character-relationship', 'character-dialogue', 'character-behavior', 'foreshadowing'].includes(m.type));

    if (budget.isUltraLongContext) {
        if (worldviewMats.length > 0) { const content = `【世界观素材】\n${worldviewMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`; const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.worldview_materials.maxRatio)); fixedTokens.worldview_materials = t; totalFixed += t; }
        if (characterMats.length > 0) { const content = `【角色素材】\n${characterMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`; const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.character_materials.maxRatio)); fixedTokens.character_materials = t; totalFixed += t; }
        if (otherMats.length > 0) { const content = `【其他素材】\n${otherMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`; const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.other_materials.maxRatio)); fixedTokens.other_materials = t; totalFixed += t; }
    } else {
        const indexMats = (await store.queryItems('materials', { projectId })).filter(m => m.type === 'index');
        if (indexMats.length > 0) { const content = `【素材索引（按需加载）】\n${indexMats.map(m => m.currentContent || '').join('\n\n')}`; const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.worldview_materials.maxRatio)); fixedTokens.worldview_materials = t; totalFixed += t; }
        else {
            if (worldviewMats.length > 0) { const content = `【世界观素材】${worldviewMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, 200)}`).join('\n')}`; const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.worldview_materials.maxRatio)); fixedTokens.worldview_materials = t; totalFixed += t; }
            if (characterMats.length > 0) { const content = `【角色素材】${characterMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, 200)}`).join('\n')}`; const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.character_materials.maxRatio)); fixedTokens.character_materials = t; totalFixed += t; }
        }
        if (otherMats.length > 0) { const content = `【其他素材】${otherMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, 150)}`).join('\n')}`; const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.other_materials.maxRatio)); fixedTokens.other_materials = t; totalFixed += t; }
    }

    const _cbCtx = await getDataContext(projectId);
    const project = await _cbCtx.getProject();
    if (project?.styleGuidance) { const t = Math.min(estimateTokens(project.styleGuidance), Math.floor(budget.inputBudget * priorities.style_guidance.maxRatio)); fixedTokens.style_guidance = t; totalFixed += t; }
    const constraintText = await buildConstraintInjection(projectId);
    if (constraintText) { const t = Math.min(estimateTokens(constraintText), Math.floor(budget.inputBudget * priorities.constraint_rules.maxRatio)); fixedTokens.constraint_rules = t; totalFixed += t; }
    const memoryEstimate = Math.floor(budget.inputBudget * priorities.memory_context.maxRatio);
    fixedTokens.memory_context = memoryEstimate;
    totalFixed += memoryEstimate;

    const chapters = (await store.queryItems('chapters', { projectId })).filter(c => !c.archived).sort((a, b) => a.chapterNumber - b.chapterNumber);
    const writtenChapters = chapters.filter(c => c.content);
    let avgOutlineTokens = 200;
    let avgPrevChapterTokens = 500;
    if (writtenChapters.length > 0) {
        const sampleOutlines = writtenChapters.slice(-5).map(c => (c.outline || '').substring(0, 2000));
        const sampleContents = writtenChapters.slice(-5).map(c => (c.content || '').substring(0, 1500));
        if (sampleOutlines.length > 0) { avgOutlineTokens = Math.ceil(sampleOutlines.reduce((s, o) => s + estimateTokens(o), 0) / sampleOutlines.length); }
        if (sampleContents.length > 0) { avgPrevChapterTokens = Math.ceil(sampleContents.reduce((s, c) => s + estimateTokens(c), 0) / sampleContents.length); }
    }

    const perChapterInput = avgOutlineTokens + avgPrevChapterTokens;
    const perChapterOutput = Math.ceil(2800 * 1.5);
    const perChapterTotal = perChapterInput + perChapterOutput;
    const availableForChapters = budget.totalBudget - totalFixed;
    const maxChapters = Math.max(1, Math.floor(availableForChapters / perChapterTotal));
    const safeMax = budget.isUltraLongContext ? Math.min(maxChapters, 15) : budget.isLongContext ? Math.min(maxChapters, 5) : 1;
    const recommendedMax = budget.isUltraLongContext ? Math.min(maxChapters, 8) : budget.isLongContext ? Math.min(maxChapters, 3) : 1;

    return { model, totalBudget: budget.totalBudget, outputReserve: budget.outputReserve, inputBudget: budget.inputBudget, fixedCost: totalFixed, fixedBreakdown: fixedTokens, perChapterInput, perChapterOutput, perChapterTotal, availableForChapters, maxChapters, safeMax, recommendedMax, materialCount: materials.length, worldviewMatCount: worldviewMats.length, characterMatCount: characterMats.length, otherMatCount: otherMats.length, writtenChapterCount: writtenChapters.length, avgOutlineTokens, avgPrevChapterTokens };
}

module.exports = { ContextBudget, calculateMaxBatchChapters };
