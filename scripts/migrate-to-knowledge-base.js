const path = require('path');
try { require(path.join(__dirname, '..', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', '.env') }); } catch(_) {}

const store = require('../server/store');
const entityCenter = require('../server/services/entityCenter');
const { foreshadowLedger, memoryPyramid, narrativeTracker } = require('../server/services/knowledgeBase');
const { getGenreEntitySchema, buildGenreStateDefaults } = require('../server/config/genreEntitySchemas');

const ENTITY_TYPES = new Set(['character', 'equipment', 'location', 'faction', 'power-system', 'worldview', 'sub-plane', 'institution']);
const CRAFT_TYPES = new Set(['catchphrase', 'famous-scene', 'growth-history', 'foreshadowing', 'narrative-bridge', 'writing-technique', 'craft', 'mechanism', 'index', 'other', 'relationship']);

function extractField(content, label) {
    if (!content || typeof content !== 'string') return '';
    const match = content.match(new RegExp(`【${label}】(.+)`));
    return match ? match[1].trim() : '';
}

function extractGenreStateFromContent(content, genreId) {
    if (!content || typeof content !== 'string') return {};
    const schema = getGenreEntitySchema(genreId);
    const state = {};
    for (const [key, config] of Object.entries(schema.genreStateKeys || {})) {
        const match = content.match(new RegExp(`【${config.label}】(.+)`));
        if (match) {
            state[key] = config.type === 'number' ? (Number(match[1].trim()) || config.default) : match[1].trim();
        }
    }
    return state;
}

async function migrate() {
    console.log('=== 知识库迁移开始 ===\n');

    await store.ensureBackend();

    const allMaterials = await store.queryItems('materials', {});
    const projects = await store.listItems('projects');

    console.log(`素材总数: ${allMaterials.length}`);
    console.log(`项目总数: ${projects.length}\n`);

    const projectGenreMap = {};
    for (const p of projects) {
        let genreId = '';
        try {
            const { detectGenre } = require('../server/services/genreConfig');
            const genre = detectGenre(p.styleProfile || {});
            if (genre) genreId = genre.id;
        } catch (_) {}
        projectGenreMap[p.id] = genreId;
    }

    let entityCount = 0;
    let craftCount = 0;
    let foreshadowCount = 0;
    let dedupedCount = 0;

    for (const [projectId, genreId] of Object.entries(projectGenreMap)) {
        const projectMats = allMaterials.filter(m => m.projectId === projectId);
        const entityMats = projectMats.filter(m => ENTITY_TYPES.has(m.type));
        const craftMats = projectMats.filter(m => CRAFT_TYPES.has(m.type));

        const byNameAndType = {};
        for (const m of entityMats) {
            if (m.archived) continue;
            const key = `${m.type}:${m.name}`;
            if (!byNameAndType[key]) byNameAndType[key] = [];
            byNameAndType[key].push(m);
        }

        for (const [key, mats] of Object.entries(byNameAndType)) {
            const [entityType, name] = key.split(':');
            const sorted = mats.sort((a, b) => {
                const va = a.version || 1;
                const vb = b.version || 1;
                return vb - va;
            });
            const latest = sorted[0];
            const duplicates = sorted.slice(1);

            const content = latest.currentContent || latest.initialContent || '';

            try {
                const entity = await entityCenter.getOrCreateEntity(projectId, entityType, name, {
                    id: latest.id,
                    roleLevel: latest.roleLevel || (name === '陆野' || name === '沈星晚' ? 'protagonist' : 'npc'),
                    genreId,
                    sourceChapter: latest.sourceChapter || 0,
                    sourceContent: content,
                    position: extractField(content, '身份') || '',
                    personality: extractField(content, '性格') || '',
                    speakingTone: extractField(content, '说话语气') || '',
                    signatureDetail: extractField(content, '标志性细节') || '',
                    factionName: extractField(content, '阵营') || '',
                    genreState: extractGenreStateFromContent(content, genreId),
                    profile: {
                        appearance: extractField(content, '外貌') || '',
                        background: extractField(content, '背景') || '',
                        motivation: extractField(content, '核心欲望') || ''
                    },
                    parentEntityId: latest.parentFaction || latest.parentPlane || null,
                    tags: latest.tags || []
                });

                if (duplicates.length > 0) {
                    dedupedCount += duplicates.length;
                    for (const dup of duplicates) {
                        dup.archived = 'retire';
                        dup.archivedReason = `合并去重: 保留${latest.id}，废弃${dup.id}`;
                        dup.updatedAt = new Date().toISOString();
                        await store.setItem('materials', dup.id, dup);
                    }
                }

                entityCount++;
            } catch (err) {
                console.warn(`  迁移失败: ${entityType}/${name} - ${err.message}`);
            }
        }

        for (const m of craftMats) {
            if (m.archived) continue;

            if (m.type === 'foreshadowing') {
                try {
                    await foreshadowLedger.plant(projectId, m.name, m.currentContent || m.initialContent || '', {
                        id: `fs-${m.id}`,
                        plantChapter: m.sourceChapter || 0,
                        importance: 'normal'
                    });
                    foreshadowCount++;
                } catch (_) {}
            }

            craftCount++;
        }
    }

    console.log('\n=== 迁移统计 ===');
    console.log(`实体迁移: ${entityCount} 条`);
    console.log(`重复去重: ${dedupedCount} 条 (已标记archived=retire)`);
    console.log(`创作规范: ${craftCount} 条`);
    console.log(`伏笔入账: ${foreshadowCount} 条`);

    try {
        const stats = await entityCenter.getEntityStats(Object.keys(projectGenreMap)[0]);
        console.log(`\n验证 - 实体统计:`, JSON.stringify(stats, null, 2));
    } catch (_) {}

    const fs = await foreshadowLedger.getStats(Object.keys(projectGenreMap)[0]);
    console.log(`验证 - 伏笔统计:`, JSON.stringify(fs));

    console.log('\n=== 知识库迁移完成 ===');
    process.exit(0);
}

migrate().catch(err => {
    console.error('MIGRATION ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
});
