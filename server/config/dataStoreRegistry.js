/**
 * dataStoreRegistry - 数据源注册中心（单一数据源）
 *
 * 所有数据类型的元信息在此统一定义，避免在 store.js、projectDeleteHandler.js、
 * database.js 多处独立维护导致不一致。
 *
 * 字段说明：
 *   dedicated   - 是否有专用SQLite表（其余走kv_store）
 *   syncable    - 是否需要在切换后端时同步（store.js tablesToSync）
 *   cascadable  - 是否需要在项目删除时级联删除（CASCADE_STORE_TYPES）
 *   hasProjectId- 是否包含projectId字段（决定是否需要级联删除）
 *   aliases     - 历史别名（如下划线版本、旧名称），用于CI检测时归一化
 */

const DATA_STORE_REGISTRY = {
    // === 专用表类型 ===
    'projects':              { dedicated: true,  syncable: true,  cascadable: false, hasProjectId: false, aliases: [] },
    'materials':             { dedicated: true,  syncable: true,  cascadable: true,  hasProjectId: true,  aliases: [] },
    'chapters':              { dedicated: true,  syncable: true,  cascadable: true,  hasProjectId: true,  aliases: [] },

    // === 可同步+可级联类型（含projectId）===
    'constraint-presets':    { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: [] },
    'character-states':      { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['character_state'] },
    'character-state-kv':    { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['state-kv-index'] },
    'character-state-cache': { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['character_state_cache'] },
    'entity-registry':       { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: [] },
    'item-definitions':      { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: [] },
    'character-binds':       { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: [] },
    'character-relations':   { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: [] },
    'pets':                  { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['pet-entities'] },
    'servants':              { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['servant-entities'] },
    'entity-relations':      { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['entity_relations'] },
    'entity-state-history':  { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['entity_state_history'] },
    'entity-binds':          { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['entity_binds'] },
    'foreshadow-ledger':     { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['foreshadow_ledger'] },
    'knowledge-facts':       { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: [] },
    'narrative-state':       { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['narrative_state'] },
    'consistency-checks':    { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['consistency_checks'] },
    'craft-materials':       { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: ['craft_materials'] },
    'entities':              { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: [] },
    'quests':                { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: [] },
    'timeline':              { dedicated: false, syncable: true,  cascadable: true,  hasProjectId: true,  aliases: [] },

    // === 仅可同步类型（不含projectId，不级联删除）===
    'style-templates':       { dedicated: false, syncable: true,  cascadable: false, hasProjectId: false, aliases: [] },
    'api-keys':              { dedicated: false, syncable: true,  cascadable: false, hasProjectId: false, aliases: [] },
    'agent-bindings':        { dedicated: false, syncable: true,  cascadable: false, hasProjectId: false, aliases: [] },

    // === 仅可同步类型 + 专用表（不含projectId，不级联删除）===
    'library-techniques':    { dedicated: true,  syncable: true,  cascadable: false, hasProjectId: false, aliases: ['library_techniques'] },

    // === 仅可级联类型（含projectId，当前未加入syncable列表）===
    'reviews':               { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'state-meta':            { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'memory-layers':         { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'consistency-reports':   { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'consistency-constraints': { dedicated: false, syncable: false, cascadable: true, hasProjectId: true, aliases: [] },
    'state-snapshots':       { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'character-chronicle':   { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'knowledge-access':      { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'context-assemblies':    { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'token-ledger':          { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: ['token_ledger'] },
    // 项目级累计消耗账（每项目一条，锁保护自增；预算熔断的唯一数据源，见 services/pipeline/projectBudget.js）
    'project-spend':         { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: ['project_spend'] },
    'technique-feedback':    { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'world-scope-events':    { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'timelines':             { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'timeline-events':       { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'pipeline-logs':         { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: ['pipeline_logs'] },
    'infinite-pipeline-state': { dedicated: false, syncable: false, cascadable: true, hasProjectId: true, aliases: ['infinite_pipeline_state'] },
    'circuit-breakers':      { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'map-nodes':             { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'version-snapshots':     { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'material-index':        { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'style-profiles':        { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },

    // === 含projectId但历史遗漏未纳入级联删除的类型（修复孤儿数据问题）===
    'chapter-outlines':      { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'repair-snapshots':      { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'comic-storyboards':     { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'comic-workflows':       { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'prompt-snapshots':      { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'interactions':          { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'platform-accounts':     { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'publish-queue':         { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'world-scopes':          { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'world-factions':        { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },
    'cross-world-traces':    { dedicated: false, syncable: false, cascadable: true,  hasProjectId: true,  aliases: [] },

    // === 不含projectId的全局类型 ===
    'agent-templates':       { dedicated: false, syncable: false, cascadable: false, hasProjectId: false, aliases: [] },
    'chapter-audits':        { dedicated: false, syncable: false, cascadable: false, hasProjectId: false, aliases: [] },
    'franchises':            { dedicated: false, syncable: false, cascadable: false, hasProjectId: false, aliases: [] },
    'franchise-materials':   { dedicated: false, syncable: false, cascadable: false, hasProjectId: false, aliases: [] },
    'foundation-prompts':    { dedicated: false, syncable: false, cascadable: false, hasProjectId: false, aliases: [] },
    'comic-config':          { dedicated: false, syncable: false, cascadable: false, hasProjectId: false, aliases: [] },
    'comic-render-queue':    { dedicated: false, syncable: false, cascadable: false, hasProjectId: false, aliases: [] },
};

// 构建别名→标准名映射表
const ALIAS_TO_STANDARD = {};
for (const [standardName, info] of Object.entries(DATA_STORE_REGISTRY)) {
    ALIAS_TO_STANDARD[standardName] = standardName;
    for (const alias of info.aliases) {
        ALIAS_TO_STANDARD[alias] = standardName;
    }
}

/**
 * 将任意名称归一化为标准名称
 * @param {string} name - 原始名称（可能是别名、下划线版本等）
 * @returns {string|null} 标准名称，未注册返回null
 */
function normalizeTypeName(name) {
    return ALIAS_TO_STANDARD[name] || null;
}

/**
 * 获取所有需要同步的数据类型（标准名称）
 */
function getSyncableTypes() {
    return Object.entries(DATA_STORE_REGISTRY)
        .filter(([, info]) => info.syncable)
        .map(([name]) => name);
}

/**
 * 获取所有需要级联删除的数据类型（标准名称）
 */
function getCascadableTypes() {
    return Object.entries(DATA_STORE_REGISTRY)
        .filter(([, info]) => info.cascadable)
        .map(([name]) => name);
}

/**
 * 获取所有有专用表的数据类型（标准名称）
 */
function getDedicatedTableTypes() {
    return Object.entries(DATA_STORE_REGISTRY)
        .filter(([, info]) => info.dedicated)
        .map(([name]) => name);
}

/**
 * 获取所有已注册的数据类型（标准名称）
 */
function getAllRegisteredTypes() {
    return Object.keys(DATA_STORE_REGISTRY);
}

/**
 * 获取需要同步的所有目录名（标准名+别名）
 * 用于遍历data目录下的实际目录
 * @returns {string[]} 目录名列表
 */
function getSyncableDirNames() {
    const names = [];
    for (const [name, info] of Object.entries(DATA_STORE_REGISTRY)) {
        if (!info.syncable) continue;
        names.push(name);
        for (const alias of info.aliases) {
            names.push(alias);
        }
    }
    return names;
}

/**
 * 获取需要级联删除的所有store type名称（标准名+别名）
 * 用于CASCADE_STORE_TYPES，需覆盖所有变体以确保级联删除不遗漏
 * @returns {string[]} store type名称列表
 */
function getCascadableStoreTypes() {
    const names = [];
    for (const [name, info] of Object.entries(DATA_STORE_REGISTRY)) {
        if (!info.cascadable) continue;
        names.push(name);
        for (const alias of info.aliases) {
            names.push(alias);
        }
    }
    return names;
}

module.exports = {
    DATA_STORE_REGISTRY,
    normalizeTypeName,
    getSyncableTypes,
    getCascadableTypes,
    getDedicatedTableTypes,
    getAllRegisteredTypes,
    getSyncableDirNames,
    getCascadableStoreTypes,
};
