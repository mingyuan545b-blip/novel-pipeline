/**
 * apiRegistry.js — API 契约 Single Source of Truth
 *
 * 所有路由挂载点和测试常用路径常量集中定义于此。
 * 测试脚本必须从这里读取路径，禁止硬编码。
 * 启动自检从此处验证 service 函数存在性。
 */
const path = require('path');

const ROUTE_MOUNTS = Object.freeze({
    '/api/auth':               { file: 'routes/authRoutes.js',         feature: null },
    '/api/api-keys':           { file: 'routes/apiKeys.js',            feature: null },
    '/api/license':            { file: 'routes/licenseRoutes.js',      feature: null },
    '/api/version':            { file: 'routes/versionRoutes.js',      feature: null },
    '/api/health':             { file: 'routes/health.js',             feature: null },
    '/api/pipeline':           { file: 'routes/pipeline.js',           feature: 'pipeline', extraFiles: ['routes/pipeline/contextCommanderRoutes.js', 'routes/worldscopeRoutes.js'] },
    '/api/workshop':           { file: 'routes/workshop.js',           feature: null },
    '/api/publish':            { file: 'routes/publish.js',            feature: 'publish' },
    '/api/comic':              { file: 'routes/comic.js',              feature: null },
    '/api/quests':             { file: 'routes/quests.js',             feature: null },
    '/api/style-templates':    { file: 'routes/style-templates.js',    feature: null },
    '/api/projects':           { file: 'routes/projects.js',           feature: null },
    '/api/chapters':           { file: 'routes/chapters.js',           feature: null },
    '/api/materials':          { file: 'routes/materials.js',          feature: null },
    '/api/reviews':            { file: 'routes/reviews.js',            feature: null },
    '/api/agents':             { file: 'routes/agents.js',             feature: null },
    '/api/settings':           { file: 'routes/settings.js',           feature: null },
    '/api/guide':              { file: 'routes/guide.js',              feature: null },
    '/api/knowledge':          { file: 'routes/knowledge.js',          feature: null },
    '/api/franchises':         { file: 'routes/franchises.js',         feature: null },
    '/api/map':                { file: 'routes/map.js',                feature: null },
    '/api/worldview-profiles': { file: 'routes/worldview-profiles.js', feature: null },
    '/api/library':            { file: 'routes/library.js',            feature: null, extraFiles: ['routes/libraryMetaRoutes.js', 'routes/libraryExtractRoutes.js'] },
    '/api/maintenance':        { file: 'routes/maintenanceRoutes.js',   feature: null },
    '/api/prompt-config':      { file: 'routes/prompt-config.js',      feature: null },
    '/api/optimizer':          { file: 'routes/optimizer.js',          feature: null },
    '/api/chapter-audit':      { file: 'routes/chapterAudit.js',       feature: null },
    '/api/entity-center':      { file: 'routes/entityCenter.js',       feature: null },
    '/api/flavors':            { file: 'routes/flavors.js',            feature: null },
    '/api/character-states':   { file: 'routes/characterStates.js',    feature: null, extraFiles: ['routes/characterStatesSummary.js', 'routes/characterStatesAdmin.js'] },
    '/api/genre-debug':        { file: 'routes/genre-debug.js',        feature: null },
    '/api/debug':              { file: 'routes/debugRoutes.js',        feature: null, extraFiles: ['routes/debugErrorRoutes.js'] }
});

/**
 * 测试常用路径常量 — 测试脚本从这里读，禁止硬编码
 * 格式: { mountKey: { 子路径名: '子路径模板' } }
 */
const TEST_PATHS = Object.freeze({
    health:         { root: '/api/health' },
    projects:       { list: '/api/projects', detail: '/api/projects/:id', put: '/api/projects/:id' },
    chapters:       { list: '/api/chapters', detail: '/api/chapters/:id', create: '/api/chapters' },
    materials:      { list: '/api/materials' },
    pipeline:       {
        full: '/api/pipeline/full',
        task: '/api/pipeline/task/:taskId',
        chronicle: '/api/pipeline/chronicle/:projectId',
        chronicleEntity: '/api/pipeline/chronicle/:projectId/:entityId',
        worldscope: '/api/pipeline/worldscope/:projectId',
        worldscopeEntity: '/api/pipeline/worldscope/:projectId/entity/:entityId',
        worldscopeExtract: '/api/pipeline/worldscope/:projectId/extract',
        worldscopeWorlds: '/api/pipeline/worldscope/:projectId/worlds',
        constraints: '/api/pipeline/consistency-constraints/:projectId'
    },
    entityCenter:   {
        entities: '/api/entity-center/entities',
        entityRegistry: '/api/entity-center/entity-registry',
        itemDefinitions: '/api/entity-center/item-definitions',
        characterBinds: '/api/entity-center/character-binds',
        characterRelations: '/api/entity-center/character-relations',
        petEntities: '/api/entity-center/pet-entities',
        servantEntities: '/api/entity-center/servant-entities'
    },
    characterStates: {
        states: '/api/character-states/states/:projectId',
        characters: '/api/character-states/characters/:projectId',
        kv: '/api/character-states/kv/:projectId',
        summary: '/api/character-states/summary/:projectId',
        history: '/api/character-states/history/:projectId/:characterId',
        meta: '/api/character-states/meta/:projectId'
    }
});

/**
 * service 函数依赖声明 — 启动自检验证这些函数存在
 * 格式: { serviceModule: ['exportedFunction1', 'exportedFunction2'] }
 */
const SERVICE_DEPENDENCIES = Object.freeze({
    'services/worldScopeModule.js': [
        'getWorldScopes', 'setWorldScope', 'removeWorldScope',
        'getVisibleEntities', 'buildWorldScopePrompt', 'batchSetScopes',
        'getProjectWorlds', 'saveProjectWorlds', 'extractAndSave',
        'SCOPE_DEFS', 'buildScopePrompt', 'detectScopeViolation',
        'resolveEffectiveScope', 'filterByScope'
    ],
    'services/characterChronicle.js': [
        'extractAndSave', 'getChronicleForProject', 'getChronicleForEntity'
    ],
    'services/pipelineModuleRegistry.js': [
        'registerModule', 'getModuleConfig', 'isModuleEnabled',
        'onWriterPrompt', 'onPostApproval', 'onReaderCheck', 'getRegisteredModules'
    ]
});

/** 构建完整路径，替换 :param 占位符 */
function buildPath(template, params = {}) {
    let result = template;
    for (const [key, value] of Object.entries(params)) {
        result = result.replace(`:${key}`, encodeURIComponent(String(value)));
    }
    return result;
}

/** 获取路由文件绝对路径（供自检使用，返回主文件） */
function getRouteFilePath(mountPath) {
    const entry = ROUTE_MOUNTS[mountPath];
    if (!entry) return null;
    return path.join(__dirname, '..', entry.file);
}

/**
 * 获取某挂载点下所有路由文件绝对路径（含主文件 + extraFiles）
 * G2：审计脚本用此函数校验所有挂载文件存在
 */
function getRouteFiles(mountPath) {
    const entry = ROUTE_MOUNTS[mountPath];
    if (!entry) return [];
    const files = [entry.file];
    if (Array.isArray(entry.extraFiles)) files.push(...entry.extraFiles);
    return files.map(f => path.join(__dirname, '..', f));
}

module.exports = {
    ROUTE_MOUNTS,
    TEST_PATHS,
    SERVICE_DEPENDENCIES,
    buildPath,
    getRouteFilePath,
    getRouteFiles
};
