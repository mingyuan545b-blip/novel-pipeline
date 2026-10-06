'use strict';

/**
 * M6检测器：张力消解（紧张场景强行玩梗/抖机灵）
 *
 * 模式：一个高张力句子之后，紧接着出现现代梗/俏皮话，把刚建立的紧张感泄掉。
 * 价值：喜剧题材允许玩梗，但玩梗必须发生在非紧张场景；紧张处玩梗=代入感崩坏。
 * 所有正则从 constraintDetectionConfig.js 读取。
 */

const { getConfig } = require('../constraintDetectionConfig');

function splitSentences(text) {
    return String(text || '')
        .split(/(?<=[。！？!?\n])/)
        .map(s => s.trim())
        .filter(Boolean);
}

function detectBanterDeflation({ content }) {
    const config = getConfig('M6');
    const threshold = config.threshold;
    if (!content) return { violations: [], actual: 0, threshold };

    const sentences = splitSentences(content);
    const violations = [];

    for (let i = 0; i < sentences.length; i++) {
        const cur = sentences[i];
        if (!config.tensionPattern.test(cur)) continue;

        // 同一句尾部出现梗（张力句后半段自我消解）
        const tensionIdx = cur.search(config.tensionPattern);
        const tail = tensionIdx >= 0 ? cur.slice(tensionIdx) : cur;
        if (config.banterPattern.test(tail) || config.tonePattern.test(tail)) {
            violations.push({
                type: 'in-sentence-deflation',
                snippet: cur.slice(0, 60),
                reason: '紧张句内部直接接现代梗/俏皮话，张力自我消解',
            });
            continue;
        }

        // 下一句紧接着玩梗
        const next = (sentences[i + 1] || '').slice(0, config.lookaheadChars);
        if (config.banterPattern.test(next) || config.tonePattern.test(next)) {
            violations.push({
                type: 'next-sentence-deflation',
                snippet: `${cur.slice(0, 30)}……${next.slice(0, 30)}`,
                reason: '高张力句后紧接玩梗句，紧张感被泄掉',
            });
        }
    }

    const actual = violations.length;
    if (actual < threshold) return { violations: [], actual, threshold };
    return { violations, actual, threshold };
}

module.exports = { detectBanterDeflation, splitSentences };
