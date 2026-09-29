/**
 * pgBackup.test.js — PG 备份核心逻辑单测
 *
 * 覆盖：连接串解析（含口令 URL 编码）、备份ID生成、sha256、manifest 读写往返、
 *      保留策略（保留最近的 N 份）、pg_dump 工具定位（环境变量优先）。
 * 对应工单：docs/worklog/2026-09-30-P0兜底四件套.md（P0-1 数据库零备份风险）
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const core = require('../../scripts/lib/pgBackupCore');

let tmpRoot;

beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pgbak-test-'));
});

afterEach(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* 忽略清理失败 */ }
    delete process.env.PG_DUMP_PATH;
});

/** 造一个带 manifest 的备份目录 */
function makeFakeBackup(outDir, id, payload) {
    const dir = path.join(outDir, id);
    fs.mkdirSync(dir, { recursive: true });
    const dump = path.join(dir, core.DUMP_NAME);
    fs.writeFileSync(dump, payload || id);
    core.writeManifest(dir, {
        id, bytes: fs.statSync(dump).size, sha256: core.sha256File(dump), dumpFile: core.DUMP_NAME,
    });
    return dir;
}

describe('parseConn', () => {
    test('解析无口令的连接串', () => {
        expect(core.parseConn('postgresql://postgres@localhost:5432/novel_pipeline'))
            .toEqual({ host: 'localhost', port: '5432', user: 'postgres', password: '', database: 'novel_pipeline' });
    });

    test('口令与用户名支持 URL 编码', () => {
        const r = core.parseConn('postgresql://u%40x:p%3Ass@db.internal:5433/my_db');
        expect(r.user).toBe('u@x');
        expect(r.password).toBe('p:ss');
        expect(r.database).toBe('my_db');
    });

    test('缺省端口回落 5432', () => {
        expect(core.parseConn('postgres://postgres@localhost/db1').port).toBe('5432');
    });

    test('缺连接串/非PG协议/缺库名 均抛错', () => {
        expect(() => core.parseConn('')).toThrow(/连接串/);
        expect(() => core.parseConn('mysql://a@b:3306/c')).toThrow(/协议/);
        expect(() => core.parseConn('postgresql://a@b:5432/')).toThrow(/数据库名/);
        expect(() => core.parseConn('not a url')).toThrow(/合法 URL/);
    });
});

describe('makeBackupId', () => {
    test('格式为 backup-YYYYMMDD-HHmmss 且补零', () => {
        expect(core.makeBackupId(new Date(2026, 8, 30, 14, 5, 6))).toBe('backup-20260930-140506');
    });
    test('前缀与 BACKUP_PREFIX 一致（listBackups 依赖）', () => {
        expect(core.makeBackupId().startsWith(core.BACKUP_PREFIX)).toBe(true);
    });
});

describe('sha256File', () => {
    test('与 crypto 计算结果一致', () => {
        const f = path.join(tmpRoot, 'a.txt');
        fs.writeFileSync(f, 'novel-pipeline');
        const expectHash = crypto.createHash('sha256').update('novel-pipeline').digest('hex');
        expect(core.sha256File(f)).toBe(expectHash);
    });
    test('内容不同则摘要不同（可检出损坏）', () => {
        const f1 = path.join(tmpRoot, '1.txt'); const f2 = path.join(tmpRoot, '2.txt');
        fs.writeFileSync(f1, 'aaa'); fs.writeFileSync(f2, 'aab');
        expect(core.sha256File(f1)).not.toBe(core.sha256File(f2));
    });
});

describe('manifest 读写', () => {
    test('写入后可读回', () => {
        const dir = path.join(tmpRoot, 'b1');
        core.writeManifest(dir, { id: 'b1', bytes: 3 });
        expect(core.readManifest(dir)).toEqual({ id: 'b1', bytes: 3 });
    });
    test('无 manifest / 非法 JSON 时返回 null 不抛错', () => {
        const dir = path.join(tmpRoot, 'b2');
        fs.mkdirSync(dir, { recursive: true });
        expect(core.readManifest(dir)).toBeNull();
        fs.writeFileSync(path.join(dir, core.MANIFEST_NAME), '{bad json');
        expect(core.readManifest(dir)).toBeNull();
    });
});

describe('listBackups', () => {
    test('新的在前，非备份目录被忽略', () => {
        makeFakeBackup(tmpRoot, 'backup-20260901-010101');
        makeFakeBackup(tmpRoot, 'backup-20260902-010101');
        fs.mkdirSync(path.join(tmpRoot, 'random-dir'), { recursive: true });
        const list = core.listBackups(tmpRoot);
        expect(list.map(b => b.id)).toEqual(['backup-20260902-010101', 'backup-20260901-010101']);
        expect(list.every(b => b.valid)).toBe(true);
    });

    test('缺 manifest 的目录 valid=false（不参与校验）', () => {
        fs.mkdirSync(path.join(tmpRoot, 'backup-20260903-010101'), { recursive: true });
        expect(core.listBackups(tmpRoot)[0].valid).toBe(false);
    });

    test('目录不存在时返回空数组', () => {
        expect(core.listBackups(path.join(tmpRoot, 'nope'))).toEqual([]);
    });
});

describe('applyRetention', () => {
    test('保留最近 N 份，其余整目录删除', () => {
        const ids = ['backup-20260901-010101', 'backup-20260902-010101', 'backup-20260903-010101'];
        ids.forEach(id => makeFakeBackup(tmpRoot, id));
        const r = core.applyRetention(tmpRoot, 2);
        expect(r.kept).toEqual(['backup-20260903-010101', 'backup-20260902-010101']);
        expect(r.removed).toEqual(['backup-20260901-010101']);
        expect(fs.existsSync(path.join(tmpRoot, 'backup-20260901-010101'))).toBe(false);
        expect(core.listBackups(tmpRoot)).toHaveLength(2);
    });

    test('份数不足时不删任何东西', () => {
        makeFakeBackup(tmpRoot, 'backup-20260901-010101');
        const r = core.applyRetention(tmpRoot, 14);
        expect(r.removed).toEqual([]);
        expect(r.kept).toHaveLength(1);
    });
});

describe('resolvePgTool', () => {
    test('环境变量 PG_DUMP_PATH 指向存在文件时优先采用', () => {
        const fake = path.join(tmpRoot, 'pg_dump_fake');
        fs.writeFileSync(fake, '');
        process.env.PG_DUMP_PATH = fake;
        expect(core.resolvePgTool('pg_dump')).toBe(fake);
    });

    test('环境变量指向不存在的文件时忽略，继续按 PATH/安装目录查找', () => {
        process.env.PG_DUMP_PATH = path.join(tmpRoot, 'does-not-exist');
        expect(core.resolvePgTool('pg_dump')).not.toBe(path.join(tmpRoot, 'does-not-exist'));
    });

    test('系统中不存在的工具名返回 null（调用方据此给出安装指引）', () => {
        expect(core.resolvePgTool('pg_dump_absent_xyz')).toBeNull();
    });
});
