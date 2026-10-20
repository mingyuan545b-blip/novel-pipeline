/**
 * 题材 id 解析（从 entityCRUD 拆出，保证单文件≤200行）
 * 仍用函数内惰性 require：避免与 styleInjector/genreConfig 形成环依赖。
 */
const logger = require('../../shared/logger');

async function detectGenreId(projectId) {
    try {
        const { getStyleProfileForProject } = require('../prompts/styleInjector');
        const styleProfile = await getStyleProfileForProject(projectId);
        if (styleProfile) { const { detectGenre } = require('../genreConfig'); const genre = detectGenre(styleProfile); if (genre) return genre.id; }
    } catch (_) { logger.warn('entityCRUD', '[entity-crud]', _.message || _); }  // DEGRADE: 影响=require 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return '';
}

module.exports = { detectGenreId };
