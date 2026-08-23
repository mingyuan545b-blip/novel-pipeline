/**
 * 迁移entity_registry数据到entities新表 - 使用store-pg兼容方式
 */
process.env.USE_PG = 'true';

const store = require('../server/store');

async function run() {
    await store.ensureBackend();

    const { initPgPool, closePgPool } = require('../server/db/pgPool');
    const pool = await initPgPool();

    // Read all active entity_registry records
    const records = await pool.query(`
        SELECT er.id, er.name, er.projectid, er.entitytype, er.rolelevel,
               er.appearcount, er.isactive,
               m.data::text as data_text
        FROM entity_registry er
        LEFT JOIN materials m ON m.id = er.id
        WHERE er.isactive = true
        ORDER BY er.projectid, er.entitytype, er.name
    `);
    console.log(`Found ${records.rows.length} active entity_registry records`);

    let migrated = 0;

    for (const rec of records.rows) {
        let content = '';
        let genreState = {};
        let profile = {};
        try {
            const data = JSON.parse(rec.data_text || '{}');
            content = data.currentContent || data.initialContent || '';
            genreState = data.genreState || {};
            profile = data.profile || {};
        } catch (_) {}

        const entity = {
            id: rec.id,
            projectId: rec.projectid,
            entityType: rec.entitytype,
            name: rec.name,
            briefName: rec.name.substring(0, 4),
            roleLevel: rec.rolelevel || 'npc',
            genreId: '',
            isActive: true,
            isLocked: false,
            firstAppearChapter: 0,
            lastAppearChapter: 0,
            appearCount: rec.appearcount || 1,
            parentEntityId: null,
            tags: [],
            hp: 100,
            combatPower: 0,
            position: '',
            factionName: '',
            personality: '',
            speakingTone: '',
            signatureDetail: '',
            genreState: genreState,
            profile: profile,
            bindsSummary: [],
            relationsSummary: [],
            briefText: `【${rec.name}】等级:${rec.rolelevel || 'npc'}`,
            summaryText: `【${rec.name}】等级:${rec.rolelevel || 'npc'}`,
            detailText: content.substring(0, 500),
            sourceContent: content,
            version: 1,
            sourceChapter: null,
            archived: '',
            data: {}
        };

        try {
            await store.setItem('entities', rec.id, entity);
            migrated++;
            console.log(`  Migrated: "${entity.name}" (${entity.entityType}) role=${entity.roleLevel}`);
        } catch (e) {
            console.error(`  Failed: "${entity.name}" - ${e.message}`);
        }
    }

    console.log(`\nMigrated: ${migrated}`);

    // Verify
    const count = await pool.query('SELECT COUNT(*) as cnt FROM entities');
    console.log(`entities table now has: ${count.rows[0].cnt} records`);

    await closePgPool();
}

run().catch(e => console.error(e));
