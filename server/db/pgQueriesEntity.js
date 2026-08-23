const { getPool } = require('./pgPool');
const { safeParse } = require('./pgCore');

async function queryEntityRegistry(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM entity_registry WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.entityType) { paramIdx++; sql += ` AND entityType = $${paramIdx}`; params.push(options.entityType); }
    if (options.isActive !== undefined) { paramIdx++; sql += ` AND isActive = $${paramIdx}`; params.push(options.isActive ? true : false); }
    if (options.name) { paramIdx++; sql += ` AND name = $${paramIdx}`; params.push(options.name); }
    if (options.roleLevel) { paramIdx++; sql += ` AND roleLevel = $${paramIdx}`; params.push(options.roleLevel); }
    sql += ' ORDER BY appearCount DESC, name ASC';
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryEntityRegistry')).filter(Boolean);
}

async function queryItemDefinitions(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM item_definitions WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.defType) { paramIdx++; sql += ` AND defType = $${paramIdx}`; params.push(options.defType); }
    if (options.rarity) { paramIdx++; sql += ` AND rarity = $${paramIdx}`; params.push(options.rarity); }
    if (options.name) { paramIdx++; sql += ` AND name = $${paramIdx}`; params.push(options.name); }
    sql += ' ORDER BY name ASC';
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryItemDefinitions')).filter(Boolean);
}

async function queryCharacterBinds(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM character_binds WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.characterId) { paramIdx++; sql += ` AND characterId = $${paramIdx}`; params.push(options.characterId); }
    if (options.bindType) { paramIdx++; sql += ` AND bindType = $${paramIdx}`; params.push(options.bindType); }
    if (options.bindStatus) { paramIdx++; sql += ` AND bindStatus = $${paramIdx}`; params.push(options.bindStatus); }
    if (options.defId) { paramIdx++; sql += ` AND defId = $${paramIdx}`; params.push(options.defId); }
    sql += ' ORDER BY bindOrder ASC, bindType ASC';
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryCharacterBinds')).filter(Boolean);
}

async function queryCharacterRelations(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM character_relations WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.fromCharacterId) { paramIdx++; sql += ` AND fromCharacterId = $${paramIdx}`; params.push(options.fromCharacterId); }
    if (options.toCharacterId) { paramIdx++; sql += ` AND toCharacterId = $${paramIdx}`; params.push(options.toCharacterId); }
    if (options.relType) { paramIdx++; sql += ` AND relType = $${paramIdx}`; params.push(options.relType); }
    sql += ' ORDER BY strength DESC';
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryCharacterRelations')).filter(Boolean);
}

async function queryPetEntities(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM pet_entities WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.ownerId) { paramIdx++; sql += ` AND ownerId = $${paramIdx}`; params.push(options.ownerId); }
    if (options.isActive !== undefined) { paramIdx++; sql += ` AND isActive = $${paramIdx}`; params.push(options.isActive ? true : false); }
    if (options.species) { paramIdx++; sql += ` AND species = $${paramIdx}`; params.push(options.species); }
    sql += ' ORDER BY name ASC';
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryPetEntities')).filter(Boolean);
}

async function queryServantEntities(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM servant_entities WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.masterId) { paramIdx++; sql += ` AND masterId = $${paramIdx}`; params.push(options.masterId); }
    if (options.isActive !== undefined) { paramIdx++; sql += ` AND isActive = $${paramIdx}`; params.push(options.isActive ? true : false); }
    if (options.servantType) { paramIdx++; sql += ` AND servantType = $${paramIdx}`; params.push(options.servantType); }
    sql += ' ORDER BY name ASC';
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryServantEntities')).filter(Boolean);
}

async function queryChronicle(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM character_chronicle WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.entityId) { paramIdx++; sql += ` AND entityId = $${paramIdx}`; params.push(options.entityId); }
    if (options.fromChapter) { paramIdx++; sql += ` AND chapterNumber >= $${paramIdx}`; params.push(options.fromChapter); }
    if (options.toChapter) { paramIdx++; sql += ` AND chapterNumber <= $${paramIdx}`; params.push(options.toChapter); }
    sql += ' ORDER BY chapterNumber ASC';
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryChronicle')).filter(Boolean);
}

async function queryKnowledgeAccess(projectId, options = {}) {
    const pool = getPool();
    let sql = 'SELECT data FROM knowledge_access WHERE projectId = $1';
    const params = [projectId];
    let paramIdx = 1;
    if (options.factId) { paramIdx++; sql += ` AND factId = $${paramIdx}`; params.push(options.factId); }
    if (options.entityId) { paramIdx++; sql += ` AND entityId = $${paramIdx}`; params.push(options.entityId); }
    if (options.confidence) { paramIdx++; sql += ` AND confidence = $${paramIdx}`; params.push(options.confidence); }
    if (options.sinceChapter !== undefined) { paramIdx++; sql += ` AND sinceChapter >= $${paramIdx}`; params.push(options.sinceChapter); }
    sql += ' ORDER BY sinceChapter ASC, factId ASC';
    const result = await pool.query(sql, params);
    return result.rows.map(r => safeParse(r.data, 'queryKnowledgeAccess')).filter(Boolean);
}

module.exports = {
    queryEntityRegistry, queryItemDefinitions, queryCharacterBinds,
    queryCharacterRelations, queryPetEntities, queryServantEntities,
    queryChronicle, queryKnowledgeAccess
};
