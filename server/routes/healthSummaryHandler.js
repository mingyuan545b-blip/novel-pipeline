// 健康检查主处理器（自 health.js 提取，行为不变）
const store = require('../store');
const fs = require('fs');
const path = require('path');
const { getAvailableProviders } = require('../config/providerRegistry');
const license = require('../services/license');
const { collectRuntimeProbes } = require('./healthRuntimeProbes');

// 服务启动时间戳 — 模块加载时记录，用于版本校验
const SERVER_STARTED_AT = new Date().toISOString();
const SERVER_PID = process.pid;

async function handleHealthSummary(req, res) {
    const checks = {};
    const errors = [];
    const warnings = [];

    // 陷阱#19修复：source 必须从 store 实际后端类型获取，不能硬编码 'pg'
    // 之前 PG 降级到 JSON 后，health 仍显示 source: 'pg'，造成"假健康"
    const backendStatus = store.getBackendStatus();
    const actualBackend = backendStatus.type || 'unknown';

    async function checkDb(name, type) {
        try {
            const items = await store.listItems(type);
            checks[name] = { source: actualBackend, count: items.length, ok: true };
        } catch (e) {
            checks[name] = { source: actualBackend, count: 0, ok: false, error: e.message };
            errors.push(`${name}: ${e.message}`);
        }
    }

    async function checkDir(name, dirPath) {
        try {
            const exists = fs.existsSync(dirPath);
            if (exists) {
                const entries = fs.readdirSync(dirPath, { withFileTypes: true }).filter(d => d.isDirectory());
                checks[name] = { source: 'fs', count: entries.length, ok: true };
            } else {
                checks[name] = { source: 'fs', count: 0, ok: true, note: 'directory not created yet' };
            }
        } catch (e) {
            checks[name] = { source: 'fs', count: 0, ok: false, error: e.message };
            errors.push(`${name}: ${e.message}`);
        }
    }

    // 分批执行DB/FS检查，避免Windows下高并发触发栈溢出（陷阱#34）
    // 每批5个串行执行，批与批之间并行
    const checkEntries = [
        ['projects', () => checkDb('projects', 'projects')],
        ['chapters', () => checkDb('chapters', 'chapters')],
        ['materials', () => checkDb('materials', 'materials')],
        ['quests', () => checkDb('quests', 'quests')],
        ['timelines', () => checkDb('timelines', 'timelines')],
        ['agent_bindings', () => checkDb('agent_bindings', 'agent_bindings')],
        ['agent-templates', () => checkDb('agent-templates', 'agent-templates')],
        ['style-profiles', () => checkDb('style-profiles', 'style-profiles')],
        ['constraint-presets', () => checkDb('constraint-presets', 'constraint-presets')],
        ['character_states', () => checkDb('character_states', 'character_states')],
        ['state_kv_index', () => checkDb('state_kv_index', 'state_kv_index')],
        ['entity_registry', () => checkDb('entity_registry', 'entity_registry')],
        ['item_definitions', () => checkDb('item_definitions', 'item_definitions')],
        ['character_binds', () => checkDb('character_binds', 'character_binds')],
        ['character_relations', () => checkDb('character_relations', 'character_relations')],
        ['pet_entities', () => checkDb('pet_entities', 'pet_entities')],
        ['servant_entities', () => checkDb('servant_entities', 'servant_entities')],
        ['mcp-agents', () => checkDir('mcp-agents', path.join(__dirname, '..', '..', 'mcp-agents'))],
        ['library', () => checkDir('library', path.join(__dirname, '..', '..', 'data', 'library'))],
    ];

    const CHUNK_SIZE = 5;
    for (let i = 0; i < checkEntries.length; i += CHUNK_SIZE) {
        const chunk = checkEntries.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(([, fn]) => fn()));
    }

    const { FALLBACK_AGENT_TEMPLATES } = require('../services/prompts/promptBuilder');
    const { BASE_CONSTRAINT_PRESETS } = require('../services/prompts/constraintInjector');
    const { getRegisteredGenres } = require('../services/genreConfig');

    checks['fallback-agents'] = { source: 'builtin', count: Object.keys(FALLBACK_AGENT_TEMPLATES).length, ok: true };
    checks['fallback-constraints'] = { source: 'builtin', count: Object.keys(BASE_CONSTRAINT_PRESETS).length, ok: true };
    checks['genre-registry'] = { source: 'builtin', count: getRegisteredGenres().length, ok: true };

    const providers = getAvailableProviders();
    const availableProviders = providers.filter(p => p.available);
    checks['llm-providers'] = {
        source: 'env',
        total: providers.length,
        available: availableProviders.length,
        providers: providers.map(p => ({ id: p.id, label: p.label, available: p.available })),
        ok: availableProviders.length > 0
    };
    if (availableProviders.length === 0) {
        errors.push('No LLM provider API key configured');
    }

    // 运行时预警：LLM 超时/慢请求 + 流水线任务看门狗（探针实现见 healthRuntimeProbes）
    collectRuntimeProbes(checks, errors, warnings);

    const allOk = errors.length === 0;

    // 陷阱#19修复：响应顶层暴露后端类型和降级状态
    // 前端可据此显示降级告警，避免"数据丢失但无任何提示"
    const isDegraded = backendStatus.degraded === true;
    const responseStatus = (!allOk || isDegraded) ? 'degraded' : 'healthy';

    res.json({
        success: true,
        status: responseStatus,
        timestamp: new Date().toISOString(),
        startedAt: SERVER_STARTED_AT,
        pid: SERVER_PID,
        version: license.VERSION,
        // 后端实际类型（pg/sqlite/json），不再硬编码
        backend: actualBackend,
        // 是否发生了非预期降级（如配置了 PG 但回退到 JSON）
        degraded: isDegraded,
        // 降级原因（仅降级时存在）
        degradedReason: isDegraded ? backendStatus.degradedReason : undefined,
        // 运行时预警（LLM 超时/卡死任务等），非致命但需要前端/运维可见
        warnings,
        // 配置期望的后端类型
        requestedBackend: backendStatus.requestedBackend || null,
        checks,
        errors: errors.length > 0 ? errors : undefined
    });
}

module.exports = { handleHealthSummary };
