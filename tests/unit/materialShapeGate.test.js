/**
 * T4 验收：形状不变量 + 写入点闸门
 *
 * 验收标准（硬断言）：
 *  A. 真实库往返：**任何来源**写进来的脏素材（旧 changeLog / 无 provenance / 字符串 version）
 *     读出来必须已合规 —— 证明"存储层单点兜底"真的生效
 *  B. 增量写入点闸门：新增一处 `setItem('materials', ...)` 必须被拦下（exit ≠ 0）
 *  C. 接线检查：存储层若被摘掉 normalizeMaterialRecord，闸门必须报错
 *  D. 现有仓库必须通过闸门（exit 0）—— 否则 CI 形同虚设
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { initDatabaseAsync, closeDatabase } = require('../../server/db/database');
const sqliteStore = require('../../server/db/store');
const { normalizeMaterialRecord, checkMaterialShape } = require('../../server/config/materialShape');
const { collectWriteSites, checkWiring, diffBaseline } = require('../../scripts/audit-material-shape');

const ROOT = path.join(__dirname, '..', '..');
const NOW = '2026-10-07T00:00:00.000Z';

describe('T4-A 存储层形状不变量（真实往返）', () => {
    beforeAll(async () => { await initDatabaseAsync(':memory:'); });
    afterAll(() => { closeDatabase(); });

    test('脏素材（旧 changeLog + 无 provenance + 字符串 version）经存储后自动合规', async () => {
        const dirty = {
            id: 'dirty-1', projectId: 'p-shape', type: 'character', name: '脏数据',
            currentContent: '内容', version: '3', sourceChapter: '5',
            changeLog: [
                { from: '', to: '初版', reason: 'Initial creation', timestamp: '2026-01-01T00:00:00.000Z' },
                { type: 'repair-update', timestamp: '2026-01-02T00:00:00.000Z', oldContent: 'a', newContent: 'b' },
            ],
        };
        await sqliteStore.setItem('materials', dirty.id, dirty);
        const back = await sqliteStore.getItem('materials', dirty.id);

        const shape = checkMaterialShape(back);
        expect(shape.problems).toEqual([]);
        expect(shape.ok).toBe(true);
        expect(back.provenance.createdChapter).toBe(5);
        expect(back.version).toBe(3);                     // 字符串 → 数字
        expect(typeof back.createdAt).toBe('string');
        expect(back.changeLog.every(e => e.v === 2)).toBe(true);
        expect(back.changeLog.map(e => e.action)).toEqual(['created', 'repair-update']);
    });

    test('完全没有 provenance/changeLog 的极简写入也被补齐（不是只补"看起来像"的）', async () => {
        await sqliteStore.setItem('materials', 'dirty-2', { id: 'dirty-2', projectId: 'p-shape', type: 'equipment', name: '裸对象' });
        const back = await sqliteStore.getItem('materials', 'dirty-2');
        expect(checkMaterialShape(back).ok).toBe(true);
        expect(back.provenance).toMatchObject({ createdChapter: 0 });
        expect(back.changeLog).toEqual([]);
        expect(back.version).toBe(1);
    });

    test('归一器是纯函数：不修改入参对象，且幂等', () => {
        const src = { id: 'x', version: '2', changeLog: [{ reason: 'r' }] };
        const before = JSON.stringify(src);
        const a = normalizeMaterialRecord(src, NOW);
        const b = normalizeMaterialRecord(a, NOW);
        expect(JSON.stringify(src)).toBe(before);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
});

describe('T4-B/C 闸门真的能拦人', () => {
    let tmp;
    beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shape-gate-')); });
    afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

    const writeFixture = (rel, content) => {
        const full = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
    };

    test('B. 新增写入点 → diffBaseline 判定为"新增"（会被拦）', () => {
        writeFixture(path.join('server', 'services', 'evil.js'), "const store=require('../store');\nawait store.setItem('materials', id, obj);\n");
        const sites = collectWriteSites(tmp);
        expect(sites[path.join('server', 'services', 'evil.js')]).toBe(1);

        const emptyBaseline = { __total: 0 };
        expect(diffBaseline(sites, emptyBaseline).increased).toHaveLength(1);
    });

    test('B2. 豁免路径（materialRepository / db / scripts / tests）不算违规', () => {
        writeFixture(path.join('server', 'services', 'materialRepository.js'), "store.setItem('materials', id, r);\n");
        writeFixture(path.join('server', 'db', 'somewhere.js'), "store.setItem('materials', id, r);\n");
        writeFixture(path.join('server', 'scripts', 'tmp.js'), "store.setItem('materials', id, r);\n");
        writeFixture(path.join('tests', 'unit', 'x.test.js'), "store.setItem('materials', id, r);\n");
        const sites = collectWriteSites(tmp);
        for (const p of ['server/services/materialRepository.js', 'server/db/somewhere.js', 'server/scripts/tmp.js', 'tests/unit/x.test.js']) {
            expect(sites[path.join(...p.split('/'))]).toBeUndefined();
        }
    });

    test('C. 摘掉存储层接线 → checkWiring 必须报错', () => {
        writeFixture(path.join('server', 'db', 'storeTrim.js'), 'function trimItemData(d){return d;}\n');
        writeFixture(path.join('server', 'db', 'storeCommon.js'), 'const { normalizeMaterialRecord } = require("x");\n');
        const problems = checkWiring(tmp);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('storeTrim.js');
    });
});

describe('T4-D 现有仓库必须通过闸门', () => {
    test('node scripts/audit-material-shape.js → exit 0', () => {
        const out = execFileSync('node', [path.join(ROOT, 'scripts', 'audit-material-shape.js')], { cwd: ROOT, encoding: 'utf8' });
        expect(out).toContain('MATERIAL SHAPE AUDIT 通过');
    });

    test('--db 真实库抽样也必须通过（存量数据形状合规）', () => {
        const out = execFileSync('node', [path.join(ROOT, 'scripts', 'audit-material-shape.js'), '--db'], { cwd: ROOT, encoding: 'utf8' });
        expect(out).toContain('MATERIAL SHAPE AUDIT 通过');
    }, 60000);
});
