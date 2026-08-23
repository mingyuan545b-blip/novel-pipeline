'use strict';

/**
 * debugFallbackWriter 单元测试（G7）
 *
 * 测试策略：
 * - 使用 os.tmpdir() + 唯一子目录作为测试目录，避免污染项目数据
 * - 每个测试用例独立目录，beforeEach 清理
 * - 验证 NDJSON 格式、文件命名、大小滚动、过期清理、错误处理
 *
 * 文件位置：tests/unit/debugFallbackWriter.test.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    DebugFallbackWriter,
    formatDate,
    FALLBACK_FILE_PREFIX,
    FALLBACK_FILE_EXT
} = require('../../server/shared/debugFallbackWriter');

// 创建唯一临时目录
function makeTmpDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dfw-test-'));
    return dir;
}

// 读取目录下所有 fallback 文件内容
function readFallbackFiles(dir) {
    const files = fs.readdirSync(dir).filter(f => f.startsWith(FALLBACK_FILE_PREFIX));
    return files.map(f => ({
        name: f,
        path: path.join(dir, f),
        content: fs.readFileSync(path.join(dir, f), 'utf8')
    }));
}

// 解析 NDJSON 文件为对象数组
function parseNdjson(content) {
    return content.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

describe('debugFallbackWriter', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = makeTmpDir();
    });

    afterEach(() => {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    describe('formatDate', () => {
        test('格式化日期为 YYYY-MM-DD', () => {
            const d = new Date('2026-06-28T12:00:00.000Z');
            expect(formatDate(d)).toBe('2026-06-28');
        });

        test('补零', () => {
            const d = new Date('2026-01-05T08:03:00.000Z');
            expect(formatDate(d)).toBe('2026-01-05');
        });
    });

    describe('constructor', () => {
        test('dataDir 必填', () => {
            expect(() => new DebugFallbackWriter({})).toThrow('dataDir is required');
            expect(() => new DebugFallbackWriter({ dataDir: null })).toThrow('dataDir is required');
        });

        test('使用默认配置', () => {
            const w = new DebugFallbackWriter({ dataDir: tmpDir });
            const stats = w.getStats();
            expect(stats.dir).toBe(path.join(tmpDir, 'debug-fallback'));
            expect(stats.fileMaxSizeBytes).toBe(10 * 1024 * 1024);
            expect(stats.retentionDays).toBe(7);
        });

        test('支持自定义配置（测试用）', () => {
            const customConfig = {
                FALLBACK_DIR_NAME: 'custom-dir',
                FILE_MAX_SIZE_BYTES: 100,
                RETENTION_DAYS: 3,
                BUFFER_FORCE_FALLBACK_THRESHOLD: 50,
                CLEANUP_INTERVAL_MS: 60000,
                CONSECUTIVE_FAILURES_THRESHOLD: 3
            };
            const w = new DebugFallbackWriter({ dataDir: tmpDir, config: customConfig });
            const stats = w.getStats();
            expect(stats.dir).toBe(path.join(tmpDir, 'custom-dir'));
            expect(stats.fileMaxSizeBytes).toBe(100);
            expect(stats.retentionDays).toBe(3);
        });
    });

    describe('write', () => {
        test('单条写入生成 NDJSON 文件', () => {
            const w = new DebugFallbackWriter({ dataDir: tmpDir });
            const entry = {
                timestamp: '2026-06-28T12:00:00.000Z',
                level: 'error',
                module: 'test-module',
                message: 'test message',
                context: { code: 'TEST_ERR' }
            };
            const ok = w.write('tr-1', entry);
            expect(ok).toBe(true);

            const files = readFallbackFiles(w.getStats().dir);
            expect(files.length).toBe(1);
            const lines = parseNdjson(files[0].content);
            expect(lines.length).toBe(1);
            expect(lines[0].traceId).toBe('tr-1');
            expect(lines[0].level).toBe('error');
            expect(lines[0].module).toBe('test-module');
            expect(lines[0].message).toBe('test message');
            expect(lines[0].context).toEqual({ code: 'TEST_ERR' });
        });

        test('文件命名格式为 fallback-YYYY-MM-DD-0.log', () => {
            const w = new DebugFallbackWriter({ dataDir: tmpDir });
            w.write('tr-1', { level: 'info', module: 'm', message: 'x' });
            const files = readFallbackFiles(w.getStats().dir);
            const today = formatDate(new Date());
            expect(files[0].name).toBe(`${FALLBACK_FILE_PREFIX}-${today}-0${FALLBACK_FILE_EXT}`);
        });

        test('traceId 为空时使用 no-trace', () => {
            const w = new DebugFallbackWriter({ dataDir: tmpDir });
            w.write(null, { level: 'info', module: 'm', message: 'x' });
            const files = readFallbackFiles(w.getStats().dir);
            const lines = parseNdjson(files[0].content);
            expect(lines[0].traceId).toBe('no-trace');
        });

        test('多条件目追加到同一文件', () => {
            const w = new DebugFallbackWriter({ dataDir: tmpDir });
            for (let i = 0; i < 5; i++) {
                w.write(`tr-${i}`, { level: 'info', module: 'm', message: `msg-${i}` });
            }
            const files = readFallbackFiles(w.getStats().dir);
            expect(files.length).toBe(1);
            const lines = parseNdjson(files[0].content);
            expect(lines.length).toBe(5);
        });

        test('统计信息正确更新', () => {
            const w = new DebugFallbackWriter({ dataDir: tmpDir });
            w.write('tr-1', { level: 'info', module: 'm', message: 'x' });
            w.write('tr-2', { level: 'error', module: 'm', message: 'y' });
            const stats = w.getStats();
            expect(stats.totalWritten).toBe(2);
            expect(stats.totalErrors).toBe(0);
            expect(stats.currentSize).toBeGreaterThan(0);
        });
    });

    describe('文件大小滚动', () => {
        test('超过 FILE_MAX_SIZE_BYTES 滚动到新 seq', () => {
            const smallFileConfig = {
                FALLBACK_DIR_NAME: 'debug-fallback',
                FILE_MAX_SIZE_BYTES: 200, // 200 字节，很容易触发
                RETENTION_DAYS: 7,
                BUFFER_FORCE_FALLBACK_THRESHOLD: 1000,
                CLEANUP_INTERVAL_MS: 3600000,
                CONSECUTIVE_FAILURES_THRESHOLD: 5
            };
            const w = new DebugFallbackWriter({ dataDir: tmpDir, config: smallFileConfig });

            // 写入多条直到超过 200 字节
            for (let i = 0; i < 10; i++) {
                w.write(`tr-${i}`, {
                    level: 'info',
                    module: 'm',
                    message: `message-${i}-with-some-padding`
                });
            }

            const files = readFallbackFiles(w.getStats().dir);
            // 应该有多个文件（seq=0, seq=1, ...）
            expect(files.length).toBeGreaterThan(1);
            const stats = w.getStats();
            expect(stats.currentSeq).toBeGreaterThan(0);
        });

        test('滚动后新文件从 0 字节开始', () => {
            const tinyConfig = {
                FALLBACK_DIR_NAME: 'debug-fallback',
                FILE_MAX_SIZE_BYTES: 50,
                RETENTION_DAYS: 7,
                BUFFER_FORCE_FALLBACK_THRESHOLD: 1000,
                CLEANUP_INTERVAL_MS: 3600000,
                CONSECUTIVE_FAILURES_THRESHOLD: 5
            };
            const w = new DebugFallbackWriter({ dataDir: tmpDir, config: tinyConfig });
            // 第一条会超过 50 字节，写入 seq=0
            w.write('tr-1', { level: 'info', module: 'm', message: 'x' });
            // 第二条会触发滚动到 seq=1
            w.write('tr-2', { level: 'info', module: 'm', message: 'x' });
            const stats = w.getStats();
            expect(stats.currentSeq).toBe(1);
            // 新文件 currentSize 应该是第二条的字节数（>0）
            expect(stats.currentSize).toBeGreaterThan(0);
        });
    });

    describe('writeBatch', () => {
        test('批量写入多条', () => {
            const w = new DebugFallbackWriter({ dataDir: tmpDir });
            const batch = [];
            for (let i = 0; i < 10; i++) {
                batch.push({
                    traceId: `tr-${i}`,
                    timestamp: new Date().toISOString(),
                    level: 'info',
                    module: 'm',
                    message: `msg-${i}`,
                    context: null
                });
            }
            const success = w.writeBatch(batch);
            expect(success).toBe(10);
            const stats = w.getStats();
            expect(stats.totalWritten).toBe(10);
        });

        test('空数组返回 0', () => {
            const w = new DebugFallbackWriter({ dataDir: tmpDir });
            expect(w.writeBatch([])).toBe(0);
            expect(w.writeBatch(null)).toBe(0);
        });
    });

    describe('cleanup', () => {
        test('清理过期文件', () => {
            const w = new DebugFallbackWriter({ dataDir: tmpDir });
            const dir = w.getStats().dir;
            fs.mkdirSync(dir, { recursive: true });

            // 创建一个 10 天前的文件
            const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
            const oldName = `${FALLBACK_FILE_PREFIX}-2020-01-01-0${FALLBACK_FILE_EXT}`;
            const oldPath = path.join(dir, oldName);
            fs.writeFileSync(oldPath, '{"test":1}\n');
            // 修改 mtime 为 10 天前
            fs.utimesSync(oldPath, oldDate, oldDate);

            // 创建一个今天的文件
            w.write('tr-fresh', { level: 'info', module: 'm', message: 'fresh' });

            const result = w.cleanup();
            expect(result.removed).toBe(1);
            expect(fs.existsSync(oldPath)).toBe(false);
            // 今天的文件应该保留
            const files = readFallbackFiles(dir);
            expect(files.length).toBe(1);
        });

        test('无文件时返回 removed=0', () => {
            const w = new DebugFallbackWriter({ dataDir: tmpDir });
            // 确保目录存在但为空
            fs.mkdirSync(w.getStats().dir, { recursive: true });
            const result = w.cleanup();
            expect(result.removed).toBe(0);
        });

        test('不清理非 fallback 前缀的文件', () => {
            const w = new DebugFallbackWriter({ dataDir: tmpDir });
            const dir = w.getStats().dir;
            fs.mkdirSync(dir, { recursive: true });
            const otherPath = path.join(dir, 'other-file.log');
            fs.writeFileSync(otherPath, 'x');
            const result = w.cleanup();
            expect(result.removed).toBe(0);
            expect(fs.existsSync(otherPath)).toBe(true);
        });
    });

    describe('错误处理', () => {
        test('目录创建失败时 write 返回 false', () => {
            // 使用一个不可能创建的路径（父目录是文件）
            const filePath = path.join(tmpDir, 'blocker');
            fs.writeFileSync(filePath, 'x');
            const w = new DebugFallbackWriter({ dataDir: filePath });
            const ok = w.write('tr-1', { level: 'info', module: 'm', message: 'x' });
            expect(ok).toBe(false);
            expect(w.getStats().totalErrors).toBeGreaterThan(0);
        });

        test('写入失败不影响后续调用', () => {
            const filePath = path.join(tmpDir, 'blocker');
            fs.writeFileSync(filePath, 'x');
            const w = new DebugFallbackWriter({ dataDir: filePath });
            // 第一次失败
            expect(w.write('tr-1', { level: 'info', module: 'm', message: 'x' })).toBe(false);
            // 切换到有效目录（重新构造）
            const w2 = new DebugFallbackWriter({ dataDir: tmpDir });
            expect(w2.write('tr-2', { level: 'info', module: 'm', message: 'x' })).toBe(true);
        });
    });
});
