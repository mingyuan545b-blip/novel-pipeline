/**
 * verifyRegistryConsistency.js — 注册表vs PG schema三方一致性校验
 * 验证: 1) 注册表列定义与PG schema对齐 2) generateExtractor输出完整
 * 运行: NODE_PATH=server node scripts/verifyRegistryConsistency.js
 */
const { generateExtractor, getExtractableColumns, getIndexedColumns } = require('db/fieldRegistry');
const { REGISTRY } = require('db/fieldRegistryData');

let errors = 0;
let warnings = 0;

function error(msg) { console.error(`[ERROR] ${msg}`); errors++; }
function warn(msg) { console.warn(`[WARN] ${msg}`); warnings++; }

// 1. 验证每个注册表都有extractor
console.log('\n=== 1. 验证extractor生成 ===');
for (const [tableName, tableDef] of Object.entries(REGISTRY)) {
    const extractor = generateExtractor(tableName);
    if (!extractor) { error(`${tableName}: generateExtractor返回null`); continue; }

    // 测试extractor输出
    const testData = { id: 'test-id', projectId: 'test-project' };
    const result = extractor(testData);
    const extractableCols = getExtractableColumns(tableName);
    for (const col of extractableCols) {
        if (!(col.name in result)) {
            error(`${tableName}.extractor: 缺少列 ${col.name}`);
        }
    }
    if (!('data' in result)) {
        error(`${tableName}.extractor: 缺少data列`);
    }
}

// 2. 验证注册表列完整性（与PG schema对齐）
console.log('\n=== 2. 验证列完整性 ===');
const PG_SCHEMA_COLUMNS = {
    materials: ['id','projectId','type','name','parentPlane','parentFaction','archived',
        'dialectRegion','dialectIntensity','speechStyle','speechStyleIntensity',
        'namingStyle','namingStyleIntensity','archetype','currentPlaneId','isLocked',
        'version','sourceChapter','roleLevel','lastAppearChapter','currentStatus','data','createdAt','updatedAt'],
    chapters: ['id','projectId','chapterNumber','status','title','wordCount','round','data','createdAt','updatedAt'],
    projects: ['id','mode','targetChapterCount','targetWordCount','data','createdAt','updatedAt'],
    api_keys: ['id','apiKey','groupId','model','provider','baseURL','name','_encrypted','data','createdAt','updatedAt'],
    agent_bindings: ['id','agentType','keyId','data','createdAt','updatedAt'],
    reviews: ['id','chapterId','projectId','reviewType','passed','data','createdAt','updatedAt'],
    pipeline_logs: ['id','projectId','chapterId','step','status','round','data','createdAt','updatedAt'],
    infinite_pipeline_state: ['id','projectId','running','phase','data','createdAt','updatedAt'],
    quests: ['id','projectId','parentId','status','priority','data','createdAt','updatedAt'],
    timelines: ['id','projectId','eventType','importance','isKeyEvent','data','createdAt','updatedAt'],
    entity_registry: ['id','projectId','entityType','name','briefName','roleLevel','isActive',
        'firstAppearChapter','lastAppearChapter','appearCount','parentPlane','parentFaction',
        'tags','description','data','createdAt','updatedAt'],
    entities: ['id','projectId','entityType','name','briefName','roleLevel','genreId','isActive',
        'isLocked','firstAppearChapter','lastAppearChapter','appearCount','parentEntityId','tags',
        'hp','combatPower','position','factionName','personality','speakingTone','signatureDetail',
        'genreState','profile','bindsSummary','relationsSummary','briefText','briefTokens',
        'summaryText','summaryTokens','detailText','detailTokens','sourceContent','version',
        'sourceChapter','archived','data','createdAt','updatedAt'],
    character_states: ['id','projectId','characterId','characterName','chapterNumber','delta',
        'stateChangedFields','previousChapterState','data','createdAt','updatedAt'],
    state_kv_index: ['id','projectId','scope','entityKey','dataKey','dataValue','dataType',
        'chapterUpdated','isHot','data','createdAt','updatedAt'],
    character_state_cache: ['id','characterId','projectId','chapterNumber','roleLevel',
        'briefText','briefTokens','summaryText','summaryTokens','detailText','detailTokens',
        'stateJson','bindsJson','relationsJson','deltaJson','changedFields','isValid',
        'computedAt','data','createdAt','updatedAt'],
    knowledge_facts: ['id','projectId','level','category','entityId','chapterNumber','factText',
        'importance','accessCount','lastAccessedChapter','decayScore','expiresAtChapter',
        'data','createdAt','updatedAt'],
    knowledge_access: ['id','projectId','factId','entityId','factText','confidence',
        'sourceHow','sinceChapter','notes','data','createdAt','updatedAt'],
    item_definitions: ['id','projectId','defType','name','rarity','briefDesc','summaryDesc',
        'detailDesc','loreDesc','briefTokens','summaryTokens','detailTokens','loreTokens',
        'propertiesJson','constraintsJson','sourceChapter','tags','data','createdAt','updatedAt'],
    character_binds: ['id','projectId','characterId','defId','bindType','bindStatus',
        'permanence','acquiredChapter','lostChapter','masteryLevel','masteryProgress',
        'personalNotes','customName','slotPosition','bindOrder','data','createdAt','updatedAt'],
    character_relations: ['id','projectId','fromCharacterId','toCharacterId','relType',
        'relLabel','strength','trustLevel','startChapter','endChapter','isSecret','notes',
        'data','createdAt','updatedAt'],
    pet_entities: ['id','projectId','ownerId','name','species','petClass','rarity',
        'growthStage','level','hp','mp','loyalty','intelligence','abilitiesJson',
        'equipmentSlots','briefDesc','summaryDesc','detailDesc','acquiredChapter',
        'isActive','data','createdAt','updatedAt'],
    servant_entities: ['id','projectId','masterId','name','servantType','loyalty',
        'competence','specialty','personality','briefDesc','summaryDesc','detailDesc',
        'recruitedChapter','dismissedChapter','isActive','data','createdAt','updatedAt'],
    character_chronicle: ['id','projectId','entityId','entityName','chapterNumber',
        'stance','innerConflict','quotes','deeds','stanceShiftReason','level',
        'data','createdAt'],
    entity_relations: ['id','projectId','fromEntityId','toEntityId','relType','relLabel',
        'strength','trustLevel','startChapter','endChapter','isSecret','cognitiveOnly','notes',
        'data','createdAt','updatedAt'],
    entity_binds: ['id','projectId','entityId','targetEntityId','bindType','bindStatus',
        'permanence','acquiredChapter','lostChapter','masteryLevel','masteryProgress',
        'personalNotes','customName','slotPosition','bindOrder','data','createdAt','updatedAt'],
    entity_state_history: ['id','entityId','projectId','chapterNumber','baseState','genreState',
        'delta','changedFields','bindsSnapshot','relationsSnapshot','briefText','summaryText',
        'detailText','isValid','computedAt','data','createdAt','updatedAt'],
    foreshadow_ledger: ['id','projectId','name','description','status','plantChapter',
        'lastAdvanceChapter','resolveChapter','expectedResolveWindow','importance',
        'relatedEntityIds','relatedPlotThreads','advanceLog','resolutionNotes',
        'data','createdAt','updatedAt'],
    timeline: ['id','projectId','chapterNumber','eventTime','eventType','actorIds',
        'locationId','description','precedingEventIds','duration','significance',
        'data','createdAt','updatedAt'],
    narrative_state: ['id','projectId','chapterNumber','phase','tension','pacing',
        'activePlotThreads','completedPlotThreads','milestone','emotionalArc',
        'readerExpectation','notes','data','createdAt','updatedAt'],
    consistency_checks: ['id','projectId','chapterNumber','checkType','severity','entityId',
        'description','expectedValue','actualValue','isResolved','resolvedChapter',
        'data','createdAt','updatedAt']
};

for (const [tableName, pgCols] of Object.entries(PG_SCHEMA_COLUMNS)) {
    const regDef = REGISTRY[tableName];
    if (!regDef) { error(`${tableName}: 注册表中不存在`); continue; }
    const regCols = Object.keys(regDef.columns);
    const missingInReg = pgCols.filter(c => !regCols.includes(c));
    const extraInReg = regCols.filter(c => !pgCols.includes(c));
    if (missingInReg.length > 0) error(`${tableName}: 注册表缺少PG列: ${missingInReg.join(',')}`);
    if (extraInReg.length > 0) warn(`${tableName}: 注册表多余列(不在PG): ${extraInReg.join(',')}`);
}

// 3. 验证buildWriterHandler能生成SQL
console.log('\n=== 3. 验证writer handler ===');
const { buildWriterHandler } = require('db/store-pg-writer-registry');
const handlerTables = ['entity_relations','entity_binds','foreshadow_ledger','timeline',
    'narrative_state','consistency_checks','entity_state_history',
    'reviews','pipeline_logs','infinite_pipeline_state','entities'];
for (const table of handlerTables) {
    const handler = buildWriterHandler(table);
    if (!handler) { error(`${table}: buildWriterHandler返回null`); continue; }
    if (typeof handler !== 'function') { error(`${table}: handler不是函数`); }
}

// 4. 验证extractor默认值与PG DEFAULT一致
console.log('\n=== 4. 验证默认值一致性 ===');
const PG_DEFAULTS = {};
for (const [key, { reg, pg }] of Object.entries(PG_DEFAULTS)) {
    if (reg !== pg) warn(`${key}: 注册表默认值='${reg}', PG DEFAULT='${pg}' (已知差异)`);
}

console.log(`\n=== 结果: ${errors} errors, ${warnings} warnings ===`);
process.exit(errors > 0 ? 1 : 0);
