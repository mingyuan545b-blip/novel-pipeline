'use strict';

/**
 * M8检测器：章首承接上章"压力值"（情绪/威胁的连续性）
 *
 * 与M3区别：M3只比对"场景/动作/对话"是否衔接；M8专治"上一章生死威胁，下一章当没发生过"。
 * 规则：若上一章结尾处于高张力状态，而本章开头既无张力余温、也无上章末尾意象的复现，
 *       判定为情绪断档（读者会感到"这两章像两本书"）。
 */

const { getConfig } = require('../constraintDetectionConfig');

function cjkBigrams(text) {
    const s = String(text || '').replace(/[^\u4e00-\u9fa5]/g, '');
    const grams = new Set();
    for (let i = 0; i + 1 < s.length; i++) grams.add(s.slice(i, i + 2));
    return grams;
}

function detectEmotionalContinuity({ content, chapterNumber, prevChapterContent }) {
    const config = getConfig('M8');
    const threshold = config.threshold;
    if (!content || !prevChapterContent || (chapterNumber || 1) < 2) {
        return { violations: [], actual: 0, threshold };
    }

    const prevTail = String(prevChapterContent).slice(-config.prevTailChars);
    const opening = String(content).slice(0, config.openingChars);

    const prevTension = config.tensionPattern.test(prevTail);
    if (!prevTension) return { violations: [], actual: 0, threshold, note: 'prev-not-tense' };

    const prevGrams = cjkBigrams(prevTail);
    const openGrams = cjkBigrams(opening);
    let overlap = 0;
    for (const g of prevGrams) if (openGrams.has(g)) overlap++;

    // 只以"与上章末尾的实义呼应"为准：阈值内视为承接，过低视为断档
    if (overlap >= config.minOverlapBigrams) {
        return { violations: [], actual: overlap, threshold };
    }

    return {
        violations: [{
            type: 'emotional-discontinuity',
            snippet: `上章结尾处于高张力，本章开头（${opening.slice(0, 40)}…）无张力余温且与上章末尾无呼应（重合词${overlap}）`,
            reason: '章首未承接上章压力值，情绪张力断档',
        }],
        actual: 1,
        threshold,
    };
}

module.exports = { detectEmotionalContinuity, cjkBigrams };
