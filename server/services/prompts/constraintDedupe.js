const { CONSTRAINT_TIERS } = require('../../config/systemConfig');
const { getGenreConstraintPresets } = require('../genreDetectorHelpers');
const logger = require('../../shared/logger');

const BASE_STYLE_COVERED_CONSTRAINTS = {
    'hook-every-chapter': {
        profileFields: ['toneRule', 'behaviorRule'],
        keywords: ['章末钩子', '未闭合张力点', '悬念', '钩子']
    },
    'simple-readable-style': {
        profileFields: ['toneRule'],
        keywords: ['句子短', '段落短', '节奏流畅', '禁用成语', '长难句']
    },
    'worldview-consistency': {
        profileFields: ['behaviorRule'],
        keywords: ['世界观', '设定自洽']
    },
    'character-consistency': {
        profileFields: ['dialogueRule'],
        keywords: ['称呼', '内心独白']
        // 根因修复：原keywords包含'角色'，但povRule中"读者知道而角色不知道"会误触发去重
        // 导致character-consistency约束被错误移除，引发OOC问题（角色越权行为）
        // 移除'角色'关键词，character-consistency不应被povRule覆盖
    }
};

function dedupeConstraints(effectiveConstraints, profile, genreConstraintPresets) {
    const isStyleProfileLoaded = profile && (
        profile.povRule || profile.dialogueRule || profile.behaviorRule || profile.toneRule
    );

    const STYLE_COVERED_CONSTRAINTS = { ...BASE_STYLE_COVERED_CONSTRAINTS };
    const dedupedConstraints = [];
    const dedupedReasons = [];

    for (const id of effectiveConstraints) {
        const mapping = STYLE_COVERED_CONSTRAINTS[id];
        if (mapping && isStyleProfileLoaded) {
            let covered = false;
            for (const field of mapping.profileFields) {
                const fieldValue = profile[field] || '';
                if (mapping.keywords.some(kw => fieldValue.includes(kw))) {
                    covered = true;
                    break;
                }
            }
            if (covered) {
                dedupedReasons.push(`${id}(已由${mapping.profileFields.join('/')}覆盖)`);
                continue;
            }
        }
        dedupedConstraints.push(id);
    }

    return { dedupedConstraints, dedupedReasons };
}

function buildTierOutput(dedupedConstraints, CONSTRAINT_PRESETS, genre, genreConstraintPresets) {
    const { TIER1, TIER2, TIER3 } = CONSTRAINT_TIERS;
    const genreAllowedIds = new Set([
        ...Object.keys(CONSTRAINT_PRESETS).filter(id => !CONSTRAINT_PRESETS[id]?.applicableGenres),
        ...Object.keys(genreConstraintPresets)
    ]);

    // Also include base presets that have no applicableGenres restriction
    for (const [id, preset] of Object.entries(CONSTRAINT_PRESETS)) {
        if (!preset.applicableGenres) genreAllowedIds.add(id);
    }

    const tier1Items = [];
    const tier2Labels = [];
    const tier3Labels = [];

    for (const id of dedupedConstraints) {
        if (!genreAllowedIds.has(id)) {
            logger.info('constraintInjector', '[AGENT-PROMPTS] Constraint skipped for project: {id} (not in genre {genreId} allowed list)', { id, genreId: genre?.id || 'none' });
            continue;
        }
        const preset = CONSTRAINT_PRESETS[id];
        if (!preset) continue;
        if (preset.applicableGenres && genre && !preset.applicableGenres.includes(genre.id)) continue;
        if (TIER1.includes(id)) {
            tier1Items.push(`● ${preset.label}：${preset.desc}`);
        } else if (TIER2.includes(id)) {
            tier2Labels.push(preset.label);
        } else if (TIER3.includes(id)) {
            tier3Labels.push(preset.label);
        } else {
            tier1Items.push(`● ${preset.label}：${preset.desc}`);
        }
    }

    return { tier1Items, tier2Labels, tier3Labels };
}

function formatConstraintOutput(tier1Items, tier2Labels, tier3Labels, agentType) {
    const { getConstraintHeader } = agentType ? require('./constraintScopes') : { getConstraintHeader: () => '写作约束（必须遵守）' };
    let result = `\n【${getConstraintHeader(agentType)}】`;
    if (tier1Items.length > 0) {
        result += '\n' + tier1Items.join('\n');
    }
    if (tier2Labels.length > 0) {
        result += `\n遵守：${tier2Labels.join('、')}`;
    }
    if (tier3Labels.length > 0) {
        result += `\n注意：${tier3Labels.join('、')}`;
    }
    return result;
}

module.exports = {
    BASE_STYLE_COVERED_CONSTRAINTS,
    dedupeConstraints,
    buildTierOutput,
    formatConstraintOutput
};
