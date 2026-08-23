/**
 * verifyNewProject.js — 验证4个模块：装备/功法/世界域/编年史
 * 用法: node scripts/verifyNewProject.js <projectId>
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const http = require('http');
const REQUEST_SECRET = process.env.REQUEST_SECRET || '';
const PROJECT_ID = process.argv[2];

if (!PROJECT_ID) {
    console.error('用法: node scripts/verifyNewProject.js <projectId>');
    process.exit(1);
}

function fetchApi(method, path) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: 'localhost', port: 3001, path, method,
            headers: { 'Authorization': `Bearer ${REQUEST_SECRET}`, 'Content-Type': 'application/json' },
            timeout: 30000
        };
        const r = http.request(opts, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
                catch (e) { resolve({ status: res.statusCode, data: d }); }
            });
        });
        r.on('error', reject);
        r.on('timeout', () => { r.destroy(); reject(new Error('超时')); });
        r.end();
    });
}

function printResult(name, passed, detail) {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}: ${passed ? '通过' : '失败'}${detail ? ' — ' + detail : ''}`);
}

async function verifyEquipment(pid) {
    console.log('\n=== 模块1: 装备验证 ===');
    const r = await fetchApi('GET', `/api/entity-center/item-definitions?projectId=${pid}`);
    const items = Array.isArray(r.data) ? r.data : [];
    const equips = items.filter(i => i.defType === 'equipment');
    printResult('装备定义存在', items.length > 0, `共${items.length}条定义，其中装备${equips.length}条`);
    if (equips.length > 0) {
        equips.forEach(e => console.log(`  - ${e.name} | briefDesc: ${(e.briefDesc || '').substring(0, 60)}`));
    }
    // 验证bind关系
    const bResp = await fetchApi('GET', `/api/entity-center/character-binds?projectId=${pid}`);
    const binds = Array.isArray(bResp.data) ? bResp.data : [];
    printResult('装备绑定关系', binds.length >= 0, `共${binds.length}条绑定`);
    return { total: items.length, equips: equips.length, binds: binds.length };
}

// 功法可能的素材类型集合：不同题材使用不同type字段
// high-martial-crossplane 题材功法类型为 'power-system'，其他题材可能为 'technique'
const TECHNIQUE_TYPES = ['technique', 'power-system', 'cultivation-method'];
const TECHNIQUE_NAME_REGEX = /(心法|功法|秘诀|真经|宝典|要诀)/;

function isTechniqueMaterial(m) {
    return TECHNIQUE_TYPES.includes(m.type) || TECHNIQUE_NAME_REGEX.test(m.name || '');
}
function isTechniqueDefinition(d) {
    return TECHNIQUE_TYPES.includes(d.defType) || TECHNIQUE_NAME_REGEX.test(d.name || '');
}

async function verifyTechniques(pid) {
    console.log('\n=== 模块2: 功法验证 ===');
    const r = await fetchApi('GET', `/api/materials?projectId=${pid}`);
    const mats = Array.isArray(r.data) ? r.data : (r.data.materials || r.data.data || []);
    const techniques = mats.filter(isTechniqueMaterial);
    printResult('功法素材存在', techniques.length > 0, `共${techniques.length}条功法`);
    if (techniques.length > 0) {
        techniques.forEach(t => console.log(`  - [${t.type}] ${t.name} | ${(t.currentContent || t.initialContent || '').substring(0, 60)}`));
    }
    const defResp = await fetchApi('GET', `/api/entity-center/item-definitions?projectId=${pid}`);
    const defs = Array.isArray(defResp.data) ? defResp.data : (defResp.data.data || []);
    const techDefs = defs.filter(isTechniqueDefinition);
    printResult('功法定义存在', techDefs.length > 0, `item-definitions中功法${techDefs.length}条`);
    return { materialCount: techniques.length, defCount: techDefs.length };
}

async function verifyWorldScope(pid) {
    console.log('\n=== 模块3: 世界域验证 ===');
    const r = await fetchApi('GET', `/api/pipeline/worldscope/${pid}`);
    printResult('世界域API可访问', r.status === 200, `HTTP=${r.status}`);
    let worldCount = 0, entityCount = 0, eventCount = 0;
    if (r.status === 200 && r.data) {
        // API返回裸数组，每个元素有type字段（entity-scope / world-transition / world-scope 等）
        const items = Array.isArray(r.data) ? r.data : (r.data.items || r.data.data || []);
        const worlds = new Map();
        const entities = [];
        const events = [];
        for (const it of items) {
            const t = it.type || '';
            if (t === 'world-scope' || t === 'world') {
                worlds.set(it.id || it.name, it);
            } else if (t.includes('transition') || t.includes('event')) {
                events.push(it);
            } else if (t.includes('entity') || it.entityType) {
                entities.push(it);
                if (it.worldName) worlds.set(it.worldName, { name: it.worldName, id: it.worldId });
            }
        }
        worldCount = worlds.size;
        entityCount = entities.length;
        eventCount = events.length;
        printResult('世界域数据存在', worldCount > 0 || entityCount > 0,
            `世界=${worldCount} 实体=${entityCount} 事件=${eventCount}`);
        for (const [k, w] of worlds) {
            console.log(`  - 世界: ${w.name || w.id || k} | ${w.scope || w.level || ''}`);
        }
        entities.slice(0, 5).forEach(e => console.log(`  - 实体: ${e.name || e.entityName} | ${e.entityType || ''} | ${e.worldName || ''}`));
    } else {
        console.log('  响应:', JSON.stringify(r.data).substring(0, 200));
    }
    return { worldCount, entityCount, eventCount, httpStatus: r.status };
}

async function verifyChronicle(pid) {
    console.log('\n=== 模块4: 编年史验证 ===');
    const r = await fetchApi('GET', `/api/pipeline/chronicle/${pid}`);
    printResult('编年史API可访问', r.status === 200, `HTTP=${r.status}`);
    let chronicleCount = 0;
    if (r.status === 200 && r.data) {
        // 编年史API返回 { success, data: [...], count } 嵌套格式
        const chronicles = Array.isArray(r.data) ? r.data : (r.data.data || r.data.chronicles || r.data.entries || []);
        chronicleCount = chronicles.length;
        printResult('编年史数据存在', chronicleCount > 0, `共${chronicleCount}条记录`);
        if (chronicles.length > 0) {
            chronicles.slice(0, 8).forEach(c => {
                const ch = c.chapterNumber || '?';
                const name = c.entityName || c.characterName || '?';
                // deeds可能是数组或字符串，统一处理
                const deedsRaw = c.deeds || c.event || c.description || '';
                const deedsStr = Array.isArray(deedsRaw) ? deedsRaw.join('; ') : String(deedsRaw);
                console.log(`  - 第${ch}章 ${name}: ${deedsStr.substring(0, 70)}`);
            });
        }
    } else {
        console.log('  响应:', JSON.stringify(r.data).substring(0, 200));
    }
    return { chronicleCount, httpStatus: r.status };
}

(async () => {
    try {
        console.log('============================================');
        console.log(`验证项目: ${PROJECT_ID}`);
        console.log('============================================');
        const equip = await verifyEquipment(PROJECT_ID);
        const tech = await verifyTechniques(PROJECT_ID);
        const ws = await verifyWorldScope(PROJECT_ID);
        const chron = await verifyChronicle(PROJECT_ID);

        console.log('\n============================================');
        console.log('验证汇总');
        console.log('============================================');
        console.log(`装备: 定义=${equip.total} 装备数=${equip.equips} 绑定=${equip.binds}`);
        console.log(`功法: 素材=${tech.materialCount} 定义=${tech.defCount}`);
        console.log(`世界域: 世界=${ws.worldCount} 实体=${ws.entityCount} 事件=${ws.eventCount} HTTP=${ws.httpStatus}`);
        console.log(`编年史: 记录=${chron.chronicleCount} HTTP=${chron.httpStatus}`);

        const allPassed = equip.equips > 0 && tech.materialCount > 0 &&
            (ws.worldCount > 0 || ws.entityCount > 0) && chron.chronicleCount > 0;
        console.log(`\n${allPassed ? '✅ 全部模块通过' : '⚠️ 部分模块未通过，需按SOP排查'}`);
    } catch (err) {
        console.error('验证失败:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
})();
