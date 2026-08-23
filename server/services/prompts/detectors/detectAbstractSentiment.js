'use strict';

/**
 * M4检测器：抽象抒情替代具体场景识别
 * 所有正则模式从 constraintDetectionConfig.js 读取
 */

const { getConfig } = require('../constraintDetectionConfig');

function detectAbstractSentiment({ content }) {
    if (!content) return { violations: [], actual: 0 };

    const config = getConfig('M4');
    const threshold = config.threshold;
    const patterns = config.patterns;

    const matches = [];
    let total = 0;

    const reasonMap = {
        abstractTime: '抽象时间+静止替代具体感官',
        airSolidify: '空气/氛围凝固替代具体环境描写',
        fateGear: '命运/历史+洪流替代具体叙事',
        fateStatement: '宿命论断替代具体因果展示',
        silentShock: '无言/沉默+震撼替代具体反应',
        allInSilence: '一切尽在不言中替代具体描写',
    };

    for (const [typeName, pattern] of Object.entries(patterns)) {
        const globalPattern = new RegExp(pattern.source, pattern.flags);
        const typeMatches = content.match(globalPattern) || [];
        typeMatches.slice(0, 2).forEach(m => {
            matches.push({ type: typeName, snippet: m, reason: reasonMap[typeName] || typeName });
        });
        total += typeMatches.length;
    }

    // 只在超过阈值时才记录违规（与M5语义一致，防止actual<threshold时误判）
    if (total <= threshold) {
        return { violations: [], actual: total, threshold };
    }

    const violations = matches;
    violations.unshift({
        type: 'threshold-exceeded',
        snippet: `总计${total}次，阈值${threshold}次`,
        reason: `抽象抒情模式命中${total}次，超过阈值${threshold}`,
    });

    return { violations, actual: total, threshold };
}

module.exports = { detectAbstractSentiment };
