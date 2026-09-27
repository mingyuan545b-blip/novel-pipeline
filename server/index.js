// 确保server目录在模块搜索路径中，支持 require('shared/xxx') 等不带路径的引用
const path = require('path');
const fs = require('fs');
module.paths.unshift(__dirname);

const logger = require('shared/logger');

// .env智能恢复 + 前端认证同步
const { ensureEnvFile, syncFrontendEnv, ENV_PATH } = require('./config/envSync');
ensureEnvFile();

// override:true — .env是唯一事实源。修复：Windows用户级环境变量残留旧API key时，
// dotenv默认不覆盖已存在变量，导致.env新key永不生效（2026-09-06实锤，详见worklog）
require('dotenv').config({ path: ENV_PATH, override: true });
if (process.env.REQUEST_SECRET === '' || !process.env.REQUEST_SECRET) {
    delete process.env.REQUEST_SECRET;
}
syncFrontendEnv();

// Logger 注入链（logStore/aggregator/persister/fallbackWriter/alertEngine/auditLogStore）
const { setupLoggerChain } = require('./bootstrap/loggerSetup');
const { alertEngine, fallbackCleanupTimer, debugPersister } = setupLoggerChain();

const express = require('express');
const license = require('./services/license');
const store = require('./store');
const { SERVER_DEFAULTS } = require('./config/systemConfig');

// 路由加载
const { loadRoutes } = require('./bootstrap/routeLoading');
const routes = loadRoutes();

const app = express();
const PORT = process.env.PORT || SERVER_DEFAULTS.DEFAULT_PORT;
let REQUEST_SECRET = process.env.REQUEST_SECRET || '';
if (!REQUEST_SECRET) {
    logger.info('index', `[AUTH] REQUEST_SECRET not set, authentication disabled.`);
}
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || '';
if (!ENCRYPTION_SECRET) {
    logger.warn('index', '[SECURITY] ⚠️ ENCRYPTION_SECRET not configured! API Keys will be stored in PLAINTEXT. Add ENCRYPTION_SECRET to .env for security.');
}

// 中间件挂载
const { setupMiddleware } = require('./bootstrap/middlewareSetup');
const { pipelineLimiter } = setupMiddleware(app, REQUEST_SECRET);

// Data directories
const dataDir = path.join(__dirname, '..', 'data');
['projects','materials','chapters','reviews','platform-accounts','publish-queue','interactions','comic-config','comic-workflows','comic-storyboards','comic-render-queue','api-keys','quests','timelines','style-templates','memory-layers','state-snapshots','consistency-reports','franchises','franchise-materials','map-nodes','agent-templates','style-profiles','constraint-presets','foundation-prompts','circuit-breakers'].forEach(dir => {
    const full = path.join(dataDir, dir);
    if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// Route registration
const { registerRoutes } = require('./config/routeRegistration');
registerRoutes(app, Object.assign({ pipelineLimiter }, routes));

// SPA static files
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath, {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
        }
    }));
    app.get('/{*path}', (req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        // 陷阱#20：index.html 必须设置 no-cache，否则浏览器缓存旧 HTML
        // 导致用户看到旧版本的前端，即使 JS/CSS 已更新
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// Startup
const { guardPort } = require('./utils/processGuard');

store.ensureBackend().then(async () => {
    // PG pool 可用后，注入并启动调试日志持久化
    try {
        const { getPool } = require('./db/pgPool');
        const pgPool = getPool();
        debugPersister.attachPool(pgPool);
        debugPersister.start();
        logger.info('index', '[DEBUG-PERSIST] Persistence enabled (PG backend)');
        const { auditLogStore } = require('shared/auditLogStore');
        auditLogStore.attachPool(pgPool);
        logger.info('index', '[AUDIT-PERSIST] Audit log persistence enabled (PG backend)');
    } catch (e) {
        logger.warn('index', `[DEBUG-PERSIST] Persistence disabled: ${e.message}`);
    }

    const portResult = await guardPort(PORT);
    if (!portResult.cleared) {
        logger.error('index', `[NOVEL-PIPELINE] ❌ Port ${PORT} unavailable: ${portResult.error}`);
        process.exit(1);
    }
    if (portResult.killedPid) {
        logger.info('index', `[NOVEL-PIPELINE] Stale process (PID ${portResult.killedPid}) terminated, restarting...`);
    }

    const { runStartupChecks } = require('./services/startupChecks');
    require('./startupChecks/apiSelfCheckRegistration');
    require('./startupChecks/envValidationRegistration');
    await runStartupChecks();

    // 藏经阁技法索引预热：PG(library_techniques) → 内存视图。
    // 技法注入链（techniqueScheduler→writer/polisher prompt）是同步调用，必须在起服前装载完成。
    try {
        const techIndex = require('./services/techIndex');
        const techResult = await techIndex.initFromPg();
        logger.info('index', `[TECH-INDEX] 藏经阁技法索引就绪：${techResult.count} 条（来源 ${techResult.source}）`);
    } catch (e) {
        logger.warn('index', `[TECH-INDEX] 藏经阁索引预热失败（将使用JSON兜底）: ${e.message}`);
    }

    const { validateEnv } = require('./config/envValidator');
    const envReport = validateEnv();
    if (envReport.warnings.length > 0) {
        for (const w of envReport.warnings) logger.warn('index', `[ENV] ${w}`);
    }
    if (!envReport.passed) {
        for (const e of envReport.errors) logger.error('index', `[ENV] ${e}`);
        logger.error('index', '\n[NOVEL-PIPELINE] ❌ 环境变量校验失败，服务无法启动！');
        logger.error('index', '[NOVEL-PIPELINE] 请检查 .env 文件，确保配置正确。\n');
        process.exit(1);
    }

    app.listen(PORT, () => {
        logger.info('index', `[NOVEL-PIPELINE] Server running on port ${PORT} (v${license.VERSION})`);
        try {
            const { registerModules, startHealthMonitor, cleanupZombiePipelines } = require('./startup');
            registerModules();
            startHealthMonitor();
            cleanupZombiePipelines();
            const metricsPersistence = require('./services/metricsPersistence');
            metricsPersistence.startPersistence();
        } catch (e) {
            logger.warn('index', '[NOVEL-PIPELINE] Startup tasks failed:', e.message);
        }

        const { registerShutdownHooks } = require('./bootstrap/shutdownHooks');
        registerShutdownHooks({ alertEngine, fallbackCleanupTimer, debugPersister });
    });
}).catch(err => {
    logger.error('index', '[NOVEL-PIPELINE] Storage backend initialization failed:', err.message);
    process.exit(1);
});
