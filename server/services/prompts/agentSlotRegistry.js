'use strict';

/**
 * 占位符（Slot）注册表
 * 每个Slot对应一个配置源，agentJobTemplates 通过引用Slot ID来组装提示词
 * Slot类型：
 *   - modules: 从 constraintModules 读取指定模块ID列表
 *   - genre-foundation: 从 genrePlugin.foundation.additionalFoundationRules 读取
 *   - constraints: 从 constraintInjector 按agentType分发约束词
 *   - style: 从 styleInjector 注入风格配置
 *   - flavor: 从 flavorInjector 注入风味
 *   - genre-registry: 从 genreInjector 注入题材注册表
 */

const { CONSTRAINT_MODULES } = require('./constraintModules');

const SLOT_DEFINITIONS = {
    'role-boundary': {
        label: '角色边界',
        category: 'foundation',
        type: 'modules',
        moduleIds: ['role-boundary'],
        replacePlaceholders: true,
    },
    'redlines-writer': {
        label: '写作红线',
        category: 'foundation',
        type: 'modules',
        moduleIds: [
            'redline-format', 'redline-hallucination', 'redline-word-limit', 'redline-intent',
            'redline-system-leak', 'redline-prompt-leak', 'redline-ip-defense', 'redline-naming',
        ],
    },
    'redlines-reviser': {
        label: '返修红线',
        category: 'foundation',
        type: 'modules',
        moduleIds: ['redline-format', 'redline-hallucination', 'redline-system-leak', 'redline-prompt-leak'],
    },
    'redlines-polisher': {
        label: '润色红线',
        category: 'foundation',
        type: 'modules',
        moduleIds: ['redline-format', 'redline-hallucination', 'redline-system-leak', 'redline-prompt-leak', 'anti-ai-trace'],
    },
    'quality-check': {
        label: '质量自检',
        category: 'foundation',
        type: 'modules',
        moduleIds: ['quality-check'],
    },
    'craft-rules': {
        label: '写作技法',
        category: 'foundation',
        type: 'modules',
        moduleIds: [
            'show-not-tell', 'info-pace', 'chapter-closing', 'anti-hallucination',
            'anti-routine', 'anti-ai-trace', 'natural-ability', 'paragraph-rhythm',
            'style-genre-adapt', 'fast-pace', 'anti-tool-character',
        ],
    },
    'output-novel': {
        label: '输出格式',
        category: 'foundation',
        type: 'modules',
        moduleIds: ['output-novel'],
    },
    'genre-foundation': {
        label: '题材铁律',
        category: 'genre',
        type: 'genre-foundation',
    },
    'constraints': {
        label: '约束词',
        category: 'constraints',
        type: 'constraints',
        hasOwnHeader: true,
    },
    'style-profile': {
        label: '风格配置',
        category: 'style',
        type: 'style',
    },
    'flavor': {
        label: '风味注入',
        category: 'flavor',
        type: 'flavor',
    },
    'genre-registry': {
        label: '题材注册表',
        category: 'genre-registry',
        type: 'genre-registry',
    },
    'memory-pyramid': {
        label: '记忆金字塔',
        category: 'knowledge',
        type: 'memory-pyramid',
    },
};

function resolveModulesSlot(slotDef, ctx) {
    const skipIds = new Set(ctx.genrePlugin?.foundation?.skipConstraints || []);
    const genreId = ctx.genrePlugin?.id || null;
    const sections = [];

    for (const id of slotDef.moduleIds) {
        if (skipIds.has(id)) continue;
        const mod = CONSTRAINT_MODULES[id];
        if (!mod) continue;
        if (mod.applicableGenres && genreId && !mod.applicableGenres.includes(genreId)) continue;
        let text = mod.text;
        if (slotDef.replacePlaceholders) {
            text = text
                .replace('[Agent类型]', ctx.roleLabel || ctx.agentType)
                .replace('[任务描述]', ctx.taskDesc || '完成指定任务');
        }
        sections.push(text);
    }

    return sections.length ? sections.join('\n\n') : null;
}

function getSlotDefinition(slotId) {
    return SLOT_DEFINITIONS[slotId] || null;
}

function listSlotDefinitions() {
    return Object.entries(SLOT_DEFINITIONS).map(([id, def]) => ({
        id,
        label: def.label,
        category: def.category,
        type: def.type,
    }));
}

module.exports = {
    SLOT_DEFINITIONS,
    resolveModulesSlot,
    getSlotDefinition,
    listSlotDefinitions,
};
