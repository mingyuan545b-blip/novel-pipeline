'use strict';

/**
 * crashDump — 崩溃转储（Node 诊断报告 process.report）
 *
 * 背景（2026-10-09 跨界副本博弈建项实测）：后端在 pipeline 重负载 + 前端轮询下偶发原生崩溃退出
 * （code=3221226505 = 0xC0000409 STATUS_STACK_BUFFER_OVERRUN，陷阱#34 同族），三次均**无 JS 栈**，
 * 触发点至今未定位。原生致命错误不经过 JS 异常链，唯一可靠的留证方式就是 Node 诊断报告
 * （含原生栈、libuv handle 数、内存/资源占用、加载模块），故在此集中开启。
 *
 * 报告落盘：data/crash-dumps/（运行时产物，已 gitignore）；人工读取用
 *   node scripts/crashReport.js --latest
 *
 * 与陷阱#34（health 端点 Promise.all 分批 chunk）互补：那条治"已知触发路径"，
 * 本模块负责"下次再崩时留下证据"。
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DUMP_DIR = path.join(PROJECT_ROOT, 'data', 'crash-dumps');

let initialized = false;

function ensureDumpDir() {
    if (!fs.existsSync(DUMP_DIR)) fs.mkdirSync(DUMP_DIR, { recursive: true });
    return DUMP_DIR;
}

/** 同步写一份诊断报告，返回文件路径（失败返回 null，绝不抛错——崩溃路径上不能二次崩溃） */
function writeReportSync() {
    try {
        ensureDumpDir();
        // 幂等设定目录：即使调用方未先 initCrashDump，也不要把报告写到 cwd（曾因此污染仓库根目录）
        process.report.directory = DUMP_DIR;
        // writeReport() 返回的是文件名（非绝对路径），此处补全为绝对路径，便于调用方直接读写
        const name = process.report.writeReport();
        return path.isAbsolute(name) ? name : path.join(DUMP_DIR, name);
    } catch (e) {
        return null;
    }
}

/**
 * 初始化崩溃转储。必须在进程尽可能早的位置调用（见 server/index.js 顶部）。
 * @param {{logger?: {info:Function, warn:Function, error:Function}}} [deps]
 */
function initCrashDump(deps = {}) {
    if (initialized) return;
    initialized = true;
    const logger = deps.logger || null;
    const log = (msg) => (logger ? logger.warn('crashDump', msg) : console.error(msg));

    try {
        ensureDumpDir();
        process.report.directory = DUMP_DIR;
        process.report.compact = true;
        // 核心：原生致命错误（OOM / C++ abort / 栈缓冲溢出）也生成报告——这是 0xC0000409 的唯一留证通道
        process.report.reportOnFatalError = true;
        // 信号不自动转储：避免每次优雅停机（SIGTERM）都产报告
        process.report.reportOnSignal = false;
        // 不交给 Node 自动兜底，改由下方 handler 统一处理（避免同一异常产两份报告）
        process.report.reportOnUncaughtException = false;
    } catch (e) {
        log(`[CRASH] process.report 配置失败：${e.message}`);
    }

    // JS 层未捕获异常（含 Node 24 默认把 unhandledRejection 抛成的 uncaughtException）：
    // 落转储 + 人类可读栈，然后保持原始"退出码 1"语义，不吞崩溃。
    process.on('uncaughtException', (err) => {
        const file = writeReportSync();
        const stack = err && err.stack ? err.stack : String(err);
        log(`[CRASH] uncaughtException: ${err && err.message}\n${stack}`);
        log(`[CRASH] 诊断报告：${file || '(writeReport 失败)'}`);
        process.exit(1);
    });

    log(`[CRASH] 崩溃转储已开启 → ${DUMP_DIR}（原生致命错误亦留证，见陷阱#34）`);
}

module.exports = { initCrashDump, writeReportSync, DUMP_DIR };
