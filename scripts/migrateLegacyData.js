/**
 * migrateLegacyData.js — 遗留数据迁移脚本
 *
 * 修复3个遗留问题：
 * 1. entity.genreState.currentPlane = "主位面" → "主世界"
 * 2. entity-registry.genreState.currentPlane = "主位面" → "主世界"
 * 3. materials.name/content 中的 "次位面" → "小世界"
 * 4. state-kv-index 中的 currentPlane = "主位面" → "主世界"
 *
 * 同时扫描所有项目，不只是测试项目。
 */
// 必须先加载.env，否则store会用JSON file backend而非PostgreSQL
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), override: true });
const store = require('../server/store');

const REPLACEMENTS = Object.freeze({
    '主位面': '主世界',
    '次位面': '小世界',
    '每位面': '每小世界'
});

const log = (msg, detail) => {
    console.log(`[${new Date().toISOString().substring(11, 19)}] ${msg}`);
    if (detail) console.log(`  ${detail}`);
};

async function migrateEntities() {
    log('=== 迁移 entities 表 ===');
    const entities = await store.queryItems('entities', {});
    let fixed = 0;
    for (const entity of entities) {
        let changed = false;
        const updated = { ...entity };

        // 修复 genreState.currentPlane
        if (updated.genreState && typeof updated.genreState === 'object') {
            const gs = updated.genreState;
            if (typeof gs.currentPlane === 'string' && gs.currentPlane !== '主世界') {
                log(`  修复 ${updated.name}: currentPlane "${gs.currentPlane}" → "主世界"`);
                gs.currentPlane = '主世界';
                changed = true;
            }
        }

        // 修复 name 中的术语
        if (updated.name && typeof updated.name === 'string') {
            let newName = updated.name;
            for (const [old, neu] of Object.entries(REPLACEMENTS)) {
                if (newName.includes(old)) {
                    log(`  修复 ${updated.name}: name 含 "${old}"`);
                    newName = newName.split(old).join(neu);
                }
            }
            if (newName !== updated.name) {
                updated.name = newName;
                changed = true;
            }
        }

        if (changed) {
            updated.updatedAt = new Date().toISOString();
            await store.setItem('entities', updated.id, updated);
            fixed++;
        }
    }
    log(`entities: 修复 ${fixed}/${entities.length} 条`);
    return fixed;
}

async function migrateEntityRegistry() {
    log('=== 迁移 entity-registry 表 ===');
    const registry = await store.queryItems('entity-registry', {});
    let fixed = 0;
    for (const reg of registry) {
        let changed = false;
        const updated = { ...reg };

        if (updated.genreState && typeof updated.genreState === 'object') {
            const gs = updated.genreState;
            if (typeof gs.currentPlane === 'string' && gs.currentPlane !== '主世界') {
                log(`  修复 ${updated.name}: currentPlane "${gs.currentPlane}" → "主世界"`);
                gs.currentPlane = '主世界';
                changed = true;
            }
        }

        // 修复 parentPlane
        if (updated.parentPlane && typeof updated.parentPlane === 'string') {
            let newPlane = updated.parentPlane;
            for (const [old, neu] of Object.entries(REPLACEMENTS)) {
                if (newPlane.includes(old)) newPlane = newPlane.split(old).join(neu);
            }
            if (newPlane !== updated.parentPlane) {
                log(`  修复 ${updated.name}: parentPlane "${updated.parentPlane}" → "${newPlane}"`);
                updated.parentPlane = newPlane;
                changed = true;
            }
        }

        if (changed) {
            updated.updatedAt = new Date().toISOString();
            await store.setItem('entity-registry', updated.id, updated);
            fixed++;
        }
    }
    log(`entity-registry: 修复 ${fixed}/${registry.length} 条`);
    return fixed;
}

async function migrateMaterials() {
    log('=== 迁移 materials 表 ===');
    const materials = await store.queryItems('materials', {});
    let fixed = 0;
    for (const mat of materials) {
        let changed = false;
        const updated = { ...mat };

        // 修复 name
        if (updated.name && typeof updated.name === 'string') {
            let newName = updated.name;
            for (const [old, neu] of Object.entries(REPLACEMENTS)) {
                if (newName.includes(old)) {
                    log(`  修复 ${updated.name}: name 含 "${old}" → "${neu}"`);
                    newName = newName.split(old).join(neu);
                }
            }
            if (newName !== updated.name) {
                updated.name = newName;
                changed = true;
            }
        }

        // 修复 currentContent
        if (updated.currentContent && typeof updated.currentContent === 'string') {
            let newContent = updated.currentContent;
            let contentChanged = false;
            for (const [old, neu] of Object.entries(REPLACEMENTS)) {
                if (newContent.includes(old)) {
                    const before = newContent;
                    newContent = newContent.split(old).join(neu);
                    if (newContent !== before) contentChanged = true;
                }
            }
            if (contentChanged) {
                log(`  修复 ${updated.name}: currentContent 含术语`);
                updated.currentContent = newContent;
                changed = true;
            }
        }

        if (changed) {
            updated.updatedAt = new Date().toISOString();
            await store.setItem('materials', updated.id, updated);
            fixed++;
        }
    }
    log(`materials: 修复 ${fixed}/${materials.length} 条`);
    return fixed;
}

async function migrateStateKV() {
    log('=== 迁移 state-kv-index 表 ===');
    const items = await store.queryItems('state-kv-index', {});
    let fixed = 0;
    for (const item of items) {
        if (item.dataKey === 'currentPlane' && item.dataValue && item.dataValue !== '主世界') {
            log(`  修复 ${item.entityKey}: currentPlane "${item.dataValue}" → "主世界"`);
            const updated = { ...item, dataValue: '主世界', updatedAt: new Date().toISOString() };
            await store.setItem('state-kv-index', item.id, updated);
            fixed++;
        }
    }
    log(`state-kv-index: 修复 ${fixed}/${items.length} 条`);
    return fixed;
}

(async () => {
    console.log('========================================\n遗留数据迁移\n========================================');
    const e1 = await migrateEntities();
    const e2 = await migrateEntityRegistry();
    const e3 = await migrateMaterials();
    const e4 = await migrateStateKV();
    console.log('\n========================================\n迁移完成\n========================================');
    console.log(`entities: ${e1}, entity-registry: ${e2}, materials: ${e3}, state-kv-index: ${e4}`);
    console.log(`总计修复: ${e1 + e2 + e3 + e4} 条`);
    process.exit(0);
})().catch((e) => { console.error('ERR:', e); process.exit(1); });
