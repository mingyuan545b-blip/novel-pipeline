const CONTEXT_BUDGETS = {
    'MiniMax-M2.7': 32000, 'MiniMax-Text-01': 32000,
    'gpt-4o': 16000, 'gpt-4o-mini': 12000, 'gpt-4-turbo': 16000,
    'deepseek-chat': 24000, 'deepseek-reasoner': 24000,
    'qwen-max': 16000, 'qwen-plus': 12000, 'qwen-long': 80000,
    'qwen-max-latest': 16000, 'qwen-plus-latest': 12000, 'qwen-turbo': 12000,
    'qwen3.5-plus': 256000, 'qwen3.5-max': 128000,
    'qwen3-235b-a22b': 128000, 'qwen3-32b': 128000,
    'Qwen3.5-27B': 128000, 'Qwen3.5-397B-A17B': 128000,
    'qwen3.6-plus': 800000, 'Qwen3.6-plus': 800000,
    'qwen3-30b-a3b': 512000, 'Qwen3-30B-A3B': 512000,
    'Qwen3.6-35B-A3B': 256000, 'qwen3.6-35b-a3b': 256000,
    'Qwen3.6-35B-A3B-Q8_0': 256000,
    'glm-4-plus': 16000, 'glm-4': 12000,
    'moonshot-v1-128k': 32000, 'moonshot-v1-32k': 16000,
    'default': 16000
};

const COMPACT_MODELS = ['MiniMax-M2.7', 'MiniMax-Text-01', 'gpt-4o-mini', 'qwen-turbo'];
const LONG_CONTEXT_MODELS = ['qwen3.6-plus', 'Qwen3.6-plus', 'qwen3.5-plus', 'qwen-long', 'moonshot-v1-128k'];
const ULTRA_LONG_CONTEXT_MODELS = ['qwen3-30b-a3b', 'Qwen3-30B-A3B', 'qwen3.6-plus', 'Qwen3.6-plus', 'Qwen3.6-35B-A3B', 'qwen3.6-35b-a3b', 'Qwen3.6-35B-A3B-Q8_0'];

const COMPACT_PRIORITIES = {
    agent_prompt: { priority: 100, maxRatio: 0.08, label: 'Agent提示词' },
    worldview_materials: { priority: 99, maxRatio: 0.10, label: '世界观素材' },
    character_materials: { priority: 99, maxRatio: 0.10, label: '角色素材' },
    style_guidance: { priority: 98, maxRatio: 0.04, label: '风格指导(写作手法)' },
    constraint_rules: { priority: 95, maxRatio: 0.03, label: '架构约束(精简)' },
    memory_context: { priority: 90, maxRatio: 0.12, label: '分层记忆(精简)' },
    other_materials: { priority: 80, maxRatio: 0.06, label: '其他素材' },
    chapter_outline: { priority: 75, maxRatio: 0.06, label: '章节大纲' },
    previous_chapter: { priority: 70, maxRatio: 0.06, label: '上一章摘要' },
    foreshadowing: { priority: 65, maxRatio: 0.04, label: '未回收伏笔' },
    character_states: { priority: 60, maxRatio: 0.04, label: '人物状态' },
    review_feedback: { priority: 55, maxRatio: 0.06, label: '审核反馈' },
    technique_injection: { priority: 53, maxRatio: 0.04, label: '藏经阁技法' },
    beat_allocation: { priority: 52, maxRatio: 0.03, label: '节拍分配' },
    style_template: { priority: 50, maxRatio: 0.02, label: '风格模板' },
    chapter_content: { priority: 45, maxRatio: 0.20, label: '章节正文(精简)' }
};

const LONG_PRIORITIES = {
    agent_prompt: { priority: 100, maxRatio: 0.03, label: 'Agent提示词' },
    worldview_materials: { priority: 99, maxRatio: 0.12, label: '世界观素材' },
    character_materials: { priority: 99, maxRatio: 0.12, label: '角色素材' },
    style_guidance: { priority: 98, maxRatio: 0.03, label: '风格指导(写作手法)' },
    constraint_rules: { priority: 95, maxRatio: 0.02, label: '架构约束' },
    memory_context: { priority: 90, maxRatio: 0.22, label: '分层记忆(完整)' },
    other_materials: { priority: 80, maxRatio: 0.08, label: '其他素材' },
    chapter_outline: { priority: 75, maxRatio: 0.05, label: '章节大纲' },
    previous_chapter: { priority: 70, maxRatio: 0.08, label: '上一章完整' },
    foreshadowing: { priority: 65, maxRatio: 0.05, label: '未回收伏笔' },
    character_states: { priority: 60, maxRatio: 0.05, label: '人物状态' },
    review_feedback: { priority: 55, maxRatio: 0.05, label: '审核反馈' },
    technique_injection: { priority: 53, maxRatio: 0.04, label: '藏经阁技法' },
    beat_allocation: { priority: 52, maxRatio: 0.03, label: '节拍分配' },
    style_template: { priority: 50, maxRatio: 0.02, label: '风格模板' },
    chapter_content: { priority: 45, maxRatio: 0.35, label: '章节正文(完整)' }
};

const ULTRA_LONG_PRIORITIES = {
    agent_prompt: { priority: 100, maxRatio: 0.02, label: 'Agent提示词' },
    worldview_materials: { priority: 99, maxRatio: 0.08, label: '世界观素材(完整)' },
    character_materials: { priority: 99, maxRatio: 0.08, label: '角色素材(完整)' },
    style_guidance: { priority: 98, maxRatio: 0.02, label: '风格指导(完整)' },
    constraint_rules: { priority: 97, maxRatio: 0.02, label: '架构约束(完整)' },
    memory_context: { priority: 96, maxRatio: 0.10, label: '分层记忆(完整)' },
    other_materials: { priority: 90, maxRatio: 0.05, label: '其他素材(完整)' },
    chapter_outline: { priority: 85, maxRatio: 0.03, label: '章节大纲(完整)' },
    previous_chapter: { priority: 80, maxRatio: 0.10, label: '前N章全文' },
    foreshadowing: { priority: 75, maxRatio: 0.03, label: '伏笔追踪(完整)' },
    character_states: { priority: 70, maxRatio: 0.03, label: '人物状态(完整)' },
    review_feedback: { priority: 65, maxRatio: 0.05, label: '审核反馈' },
    technique_injection: { priority: 63, maxRatio: 0.04, label: '藏经阁技法' },
    beat_allocation: { priority: 62, maxRatio: 0.03, label: '节拍分配' },
    style_template: { priority: 60, maxRatio: 0.01, label: '风格模板' },
    chapter_content: { priority: 55, maxRatio: 0.40, label: '章节正文(完整)' }
};

function estimateTokens(text) {
    if (!text) return 0;
    if (typeof text !== 'string') text = JSON.stringify(text);
    const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    return Math.ceil(chinese * 1.5 + (text.length - chinese) * 0.5);
}

function truncateToTokens(text, maxTokens) {
    if (!text) return '';
    const est = estimateTokens(text);
    if (est <= maxTokens) return text;
    const ratio = maxTokens / est;
    const targetLen = Math.floor(text.length * ratio * 0.9);
    return text.substring(0, targetLen) + '...(已截断)';
}

function resolveModelBudget(model) {
    if (CONTEXT_BUDGETS[model]) return CONTEXT_BUDGETS[model];
    const ml = model.toLowerCase();
    if (ml.includes('qwen3.6-35b-a3b') || ml.includes('qwen3.6-35b') || ml.includes('qwen3-30b-a3b')) return 256000;
    if (ml.includes('qwen3.6-plus') || ml.includes('qwen3.6-plus')) return 800000;
    if (ml.includes('qwen3.5-plus')) return 256000;
    if (ml.includes('qwen3-235b') || ml.includes('qwen3-32b')) return 128000;
    if (ml.includes('qwen-long')) return 80000;
    if (ml.includes('minimax-m2.7') || ml.includes('minimax-text')) return 32000;
    if (ml.includes('deepseek')) return 24000;
    if (ml.includes('gpt-4o') || ml.includes('gpt-4-turbo')) return 16000;
    if (ml.includes('moonshot-v1-128k')) return 32000;
    if (ml.includes('glm-4')) return 16000;
    return CONTEXT_BUDGETS.default;
}

function resolveModelCategory(model) {
    const ml = model.toLowerCase();
    if (ml.includes('qwen3.6-35b-a3b') || ml.includes('qwen3-30b-a3b') || ml.includes('qwen3.6-plus')) return 'ultra_long';
    if (ml.includes('qwen3.5-plus') || ml.includes('qwen-long') || ml.includes('moonshot-v1-128k')) return 'long';
    if (ml.includes('minimax-m2.7') || ml.includes('gpt-4o-mini') || ml.includes('qwen-turbo')) return 'compact';
    return null;
}

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
                if (slot.critical) {
                    parts.push(slot.content);
                    usedTokens += tokens;
                    continue;
                }
                const remaining = Math.floor(systemLimit - usedTokens);
                if (remaining > 100) {
                    const truncated = truncateToTokens(slot.content, remaining);
                    parts.push(truncated);
                    usedTokens += estimateTokens(truncated);
                }
                break;
            }

            parts.push(slot.content);
            usedTokens += tokens;
        }

        return parts.filter(p => p).join('\n\n');
    }

    buildUserPrompt(mainContent) {
        return mainContent || '';
    }

    getReport() {
        return {
            model: this.model,
            totalBudget: this.totalBudget,
            outputReserve: this.outputReserve,
            inputBudget: this.inputBudget,
            allocated: this.allocated,
            utilization: ((this.allocated / this.inputBudget) * 100).toFixed(1) + '%',
            slots: Object.fromEntries(
                Object.entries(this.slots).map(([k, v]) => [k, { tokens: v.tokens, maxTokens: v.maxTokens, wasTruncated: v.wasTruncated || false, originalTokens: v.originalTokens }])
            )
        };
    }
}

function calculateMaxBatchChapters(projectId, model) {
    const store = require('../store');
    const { getAgentPrompt, buildConstraintInjection } = require('./agentPrompts');

    const budget = new ContextBudget(model, 8192);
    const priorities = budget.isUltraLongContext ? ULTRA_LONG_PRIORITIES : (budget.isLongContext ? LONG_PRIORITIES : COMPACT_PRIORITIES);

    const FIXED_SLOTS = ['agent_prompt', 'worldview_materials', 'character_materials', 'other_materials', 'style_guidance', 'constraint_rules', 'memory_context', 'style_template', 'foreshadowing', 'character_states'];
    const PER_CHAPTER_SLOTS = ['chapter_outline', 'previous_chapter', 'review_feedback'];

    const fixedTokens = {};
    let totalFixed = 0;

    const writerPrompt = getAgentPrompt('writer', 'novel', projectId);
    if (writerPrompt?.system) {
        const t = estimateTokens(writerPrompt.system);
        fixedTokens.agent_prompt = t;
        totalFixed += t;
    }

    const materials = store.queryItems('materials', { projectId }).filter(m => !m.archived && m.type !== 'index');
    const worldviewMats = materials.filter(m => ['worldview', 'power-system', 'scene', 'phenomenon', 'institution', 'organization', 'faction', 'geography', 'technology'].includes(m.type));
    const characterMats = materials.filter(m => ['character', 'character-psychology', 'character-combat', 'character-personality', 'character-relationship', 'character-dialogue', 'character-behavior', 'foreshadowing'].includes(m.type));
    const otherMats = materials.filter(m => !['worldview', 'power-system', 'scene', 'phenomenon', 'institution', 'organization', 'faction', 'geography', 'technology', 'character', 'character-psychology', 'character-combat', 'character-personality', 'character-relationship', 'character-dialogue', 'character-behavior', 'foreshadowing'].includes(m.type));

    if (budget.isUltraLongContext) {
        if (worldviewMats.length > 0) {
            const content = `【世界观素材】\n${worldviewMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`;
            const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.worldview_materials.maxRatio));
            fixedTokens.worldview_materials = t;
            totalFixed += t;
        }
        if (characterMats.length > 0) {
            const content = `【角色素材】\n${characterMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`;
            const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.character_materials.maxRatio));
            fixedTokens.character_materials = t;
            totalFixed += t;
        }
        if (otherMats.length > 0) {
            const content = `【其他素材】\n${otherMats.map(m => `--- ${m.name} ---\n${m.currentContent || ''}`).join('\n\n')}`;
            const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.other_materials.maxRatio));
            fixedTokens.other_materials = t;
            totalFixed += t;
        }
    } else {
        const indexMats = store.queryItems('materials', { projectId }).filter(m => m.type === 'index');
        if (indexMats.length > 0) {
            const content = `【素材索引（按需加载）】\n${indexMats.map(m => m.currentContent || '').join('\n\n')}`;
            const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.worldview_materials.maxRatio));
            fixedTokens.worldview_materials = t;
            totalFixed += t;
        } else {
            if (worldviewMats.length > 0) {
                const content = `【世界观素材】${worldviewMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, 200)}`).join('\n')}`;
                const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.worldview_materials.maxRatio));
                fixedTokens.worldview_materials = t;
                totalFixed += t;
            }
            if (characterMats.length > 0) {
                const content = `【角色素材】${characterMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, 200)}`).join('\n')}`;
                const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.character_materials.maxRatio));
                fixedTokens.character_materials = t;
                totalFixed += t;
            }
        }
        if (otherMats.length > 0) {
            const content = `【其他素材】${otherMats.map(m => `[${m.name}]: ${(m.currentContent || '').substring(0, 150)}`).join('\n')}`;
            const t = Math.min(estimateTokens(content), Math.floor(budget.inputBudget * priorities.other_materials.maxRatio));
            fixedTokens.other_materials = t;
            totalFixed += t;
        }
    }

    const project = store.getItem('projects', projectId);
    if (project?.styleGuidance) {
        const t = Math.min(estimateTokens(project.styleGuidance), Math.floor(budget.inputBudget * priorities.style_guidance.maxRatio));
        fixedTokens.style_guidance = t;
        totalFixed += t;
    }

    const constraintText = buildConstraintInjection(projectId);
    if (constraintText) {
        const t = Math.min(estimateTokens(constraintText), Math.floor(budget.inputBudget * priorities.constraint_rules.maxRatio));
        fixedTokens.constraint_rules = t;
        totalFixed += t;
    }

    const memoryEstimate = Math.floor(budget.inputBudget * priorities.memory_context.maxRatio);
    fixedTokens.memory_context = memoryEstimate;
    totalFixed += memoryEstimate;

    const chapters = store.queryItems('chapters', { projectId }).filter(c => !c.archived).sort((a, b) => a.chapterNumber - b.chapterNumber);
    const writtenChapters = chapters.filter(c => c.content);
    let avgOutlineTokens = 200;
    let avgPrevChapterTokens = 500;
    if (writtenChapters.length > 0) {
        const sampleOutlines = writtenChapters.slice(-5).map(c => (c.outline || '').substring(0, 2000));
        const sampleContents = writtenChapters.slice(-5).map(c => (c.content || '').substring(0, 1500));
        if (sampleOutlines.length > 0) {
            avgOutlineTokens = Math.ceil(sampleOutlines.reduce((s, o) => s + estimateTokens(o), 0) / sampleOutlines.length);
        }
        if (sampleContents.length > 0) {
            avgPrevChapterTokens = Math.ceil(sampleContents.reduce((s, c) => s + estimateTokens(c), 0) / sampleContents.length);
        }
    }

    const perChapterInput = avgOutlineTokens + avgPrevChapterTokens;
    const perChapterOutput = Math.ceil(2800 * 1.5);
    const perChapterTotal = perChapterInput + perChapterOutput;

    const availableForChapters = budget.totalBudget - totalFixed;
    const maxChapters = Math.max(1, Math.floor(availableForChapters / perChapterTotal));

    const safeMax = budget.isUltraLongContext ? Math.min(maxChapters, 15) : budget.isLongContext ? Math.min(maxChapters, 5) : 1;
    const recommendedMax = budget.isUltraLongContext ? Math.min(maxChapters, 8) : budget.isLongContext ? Math.min(maxChapters, 3) : 1;

    return {
        model,
        totalBudget: budget.totalBudget,
        outputReserve: budget.outputReserve,
        inputBudget: budget.inputBudget,
        fixedCost: totalFixed,
        fixedBreakdown: fixedTokens,
        perChapterInput,
        perChapterOutput,
        perChapterTotal,
        availableForChapters,
        maxChapters,
        safeMax,
        recommendedMax,
        materialCount: materials.length,
        worldviewMatCount: worldviewMats.length,
        characterMatCount: characterMats.length,
        otherMatCount: otherMats.length,
        writtenChapterCount: writtenChapters.length,
        avgOutlineTokens,
        avgPrevChapterTokens
    };
}

module.exports = { ContextBudget, estimateTokens, truncateToTokens, CONTEXT_BUDGETS, COMPACT_PRIORITIES, LONG_PRIORITIES, ULTRA_LONG_PRIORITIES, COMPACT_MODELS, LONG_CONTEXT_MODELS, ULTRA_LONG_CONTEXT_MODELS, calculateMaxBatchChapters };
