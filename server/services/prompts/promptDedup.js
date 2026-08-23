const { detectGenre } = require('../genreConfig');
const logger = require('../../shared/logger');

function getGenreDedupRules(genre) {
    if (!genre || !genre.dedupRules) return [];
    return Array.isArray(genre.dedupRules) ? genre.dedupRules : [];
}

const BASE_DEDUP_RULES = [
    { id: 'hook-chapter', pattern: /每章结尾必须设置悬念或钩子/g, keep: 'first' },
    { id: 'hook-chapter2', pattern: /章末钩子用[^。\n]*[。\n]/g, keep: 'first' },
    { id: 'show-not-tell', pattern: /展示代替告知[：:][^\n]*/g, keep: 'first' },
    { id: 'word-count', pattern: /【字数要求[^】]*】[^\n]*/g, keep: 'first' },
    { id: 'word-count2', pattern: /宁可多写不可少写[^。\n]*[。\n]/g, keep: 'first' },
    { id: 'word-count3', pattern: /字数纪律[：:][^\n]*/g, keep: 'first' },
    { id: 'golden-finger', pattern: /金手指[^。]*触发[^\n]*/g, keep: 'first' },
    { id: 'sensory-anchor', pattern: /场景感官锚定[：:][^\n]*/g, keep: 'first' },
    { id: 'sensory-detail', pattern: /感官细节[^，。\n]*[，。\n]/g, keep: 'first' },
    { id: 'style-header', pattern: /【⚠️ 本作风格配置（最高优先级[^】]*）】/g, keep: 'first' },
    { id: 'style-header2', pattern: /【⚠️ 本作风格配置（审核依据）】/g, keep: 'first' },
];

function deduplicateSystemPrompt(fullSystem, agentType, styleProfile) {
    const genre = detectGenre(styleProfile);
    const genreDedupRules = genre ? getGenreDedupRules(genre) : [];
    const DEDUP_RULES = [...BASE_DEDUP_RULES, ...genreDedupRules];

    let result = fullSystem;
    let totalSaved = 0;

    for (const rule of DEDUP_RULES) {
        if (!rule.pattern || !(rule.pattern instanceof RegExp)) continue;
        const matches = [];
        let m;
        const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g';
        const regex = new RegExp(rule.pattern.source, flags);
        let lastIdx = -1;
        while ((m = regex.exec(result)) !== null) {
            if (regex.lastIndex === lastIdx) { regex.lastIndex++; continue; }
            lastIdx = regex.lastIndex;
            matches.push({ match: m[0], index: m.index });
        }
        if (matches.length > 1) {
            for (let i = matches.length - 1; i >= 1; i--) {
                const toRemove = matches[i].match;
                const verifySlice = result.substring(matches[i].index, matches[i].index + toRemove.length);
                if (verifySlice === toRemove) {
                    result = result.substring(0, matches[i].index) + result.substring(matches[i].index + toRemove.length);
                    totalSaved += toRemove.length;
                } else {
                    logger.warn('promptBuilder', `[DEDUP] ${rule.id}: skip remove at idx ${matches[i].index}, content mismatch`);
                }
            }
            const removedCount = matches.length - 1;
            if (removedCount > 0) logger.info('promptBuilder', `[DEDUP] ${rule.id}: removed ${removedCount} duplicate(s)`);
        }
    }

    result = result.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
    if (totalSaved > 0) {
        logger.info('promptBuilder', `[DEDUP] Total saved: ${totalSaved} chars (${((totalSaved / fullSystem.length) * 100).toFixed(1)}%)`);
    }
    return result;
}

module.exports = { deduplicateSystemPrompt, BASE_DEDUP_RULES };
