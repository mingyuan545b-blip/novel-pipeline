/**
 * crashDump.test.js — 崩溃转储模块（process.report）回归测试
 * 依据：docs/worklog/2026-10-09 问题#2（原生崩溃 0xC0000409 无 JS 栈，需诊断报告留证）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const crashDump = require('../../server/bootstrap/crashDump');

describe('crashDump：转储目录与写入', () => {
    test('DUMP_DIR 落在项目 data/crash-dumps 下', () => {
        expect(crashDump.DUMP_DIR).toBe(path.join(ROOT, 'data', 'crash-dumps'));
    });

    test('writeReportSync 能写出 JSON 报告并返回路径（不抛错）', () => {
        const file = crashDump.writeReportSync();
        expect(typeof file).toBe('string');
        expect(fs.existsSync(file)).toBe(true);
        const report = JSON.parse(fs.readFileSync(file, 'utf8'));
        expect(report.header).toBeTruthy();
        expect(report.header.nodejsVersion).toBe(process.version);
    });
});

describe('crashDump：initCrashDump 配置 process.report', () => {
    test('开启原生致命错误转储、关闭信号转储（避免停机产报告）', () => {
        const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        crashDump.initCrashDump({ logger });
        expect(process.report.reportOnFatalError).toBe(true);
        expect(process.report.reportOnSignal).toBe(false);
        expect(process.report.reportOnUncaughtException).toBe(false);
        expect(process.report.directory).toBe(crashDump.DUMP_DIR);
        expect(process.report.compact).toBe(true);
    });

    test('注册了 uncaughtException 处理器（保留退出语义 + 先落转储）', () => {
        crashDump.initCrashDump({ logger: null });
        const listeners = process.listeners('uncaughtException');
        expect(listeners.length).toBeGreaterThan(0);
    });
});
