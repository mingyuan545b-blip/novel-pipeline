'use strict';

/**
 * M1检测器：比喻词替代感官模式识别
 * 所有正则模式从 constraintDetectionConfig.js 读取，禁止硬编码
 */

const { getConfig } = require('../constraintDetectionConfig');

function detectMetaphorSubstitution({ content }) {
    if (!content) return { violations: [], actual: 0 };

    const config = getConfig('M1');
    const threshold = config.threshold;
    const patterns = config.patterns;

    const matches = [];
    let total = 0;

    for (const [typeName, pattern] of Object.entries(patterns)) {
        const globalPattern = new RegExp(pattern.source, pattern.flags);
        const typeMatches = content.match(globalPattern) || [];
        typeMatches.slice(0, 3).forEach(m => {
            const reasonMap = {
                metaphor: '比喻词+抽象名词替代感官',
                adverb: '程度副词+动词替代具体动作',
                quantifier: '量词+抽象名词替代具体描写',
            };
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
        reason: `比喻词替代感官模式命中${total}次，超过阈值${threshold}`,
    });

    return { violations, actual: total, threshold };
}

module.exports = { detectMetaphorSubstitution };
