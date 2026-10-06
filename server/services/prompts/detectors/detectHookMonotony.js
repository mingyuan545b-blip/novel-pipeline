'use strict';

/**
 * M10检测器：章末钩子同质化
 *
 * 价值：本书每章几乎都用同一句"真正的麻烦才刚刚开始"式钩子收尾，读者会疲劳。
 * 规则：把章末钩子按类型（危险/信息/抉择/反转/代价）分类，若与上一章同类型则判违规。
 */

const { getConfig } = require('../constraintDetectionConfig');
const { cjkBigrams } = require('./detectEmotionalContinuity');

function classifyHook(ending, hookTypes) {
    for (const [type, pattern] of Object.entries(hookTypes)) {
        if (pattern.test(ending)) return type;
    }
    return 'unknown';
}

function detectHookMonotony({ content, chapterNumber, prevChapterContent }) {
    const config = getConfig('M10');
    const threshold = config.threshold;
    if (!content || !prevChapterContent || (chapterNumber || 1) < 2) {
        return { violations: [], actual: 0, threshold };
    }

    const curEnding = String(content).replace(/\s+$/g, '').slice(-config.endingChars);
    const prevEnding = String(prevChapterContent).replace(/\s+$/g, '').slice(-config.endingChars);

    const curType = classifyHook(curEnding, config.hookTypes);
    const prevType = classifyHook(prevEnding, config.hookTypes);

    if (curType === 'unknown' || prevType === 'unknown' || curType !== prevType) {
        return { violations: [], actual: 0, threshold, curType, prevType };
    }

    // 仅当两章结尾"同型且措辞雷同"才判同质化，避免把类型相同的有机收尾误伤
    const grams = cjkBigrams(prevEnding);
    let shared = 0;
    for (const g of cjkBigrams(curEnding)) if (grams.has(g)) shared++;
    if (shared < config.minSharedBigrams) {
        return { violations: [], actual: shared, threshold, curType, prevType, note: 'same-type-but-not-formulaic' };
    }

    return {
        violations: [{
            type: 'hook-monotony',
            snippet: `连续两章均为[${curType}]型钩子：…${curEnding.slice(-30)}`,
            reason: `章末钩子类型与前章重复（${curType}），需轮换钩子类型`,
        }],
        actual: 1,
        threshold,
        curType,
        prevType,
    };
}

module.exports = { detectHookMonotony, classifyHook };
