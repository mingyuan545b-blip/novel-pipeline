/**
 * routeRegistration.js
 * 路由注册 — 从index.js拆出
 */
const license = require('../services/license');
const { lazyRoute } = require('../utils/lazyRoute');
const { ERROR_CODES } = require('../shared/errorCodes');

const { FORBIDDEN } = ERROR_CODES;

function requireFeature(feature) {
    return (req, res, next) => {
        const access = license.canAccess(feature);
        if (!access.allowed) {
            return res.apiError(
                FORBIDDEN.statusCode,
                access.message,
                'MEMBERSHIP_REQUIRED',
                { requiredLevel: access.requiredLevel, currentLevel: access.currentLevel }
            );
        }
        next();
    };
}

function registerRoutes(app, { pipelineLimiter, authRoutes, genreDebugRoutes, apiKeysRoutes, licenseRoutes, versionRoutes, healthRoutes, pipelineRoutes, workshopRoutes, publishRoutes, comicRoutes, questRoutes, styleTemplateRoutes, projectRoutes, chapterRoutes, materialRoutes, reviewRoutes, agentRoutes, settingsRoutes, guideRoutes, knowledgeRoutes, franchiseRoutes, mapRoutes, worldviewProfileRoutes, libraryRoutes, promptConfigRoutes, optimizerRoutes, chapterAuditRoutes, entityCenterRoutes, flavorRoutes, characterStateRoutes }) {
    app.use('/api/auth', authRoutes);
    app.use('/api/genre-debug', genreDebugRoutes);
    app.use('/api/api-keys', apiKeysRoutes);
    app.use('/api/license', licenseRoutes);
    app.use('/api/version', versionRoutes);
    app.use('/api/health', healthRoutes);

    app.use('/api/pipeline', requireFeature('pipeline'), pipelineLimiter, pipelineRoutes);

    const contextCommanderRoutes = require('../routes/pipeline/contextCommanderRoutes');
    app.use('/api/pipeline', requireFeature('pipeline'), contextCommanderRoutes);

    // worldscopeRoutes 已统一为标准 router 方式（原 app.get 直接注册的 workaround 已移除）
    app.use('/api/pipeline', require('../routes/worldscopeRoutes'));

    app.use('/api/workshop', (req, res, next) => {
        if (req.path.includes('fuse')) return requireFeature('workshop-fusion')(req, res, next);
        next();
    }, workshopRoutes);
    app.use('/api/publish', requireFeature('publish'), publishRoutes);
    app.use('/api/comic', comicRoutes);
    app.use('/api/quests', questRoutes);
    app.use('/api/style-templates', styleTemplateRoutes);
    app.use('/api/projects', projectRoutes);
    app.use('/api/chapters', chapterRoutes);
    app.use('/api/materials', materialRoutes);
    app.use('/api/reviews', reviewRoutes);
    app.use('/api/agents', agentRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/guide', guideRoutes);
    app.use('/api/knowledge', knowledgeRoutes);
    app.use('/api/franchises', franchiseRoutes);
    app.use('/api/map', mapRoutes);
    app.use('/api/worldview-profiles', worldviewProfileRoutes);
    app.use('/api/library', libraryRoutes);
    app.use('/api/prompt-config', promptConfigRoutes);
    app.use('/api/optimizer', optimizerRoutes);
    app.use('/api/chapter-audit', chapterAuditRoutes);
    app.use('/api/entity-center', entityCenterRoutes);
    app.use('/api/flavors', flavorRoutes);
    app.use('/api/character-states', characterStateRoutes);
    app.use('/api/character-states', lazyRoute('./routes/characterStatesSummary'));
    app.use('/api/character-states', lazyRoute('./routes/characterStatesAdmin'));

    // 调试日志检索（按 traceId 检索请求链路日志）
    // G6: 应用独立 debug 限流（30 req/min，防止日志扫描攻击）
    const { debugLimiter } = require('../middleware/debugRateLimit');
    app.use('/api/debug', debugLimiter, lazyRoute('./routes/debugRoutes'));
    // 错误栈检索（方向 F：错误追踪专用端点）
    app.use('/api/debug', debugLimiter, lazyRoute('./routes/debugErrorRoutes'));

    app.get('/api/comic/config', (req, res, next) => { next(); });
}

module.exports = { registerRoutes, requireFeature };
