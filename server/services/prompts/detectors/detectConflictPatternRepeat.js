'use strict';

/**
 * M2检测器：冲突解决模式重复识别
 * 冲突模式列表从 constraintDetectionConfig.js 读取，禁止硬编码主角名
 */

const { getConfig } = require('../constraintDetectionConfig');

function extractConflictResolutionPattern(content, conflictPatterns) {
    if (!content) return null;
    for (const p of conflictPatterns) {
        if (p.regex.test(content)) return p.id;
    }
    return null;
}

async function detectConflictPatternRepeat({ content, chapterNumber = 1, recentChapterContents = [] }) {
    if (!content || chapterNumber <= 1) {
        return { violations: [], actual: 0 };
    }

    const config = getConfig('M2');
    const threshold = config.threshold;
    const lookbackBase = config.lookbackBase;
    const conflictPatterns = config.conflictPatterns;

    const currentPattern = extractConflictResolutionPattern(content, conflictPatterns);
    if (!currentPattern) {
        return { violations: [], actual: 0, threshold };
    }

    const N = Math.floor((chapterNumber - 1) / lookbackBase) + 1;
    const compareContents = recentChapterContents.slice(0, N);

    const violations = [];
    let repeatCount = 0;

    for (let i = 0; i < compareContents.length; i++) {
        const prevPattern = extractConflictResolutionPattern(compareContents[i], conflictPatterns);
        if (prevPattern && prevPattern === currentPattern) {
            repeatCount++;
            violations.push({
                type: 'pattern-repeat',
                snippet: `当前章节模式[${currentPattern}]与前${i + 1}章相同`,
                reason: `冲突解决模式[${currentPattern}]与前${i + 1}章重复，N=${N}`,
            });
        }
    }

    if (repeatCount >= threshold && violations.length > 0) {
        violations.unshift({
            type: 'threshold-exceeded',
            snippet: `重复${repeatCount}次，阈值${threshold}次`,
            reason: `冲突解决模式重复${repeatCount}次，超过阈值${threshold}`,
        });
    }

    return { violations, actual: repeatCount, threshold };
}

module.exports = { detectConflictPatternRepeat, extractConflictResolutionPattern };
