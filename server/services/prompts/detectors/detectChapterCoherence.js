'use strict';

/**
 * M3检测器：章节衔接连贯性识别
 * 所有关键词/阈值/N-gram参数从 constraintDetectionConfig.js 读取
 */

const { getConfig } = require('../constraintDetectionConfig');

function extractEnding(content, chars) {
    if (!content) return '';
    return content.slice(-chars).trim();
}

function extractOpening(content, chars) {
    if (!content) return '';
    return content.slice(0, chars).trim();
}

function extractNGrams(text, sizes) {
    const grams = new Set();
    const clean = text.replace(/[\s，。！？、；：""''「」『』]/g, '');
    for (const size of sizes) {
        for (let i = 0; i <= clean.length - size; i++) {
            const gram = clean.substring(i, i + size);
            if (gram.length >= 2) grams.add(gram);
        }
    }
    return grams;
}

function hasCoherenceSignal(ending, opening, config) {
    if (!ending || !opening) return false;

    if (config.sceneKeywords.test(ending) && config.sceneKeywords.test(opening)) {
        const endingScene = ending.match(config.sceneKeywords)[0];
        if (opening.includes(endingScene)) return true;
    }

    if (config.actionKeywords.test(ending) && config.actionKeywords.test(opening)) {
        const endingAction = ending.match(config.actionKeywords)[0];
        if (opening.includes(endingAction)) return true;
    }

    if (config.dialogueKeywords.test(ending) && config.dialogueKeywords.test(opening)) return true;

    if (config.timeKeywords.test(opening)) return true;

    const endingGrams = extractNGrams(ending, config.ngramSizes);
    const openingGrams = extractNGrams(opening, config.ngramSizes);
    let overlapCount = 0;
    for (const g of endingGrams) {
        if (openingGrams.has(g)) overlapCount++;
    }
    if (overlapCount >= config.ngramOverlapThreshold) return true;

    return false;
}

function detectChapterCoherence({ content, prevChapterContent }) {
    const config = getConfig('M3');
    const threshold = config.threshold;

    if (!content) return { violations: [], actual: 0, threshold };
    if (!prevChapterContent) {
        return { violations: [], actual: 0, threshold, reason: 'first-chapter' };
    }

    const ending = extractEnding(prevChapterContent, config.endingChars);
    const opening = extractOpening(content, config.openingChars);

    if (ending.length < config.minContentLength || opening.length < config.minContentLength) {
        return { violations: [], actual: 0, threshold, reason: 'content-too-short' };
    }

    const hasSignal = hasCoherenceSignal(ending, opening, config);

    if (!hasSignal) {
        return {
            violations: [{
                type: 'coherence-broken',
                snippet: `前章结尾: "${ending.slice(-80)}..." | 本章开头: "${opening.slice(0, 80)}..."`,
                reason: '本章开头与前章结尾无场景/动作/对话/时间线承接信号',
            }],
            actual: 1,
            threshold,
        };
    }

    return { violations: [], actual: 0, threshold };
}

module.exports = { detectChapterCoherence, hasCoherenceSignal, extractEnding, extractOpening };
