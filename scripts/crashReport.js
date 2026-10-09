/**
 * scripts/crashReport.js — 读取崩溃转储摘要（配合 server/bootstrap/crashDump.js）
 *
 * 用法：
 *   node scripts/crashReport.js            # 打印最新一份报告摘要
 *   node scripts/crashReport.js --list     # 列出全部报告
 *   node scripts/crashReport.js --latest --stack 20   # 多打几帧原生栈
 *
 * 价值：0xC0000409 类原生崩溃过去"无 JS 栈"，本脚本把诊断报告里最关键的三样东西
 * （触发事件 / JS 栈 / 原生栈）抠出来，直接可用于定位触发点。
 */
const fs = require('fs');
const path = require('path');

const DUMP_DIR = path.resolve(__dirname, '..', 'data', 'crash-dumps');

function listReports() {
    if (!fs.existsSync(DUMP_DIR)) return [];
    return fs.readdirSync(DUMP_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
            const full = path.join(DUMP_DIR, f);
            const st = fs.statSync(full);
            return { file: full, mtime: st.mtimeMs, size: st.size };
        })
        .sort((a, b) => b.mtime - a.mtime);
}

function printFrames(stack, limit) {
    if (!stack) return;
    const lines = String(stack).split('\n');
    for (const line of lines.slice(0, limit)) console.log('   ' + line.trim());
    if (lines.length > limit) console.log(`   ...（共 ${lines.length} 行，用 --stack N 调整）`);
}

function summarize(file) {
    const report = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log('===== 崩溃转储摘要 =====');
    console.log('文件      :', file);
    console.log('体积      :', (fs.statSync(file).size / 1024).toFixed(1), 'KB');
    console.log('触发事件  :', report.header?.event || '(未知)');
    console.log('触发理由  :', report.header?.trigger || report.header?.commandLine?.join(' ') || '-');
    console.log('Node 版本 :', report.header?.nodejsVersion || '-');
    console.log('PID/时间  :', report.header?.processId, '/', report.header?.reportVersion || '');

    const ru = report.resourceUsage || {};
    const mb = (v) => (typeof v === 'number' ? (v / 1024 / 1024).toFixed(0) + 'MB' : '?');
    console.log('内存      : rss=%s maxRss=%s 系统空闲=%s',
        mb(ru.rss), mb(ru.maxRss), mb(ru.free_memory));
    console.log('Libuv句柄 :', Array.isArray(report.libuv) ? report.libuv.length : '-');

    const js = report.javascriptStack;
    if (js) {
        console.log('--- JS 栈 ---');
        console.log('   message:', js.message);
        printFrames(js.stack, 12);
    } else {
        console.log('--- JS 栈 --- (无：原生崩溃，正是本次要抓的证据)');
    }

    const native = report.nativeStack;
    if (native && native.length) {
        console.log('--- 原生栈（关键！）---');
        const limit = NUMBER || 16;
        native.slice(0, limit).forEach((frame, i) => {
            console.log(`   #${i} ${frame.symbol || '(no symbol)'}  ${frame.file || ''}:${frame.line || ''}`);
        });
        if (native.length > limit) console.log(`   ...（共 ${native.length} 帧，用 --stack N 调整）`);
    }
}

const NUMBER = (() => {
    const i = process.argv.indexOf('--stack');
    return i >= 0 ? parseInt(process.argv[i + 1], 10) || 16 : 16;
})();

const reports = listReports();
if (reports.length === 0) {
    console.log('[crashReport] 暂无转储。目录：', DUMP_DIR);
    console.log('提示：转储在后端下次原生崩溃/未捕获异常时自动生成。');
    process.exit(0);
}

if (process.argv.includes('--list')) {
    console.log('[crashReport] 共', reports.length, '份：');
    for (const r of reports) console.log('  ', new Date(r.mtime).toLocaleString(), (r.size / 1024).toFixed(1) + 'KB', r.file);
    process.exit(0);
}

summarize(reports[0].file);
