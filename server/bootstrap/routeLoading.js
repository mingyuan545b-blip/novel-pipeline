'use strict';

/**
 * 路由加载与注册
 *
 * 职责：急切加载关键路由 + 懒加载非关键路由
 * 文件位置：server/bootstrap/routeLoading.js
 */

const { lazyRoute } = require('../utils/lazyRoute');

/**
 * 加载所有路由模块
 * @returns {Object} 路由实例集合
 */
function loadRoutes() {
    // critical routes loaded eagerly
    const projectRoutes = require('../routes/projects');
    const chapterRoutes = require('../routes/chapters');
    const pipelineRoutes = require('../routes/pipeline');
    const settingsRoutes = require('../routes/settings');
    const healthRoutes = require('../routes/health');
    const authRoutes = require('../routes/authRoutes');
    const apiKeysRoutes = require('../routes/apiKeys');
    const licenseRoutes = require('../routes/licenseRoutes');
    const versionRoutes = require('../routes/versionRoutes');
    const genreDebugRoutes = require('../routes/genre-debug');

    // Non-critical routes — lazy loaded on first request
    // 注意：路径相对于 server/ 目录（lazyRoute 内部 SERVER_ROOT = server/）
    const materialRoutes = lazyRoute('./routes/materials');
    const reviewRoutes = lazyRoute('./routes/reviews');
    const agentRoutes = lazyRoute('./routes/agents');
    const guideRoutes = lazyRoute('./routes/guide');
    const workshopRoutes = lazyRoute('./routes/workshop');
    const publishRoutes = lazyRoute('./routes/publish');
    const comicRoutes = lazyRoute('./routes/comic');
    const questRoutes = lazyRoute('./routes/quests');
    const styleTemplateRoutes = lazyRoute('./routes/style-templates');
    const knowledgeRoutes = lazyRoute('./routes/knowledge');
    const franchiseRoutes = lazyRoute('./routes/franchises');
    const mapRoutes = lazyRoute('./routes/map');
    const worldviewProfileRoutes = lazyRoute('./routes/worldview-profiles');
    const libraryRoutes = lazyRoute('./routes/library');
    const promptConfigRoutes = lazyRoute('./routes/prompt-config');
    const optimizerRoutes = lazyRoute('./routes/optimizer');
    const chapterAuditRoutes = lazyRoute('./routes/chapterAudit');
    const flavorRoutes = lazyRoute('./routes/flavors');
    const characterStateRoutes = lazyRoute('./routes/characterStates');
    const entityCenterRoutes = lazyRoute('./routes/entityCenter');

    return {
        projectRoutes, chapterRoutes, pipelineRoutes, settingsRoutes,
        healthRoutes, authRoutes, apiKeysRoutes, licenseRoutes,
        versionRoutes, genreDebugRoutes, materialRoutes, reviewRoutes,
        agentRoutes, guideRoutes, workshopRoutes, publishRoutes,
        comicRoutes, questRoutes, styleTemplateRoutes, knowledgeRoutes,
        franchiseRoutes, mapRoutes, worldviewProfileRoutes, libraryRoutes,
        promptConfigRoutes, optimizerRoutes, chapterAuditRoutes,
        entityCenterRoutes, flavorRoutes, characterStateRoutes
    };
}

module.exports = { loadRoutes };
