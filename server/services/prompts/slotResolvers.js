'use strict';

/**
 * 占位符解析器
 * 每个Slot类型对应一个解析函数，从对应的配置源读取内容
 * 解析器接收共享上下文(ctx)，返回文本内容或null
 */

const { resolveModulesSlot } = require('./agentSlotRegistry');
const { getConstraintHeader } = require('./constraintScopes');

function resolveGenreFoundation(ctx) {
    const rules = ctx.genrePlugin?.foundation?.additionalFoundationRules;
    if (!rules || !rules.length) return null;
    return rules.join('\n');
}

async function resolveConstraints(ctx) {
    if (!ctx.projectId) return null;
    const { buildConstraintInjection } = require('./constraintInjector');
    const text = await buildConstraintInjection(ctx.projectId, ctx.agentType);
    return text || null;
}

async function resolveStyle(ctx) {
    if (!ctx.projectId || !ctx.styleProfile) return null;
    const { buildStyleProfileInjection } = require('./styleInjector');
    const genre = ctx.genrePlugin;
    const localProfile = {
        ...ctx.styleProfile,
        constraintOverrides: ctx.styleProfile.constraintOverrides
            ? [...ctx.styleProfile.constraintOverrides] : undefined,
    };

    if (genre?.genreBase) {
        _appendGenreBase(localProfile, genre.genreBase);
    }

    const result = await buildStyleProfileInjection(localProfile, ctx.agentType, genre, ctx.projectId);
    const parts = [];
    if (result.prepend) parts.push(result.prepend);
    if (result.append) parts.push(result.append);
    return parts.length ? parts.join('\n\n') : null;
}

async function resolveFlavor(ctx) {
    if (!ctx.projectId || !ctx.genrePlugin) return null;
    const { buildFlavorInjection } = require('./flavorInjector');
    const result = await buildFlavorInjection(ctx.projectId, ctx.agentType, ctx.genrePlugin);
    return result.text || null;
}

async function resolveGenreRegistry(ctx) {
    if (!ctx.projectId || !ctx.project) return null;
    const { buildGenreInjection } = require('./genreInjector');
    const chapterNumber = ctx.chapterNumber || ctx.project?.currentChapter;
    const result = await buildGenreInjection(ctx.projectId, ctx.agentType, ctx.project, { chapterNumber });
    return result.text || null;
}

async function resolveMemoryPyramid(ctx) {
    if (!ctx.projectId) return null;
    const chapterNumber = ctx.chapterNumber || ctx.project?.currentChapter || 1;
    const { memoryPyramid } = require('../knowledgeBase');
    const facts = await memoryPyramid.getFactsForPrompt(ctx.projectId, chapterNumber, 1500);
    if (!facts || facts.length === 0) return null;

    const levelLabels = { M0: '永不衰减', M1: '核心记忆', M2: '中期记忆', M3: '长期记忆', L0: '永不衰减', L1: '核心记忆', L2: '中期记忆', L3: '长期记忆' };
    const lines = [];
    for (const f of facts) {
        const label = levelLabels[f.level] || f.level;
        const decay = f.decayScore !== undefined ? ` (衰减${(f.decayScore * 100).toFixed(0)}%)` : '';
        lines.push(`- [${label}] ${f.factText}${decay}`);
    }
    const narrative = await _resolveVolumeSummary(ctx.projectId, chapterNumber);
    if (narrative) lines.push(narrative);
    return lines.join('\n');
}

/**
 * 叙事记忆（卷摘要）：services/memory 算好的 L4 卷回顾此前只被 UI 读取、prompt 无人消费，
 * 现并入同一记忆槽（事实记忆 + 叙事记忆两种粒度），上限见 config/memoryPolicy。
 */
async function _resolveVolumeSummary(projectId, chapterNumber) {
    const { MEMORY_POLICY } = require('../../config/memoryPolicy');
    if (!MEMORY_POLICY.includeVolumeSummary) return '';
    try {
        const memory = require('../memory');
        const layers = await memory.getMemoryLayers(projectId);
        const volumes = (layers && layers.compressed && layers.compressed.volumes) || {};
        const volume = Math.floor((chapterNumber - 1) / 30) + 1;
        const summary = volumes[volume] && volumes[volume].summary;
        if (!summary) return '';
        return '- [叙事记忆·第' + volume + '卷] ' + String(summary).substring(0, MEMORY_POLICY.volumeSummaryMaxChars);
    } catch (e) {
        return '';
    }
}

function _appendGenreBase(localProfile, genreBase) {
    if (localProfile.behaviorRule && genreBase.BEHAVIOR_APPEND
        && !localProfile.behaviorRule.includes(genreBase.BEHAVIOR_APPEND)) {
        localProfile.behaviorRule += '\n' + genreBase.BEHAVIOR_APPEND;
    }
    if (localProfile.toneRule && genreBase.TONE_APPEND
        && !localProfile.toneRule.includes(genreBase.TONE_APPEND)) {
        localProfile.toneRule += '\n' + genreBase.TONE_APPEND;
    }
    if (localProfile.reviewFocus && genreBase.REVIEW_APPEND
        && !localProfile.reviewFocus.includes(genreBase.REVIEW_APPEND)) {
        localProfile.reviewFocus += genreBase.REVIEW_APPEND;
    }
    if (localProfile.constraintOverrides && genreBase.REQUIRED_CONSTRAINT_OVERRIDES) {
        for (const rc of genreBase.REQUIRED_CONSTRAINT_OVERRIDES) {
            if (!localProfile.constraintOverrides.includes(rc)) {
                localProfile.constraintOverrides.push(rc);
            }
        }
    }
}

const SLOT_RESOLVERS = {
    'modules': (slotDef, ctx) => resolveModulesSlot(slotDef, ctx),
    'genre-foundation': (_slotDef, ctx) => resolveGenreFoundation(ctx),
    'constraints': (_slotDef, ctx) => resolveConstraints(ctx),
    'style': (_slotDef, ctx) => resolveStyle(ctx),
    'flavor': (_slotDef, ctx) => resolveFlavor(ctx),
    'genre-registry': (_slotDef, ctx) => resolveGenreRegistry(ctx),
    'memory-pyramid': (_slotDef, ctx) => resolveMemoryPyramid(ctx),
};

async function resolveSlotContent(slotDef, ctx) {
    const resolver = SLOT_RESOLVERS[slotDef.type];
    if (!resolver) return null;
    return resolver(slotDef, ctx);
}

module.exports = {
    resolveSlotContent,
    resolveGenreFoundation,
    resolveConstraints,
    resolveStyle,
    resolveFlavor,
    resolveGenreRegistry,
    resolveMemoryPyramid,
};
