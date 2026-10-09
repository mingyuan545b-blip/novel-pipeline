'use strict';

/**
 * M11检测器：AI 味高频词（设定堆砌 + 网文描写）
 *
 * 价值：AI 写设定/战斗/世界观时会密集堆"因果闭环/底层逻辑/这意味着"这类抽象设定词，
 *       以及"嘴角勾起/瞳孔微缩"这类套话动作——真人写作极少这么密。
 *       本检测器统计每章命中次数，超过阈值即计入约束反馈（喂回 writer/reviser）。
 *
 * 词表/阈值单一数据源：constraintDetectionConfig.js 的 M11.patterns
 */

const { getConfig } = require('../constraintDetectionConfig');

const GROUP_LABELS = {
    settingSlop: '设定堆砌',
    syntaxSlop: '配套句式',
    proseSlop: '网文描写套话',
};

function detectAiSlop({ content }) {
    const config = getConfig('M11');
    const threshold = config.threshold;
    const text = String(content || '');
    const violations = [];

    for (const [group, pattern] of Object.entries(config.patterns)) {
        const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
        let m;
        while ((m = re.exec(text)) !== null) {
            violations.push({
                type: 'ai-slop-vocab',
                group,
                snippet: m[0],
                reason: `${GROUP_LABELS[group] || group}AI 味词「${m[0]}」`,
            });
        }
    }

    const actual = violations.length;
    if (actual < threshold) return { violations: [], actual, threshold };
    return { violations, actual, threshold };
}

module.exports = { detectAiSlop, GROUP_LABELS };
