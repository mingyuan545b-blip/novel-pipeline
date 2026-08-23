const JSON_DIR_TYPES = [
    { type: 'projects', dir: 'projects', pgTable: 'projects' },
    { type: 'materials', dir: 'materials', pgTable: 'materials' },
    { type: 'chapters', dir: 'chapters', pgTable: 'chapters' },
    { type: 'reviews', dir: 'reviews', pgTable: 'reviews' },
    { type: 'infinite-pipeline-state', dir: 'infinite-pipeline-state', pgTable: 'infinite_pipeline_state' },
    { type: 'quests', dir: 'quests', pgTable: 'quests' },
];

const KV_STORE_TYPES = [
    { type: 'pipeline-logs', pgTable: 'pipeline_logs' },
    { type: 'api-keys', pgTable: 'api_keys' },
    { type: 'agent-bindings', pgTable: 'agent_bindings' },
    { type: 'timelines', pgTable: 'timelines' },
    { type: 'constraint-presets', pgTable: 'kv_store' },
    { type: 'style-profiles', pgTable: 'kv_store' },
    { type: 'foundation-prompts', pgTable: 'kv_store' },
    { type: 'agent-templates', pgTable: 'kv_store' },
];

const SET_ITEM_TYPES = new Set(['projects', 'materials', 'chapters', 'api-keys', 'agent-bindings']);

function extractReviewFields(d) {
    return { id: d.id, chapterId: d.chapterId || '', projectId: d.projectId || '', reviewType: d.reviewType || 'first-review', passed: d.passed ? true : false, data: JSON.stringify(d) };
}

function extractPipelineLogFields(d) {
    return { id: d.id, projectId: d.projectId || '', chapterId: d.chapterId ?? null, step: d.step ?? null, status: d.status || 'running', round: d.round || 0, data: JSON.stringify(d) };
}

function extractInfinitePipelineStateFields(d) {
    return { id: d.id, projectId: d.projectId || '', running: d.running ? true : false, phase: d.phase ?? null, data: JSON.stringify(d) };
}

function extractTimelineFields(d) {
    return { id: d.id, projectId: d.projectId || '', eventType: d.eventType || 'plot', importance: d.importance || 'normal', isKeyEvent: d.isKeyEvent ? true : false, data: JSON.stringify(d) };
}

function extractQuestFields(d) {
    return { id: d.id, projectId: d.projectId || '', parentId: d.parentId ?? null, status: d.status || 'planned', priority: d.priority || 'normal', data: JSON.stringify(d) };
}

async function insertDirect(client, pgTable, item) {
    const now = item.updatedAt || new Date().toISOString();
    const createdAt = item.createdAt || now;
    const queries = {
        reviews: { extract: extractReviewFields, sql: 'INSERT INTO reviews (id, chapterId, projectId, reviewType, passed, data, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET chapterId=$2, projectId=$3, reviewType=$4, passed=$5, data=$6, updatedAt=$8', params: f => [f.id, f.chapterId, f.projectId, f.reviewType, f.passed, f.data, createdAt, now] },
        pipeline_logs: { extract: extractPipelineLogFields, sql: 'INSERT INTO pipeline_logs (id, projectId, chapterId, step, status, round, data, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET projectId=$2, chapterId=$3, step=$4, status=$5, round=$6, data=$7, updatedAt=$9', params: f => [f.id, f.projectId, f.chapterId, f.step, f.status, f.round, f.data, createdAt, now] },
        infinite_pipeline_state: { extract: extractInfinitePipelineStateFields, sql: 'INSERT INTO infinite_pipeline_state (id, projectId, running, phase, data, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET projectId=$2, running=$3, phase=$4, data=$5, updatedAt=$7', params: f => [f.id, f.projectId, f.running, f.phase, f.data, createdAt, now] },
        timelines: { extract: extractTimelineFields, sql: 'INSERT INTO timelines (id, projectId, eventType, importance, isKeyEvent, data, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET projectId=$2, eventType=$3, importance=$4, isKeyEvent=$5, data=$6, updatedAt=$8', params: f => [f.id, f.projectId, f.eventType, f.importance, f.isKeyEvent, f.data, createdAt, now] },
        quests: { extract: extractQuestFields, sql: 'INSERT INTO quests (id, projectId, parentId, status, priority, data, createdAt, updatedAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET projectId=$2, parentId=$3, status=$4, priority=$5, data=$6, updatedAt=$8', params: f => [f.id, f.projectId, f.parentId, f.status, f.priority, f.data, createdAt, now] },
    };
    const q = queries[pgTable];
    if (!q) throw new Error(`Unknown PG table: ${pgTable}`);
    const f = q.extract(item);
    await client.query(q.sql, q.params(f));
}

module.exports = { JSON_DIR_TYPES, KV_STORE_TYPES, SET_ITEM_TYPES, insertDirect };
