'use strict';

/**
 * M5检测器：配角工具人化识别
 * 工具性台词模式从 constraintDetectionConfig.js 读取，禁止硬编码"苏哥""老大"
 */

const { getConfig } = require('../constraintDetectionConfig');

function isToolResponse(line, config) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > config.maxLineLength) return false;
    if (config.independentInfoMarkers.test(trimmed)) return false;
    for (const pattern of config.toolResponsePatterns) {
        if (pattern.test(trimmed)) return true;
    }
    return false;
}

function extractDialogueLines(content, characterName, config) {
    if (!content || !characterName) return [];
    const lines = [];
    const paragraphs = content.split(/\n+/);
    const dialoguePattern = new RegExp(config.dialoguePattern.source, config.dialoguePattern.flags);
    for (const para of paragraphs) {
        if (para.includes(characterName)) {
            dialoguePattern.lastIndex = 0;
            let match;
            while ((match = dialoguePattern.exec(para)) !== null) {
                lines.push(match[1].trim());
            }
        }
    }
    return lines;
}

function calculateToolRatio(dialogueLines, config) {
    if (!dialogueLines || dialogueLines.length === 0) return 0;
    let toolCount = 0;
    for (const line of dialogueLines) {
        if (isToolResponse(line, config)) toolCount++;
    }
    return toolCount / dialogueLines.length;
}

function detectToolCharacter({ content, sideCharacterNames = [] }) {
    const config = getConfig('M5');
    const threshold = config.threshold;

    if (!content || sideCharacterNames.length === 0) {
        return { violations: [], actual: 0, threshold };
    }

    const violations = [];
    let maxRatio = 0;

    for (const name of sideCharacterNames) {
        const lines = extractDialogueLines(content, name, config);
        if (lines.length < config.minDialogueCount) continue;

        const ratio = calculateToolRatio(lines, config);
        if (ratio > maxRatio) maxRatio = ratio;

        if (ratio > threshold) {
            violations.push({
                type: 'tool-character',
                characterName: name,
                snippet: `配角[${name}]工具性台词占比${(ratio * 100).toFixed(0)}%，台词样本: ${lines.slice(0, 3).join(' | ')}`,
                reason: `配角[${name}]台词工具化，缺乏独立动机表达`,
            });
        }
    }

    return { violations, actual: maxRatio, threshold };
}

module.exports = { detectToolCharacter, extractDialogueLines, calculateToolRatio, isToolResponse };
