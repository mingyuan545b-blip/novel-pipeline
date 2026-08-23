/**
 * reviserWordGuard.js — 返修员字数守卫
 * 从reviser.js拆出，负责字数校验和回退逻辑
 */
const { resolveConfig } = require('../../../config');
const { resolveGenreFromProject } = require('../../genreConfig');
const logger = require('../../../shared/logger');

/**
 * 校验返修后内容字数，必要时回退到原文
 * @returns {{ content: string, wordCount: number }}
 */
function guardWordCount(reviserContent, originalContent, genre, project) {
    const config = resolveConfig(genre, project);
    const { rejectMin, targetMin, maxChapter } = config.word;
    const reviserWc = reviserContent.replace(/\s/g, '').length;
    const originalWc = originalContent.replace(/\s/g, '').length;

    // 字数过低回退
    if (reviserWc < rejectMin && originalWc >= rejectMin) {
        logger.warn('reviser', `reviser字数异常: ${reviserWc}字 < 最低${rejectMin}字，回退到原文`);
        return { content: originalContent, wordCount: originalWc };
    }
    if (reviserWc < targetMin && reviserWc >= rejectMin && originalWc >= targetMin) {
        logger.warn('reviser', `reviser字数低于目标: ${reviserWc}字 < 目标${targetMin}字，保留原文避免审核死循环`);
        return { content: originalContent, wordCount: originalWc };
    }
    if (reviserWc < originalWc * 0.5 && originalWc > 500) {
        logger.warn('reviser', `reviser字数骤降: ${reviserWc}字 仅为原文${originalWc}字的${(reviserWc / originalWc * 100).toFixed(0)}%，回退到原文`);
        return { content: originalContent, wordCount: originalWc };
    }

    // 字数超限截断
    if (reviserWc > maxChapter) {
        logger.warn('reviser', `reviser字数超限: ${reviserWc}字 > 上限${maxChapter}字，截断`);
        const sentences = reviserContent.match(/[^。！？\n]+[。！？\n]?/g) || [reviserContent];
        let truncated = '';
        for (const s of sentences) {
            if ((truncated + s).replace(/\s/g, '').length > maxChapter) break;
            truncated += s;
        }
        if (truncated.replace(/\s/g, '').length >= rejectMin) {
            return { content: truncated.trim(), wordCount: truncated.replace(/\s/g, '').length };
        }
        return { content: originalContent, wordCount: originalWc };
    }

    return { content: reviserContent, wordCount: reviserWc };
}

module.exports = { guardWordCount };
