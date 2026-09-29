'use strict';

/**
 * pgBackup — PostgreSQL 备份 / 校验 / 恢复演练 CLI
 *
 * 背景：2026-09-30 外部评审指出"1700 章、1.7 亿 token 的成果零备份"。
 * 本脚本是该风险的对策：备份 + 保留策略 + 可验证的恢复演练。
 *
 * 用法：
 *   node scripts/pgBackup.js                     # 备份 + 保留策略（默认保留 14 份）
 *   node scripts/pgBackup.js --dry-run           # 只体检环境与目标，不落盘
 *   node scripts/pgBackup.js --keep 30           # 自定义保留份数
 *   node scripts/pgBackup.js --out D:/pgbak      # 自定义输出目录（建议落到另一块盘）
 *   node scripts/pgBackup.js --list              # 列出已有备份与完整性
 *   node scripts/pgBackup.js --verify [id]       # 校验（默认最新一份）：存在性/大小/sha256
 *   node scripts/pgBackup.js --restore-test [id] # 恢复演练：建临时库→恢复→比对行数→删临时库
 *
 * 退出码：0=成功，1=失败（CI / 计划任务据此告警）
 * 文件位置：scripts/pgBackup.js
 */

require('dotenv').config({ override: true });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const core = require('./lib/pgBackupCore');

const ROOT = path.resolve(__dirname, '..');
const BACKUP_DEFAULTS = {
    OUT_DIR: path.join(ROOT, 'backups', 'pg'),
    KEEP: 14,
    RESTORE_TEST_DB: 'novel_pipeline_restore_check',
    ADMIN_DB: 'postgres',
};

function log(msg) { console.log('[PG-BACKUP] ' + msg); }
function fail(msg) { console.error('[PG-BACKUP] ERROR: ' + msg); process.exit(1); }

function parseArgs(argv) {
    const opts = { outDir: BACKUP_DEFAULTS.OUT_DIR, keep: BACKUP_DEFAULTS.KEEP, id: null };
    const nextVal = (i) => (argv[i + 1] && argv[i + 1].indexOf('--') !== 0 ? argv[i + 1] : null);
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dry-run') opts.dryRun = true;
        else if (a === '--list') opts.list = true;
        else if (a === '--verify') { opts.verify = true; opts.id = nextVal(i); if (opts.id) i++; }
        else if (a === '--restore-test') { opts.restoreTest = true; opts.id = nextVal(i); if (opts.id) i++; }
        else if (a === '--keep') opts.keep = Number(argv[++i]);
        else if (a === '--out') opts.outDir = path.resolve(argv[++i]);
        else if (a === '--help' || a === '-h') opts.help = true;
        else fail('未知参数: ' + a + '（用 --help 查看用法）');
    }
    return opts;
}

function printHelp() {
    console.log('用法: node scripts/pgBackup.js [--dry-run|--list|--verify [id]|--restore-test [id]] [--keep N] [--out DIR]');
}

function connectString() {
    const cs = process.env.DATABASE_URL;
    if (!cs) fail('未配置 DATABASE_URL（见项目根目录 .env）');
    return cs;
}

/** 用连接参数拼出目标库的连接串（口令已解码，需重新编码） */
function buildConnString(conn, dbName, overrideDb) {
    const db = overrideDb || conn.database;
    return 'postgresql://' +
        (conn.user ? encodeURIComponent(conn.user) : '') +
        (conn.password ? ':' + encodeURIComponent(conn.password) : '') +
        '@' + conn.host + ':' + conn.port + '/' + db;
}

/** 以管理员身份连到 postgres 库执行建/删库（不能对备份库自身执行 DROP） */
async function withAdminClient(conn, fn) {
    const client = new Client({ connectionString: buildConnString(conn, null, BACKUP_DEFAULTS.ADMIN_DB) });
    await client.connect();
    try { return await fn(client); } finally { await client.end().catch(() => { /* 忽略关闭异常 */ }); }
}

async function cmdBackup(opts) {
    const pgDump = core.resolvePgTool('pg_dump');
    if (!pgDump) fail('未找到 pg_dump。请安装 PostgreSQL 客户端，或设环境变量 PG_DUMP_PATH 指向 pg_dump');
    const cs = connectString();
    const conn = core.parseConn(cs);
    log('pg_dump: ' + pgDump);
    log('目标库: ' + conn.database + ' @ ' + conn.host + ':' + conn.port);
    log('输出目录: ' + opts.outDir);

    if (opts.dryRun) { log('--dry-run：环境检查通过，未执行备份'); return 0; }

    const id = core.makeBackupId();
    const dir = path.join(opts.outDir, id);
    const outFile = path.join(dir, core.DUMP_NAME);
    const startedAt = Date.now();

    const tables = await core.listPublicTables(cs);
    const tableCounts = await core.collectTableCounts(cs, tables);
    log('采集到 ' + tables.length + ' 张表的行数基线');

    log('开始导出 → ' + outFile);
    const r = core.runDump({ pgDumpPath: pgDump, conn, outFile });
    if (!r.ok) fail('pg_dump 失败: ' + (r.stderr || r.signal || '未知原因'));

    core.writeManifest(dir, {
        id,
        createdAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        database: conn.database,
        host: conn.host,
        port: conn.port,
        pgDump,
        dumpFile: core.DUMP_NAME,
        bytes: r.bytes,
        sha256: core.sha256File(outFile),
        tableCount: tables.length,
        tableCounts,
    });

    log('备份完成: ' + id + '（' + (r.bytes / 1048576).toFixed(2) + ' MB, ' +
        ((Date.now() - startedAt) / 1000).toFixed(1) + 's）');
    const ret = core.applyRetention(opts.outDir, opts.keep);
    log('保留策略: 保留 ' + ret.kept.length + ' 份，清理 ' + ret.removed.length + ' 份');
    if (ret.removed.length) log('已清理: ' + ret.removed.join(', '));
    return 0;
}

function cmdList(opts) {
    const all = core.listBackups(opts.outDir);
    if (!all.length) { log('（无备份）目录: ' + opts.outDir); return 0; }
    log('共 ' + all.length + ' 份备份（新的在前）:');
    for (const b of all) {
        const m = b.manifest;
        if (!m) { log('  ' + b.id + '  [无效：缺 manifest]'); continue; }
        log('  ' + b.id + '  ' + (m.bytes / 1048576).toFixed(2) + ' MB  ' +
            m.tableCount + ' 表  ' + m.createdAt);
    }
    return 0;
}

function pickBackup(opts) {
    const all = core.listBackups(opts.outDir);
    if (!all.length) fail('无备份可校验（目录: ' + opts.outDir + '）');
    if (opts.id) {
        const hit = all.filter(b => b.id === opts.id)[0];
        if (!hit) fail('找不到备份: ' + opts.id);
        return hit;
    }
    return all[0];
}

function cmdVerify(opts) {
    const b = pickBackup(opts);
    if (!b.manifest) fail('备份 ' + b.id + ' 缺 manifest，无法校验');
    const dumpFile = path.join(b.dir, b.manifest.dumpFile || core.DUMP_NAME);
    if (!fs.existsSync(dumpFile)) fail('dump 文件不存在: ' + dumpFile);
    const bytes = fs.statSync(dumpFile).size;
    if (bytes !== b.manifest.bytes) fail('大小不符：期望 ' + b.manifest.bytes + '，实际 ' + bytes);
    const sha = core.sha256File(dumpFile);
    if (sha !== b.manifest.sha256) fail('sha256 不符（文件可能损坏）: ' + sha);
    log('校验通过: ' + b.id + '（' + (bytes / 1048576).toFixed(2) + ' MB, sha256 ' + sha.slice(0, 12) + '...）');
    return 0;
}

async function cmdRestoreTest(opts) {
    const b = pickBackup(opts);
    if (!b.manifest) fail('备份 ' + b.id + ' 缺 manifest，无法演练');
    const pgRestore = core.resolvePgTool('pg_restore');
    if (!pgRestore) fail('未找到 pg_restore。请设环境变量 PG_RESTORE_PATH');
    const conn = core.parseConn(connectString());
    const dumpFile = path.join(b.dir, b.manifest.dumpFile || core.DUMP_NAME);
    const target = BACKUP_DEFAULTS.RESTORE_TEST_DB;
    const targetCs = buildConnString(conn, null, target);

    log('恢复演练: ' + b.id + ' → 临时库 ' + target);
    await withAdminClient(conn, async (c) => {
        await c.query('DROP DATABASE IF EXISTS "' + target + '" WITH (FORCE)');
        await c.query('CREATE DATABASE "' + target + '"');
    });
    try {
        const r = core.runRestore({ pgRestorePath: pgRestore, conn, dumpFile, targetDb: target });
        if (!r.ok) fail('pg_restore 失败: ' + (r.stderr || '未知原因'));
        const tables = await core.listPublicTables(targetCs);
        const restored = await core.collectTableCounts(targetCs, tables);
        const expected = b.manifest.tableCounts || {};
        const mismatch = Object.keys(expected).filter(t => restored[t] !== expected[t]);
        if (mismatch.length) {
            fail('恢复后行数不符: ' + mismatch.map(t => t + '(' + expected[t] + ' vs ' + restored[t] + ')').join(', '));
        }
        log('演练通过: ' + tables.length + ' 张表行数与备份时完全一致');
    } finally {
        await withAdminClient(conn, async (c) => {
            await c.query('DROP DATABASE IF EXISTS "' + target + '" WITH (FORCE)');
        }).catch(() => log('警告：临时库清理失败，请手动删除 ' + target));
    }
    return 0;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) { printHelp(); return 0; }
    if (opts.list) return cmdList(opts);
    if (opts.verify) return cmdVerify(opts);
    if (opts.restoreTest) return await cmdRestoreTest(opts);
    return await cmdBackup(opts);
}

main().then(code => process.exit(code)).catch(e => fail(e.message));
