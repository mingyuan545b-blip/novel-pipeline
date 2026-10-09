/**
 * scripts/stressTest.js — 并发压测（复现/定位后端偶发原生崩溃 0xC0000409）
 *
 * 背景：后端在 pipeline 重负载 + 前端轮询下偶发原生崩溃（陷阱#34 同族，无 JS 栈）。
 * 本脚本用可控并发反复冲击历史嫌疑路径（/api/health 的并发 Promise.all 一带），
 * 目标是**稳定复现**，配合 server/bootstrap/crashDump.js 的转储定位触发点。
 *
 * 用法：
 *   node scripts/stressTest.js --project <id> --concurrency 32 --rounds 50 --mode mixed
 *   node scripts/stressTest.js --mode health --concurrency 64 --rounds 30
 * 参数：
 *   --mode        health(只打 /api/health) | mixed(默认：轮询一组只读端点+health)
 *   --concurrency 并发数（默认 16）
 *   --rounds      每并发的轮数（默认 40）
 *   --project     项目 id（mixed 模式下带 project 端点需要）
 * 退出码：0=全部成功；2=检测到后端进程崩溃（疑似复现）；1=参数/环境错误
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: true });
const PORT = parseInt(process.env.PORT, 10) || 3001;
const SECRET = process.env.REQUEST_SECRET || '';
const DUMP_DIR = path.resolve(__dirname, '..', 'data', 'crash-dumps');

function arg(name, def) {
    const i = process.argv.indexOf('--' + name);
    return i >= 0 ? process.argv[i + 1] : def;
}

const MODE = arg('mode', 'mixed');
const CONCURRENCY = parseInt(arg('concurrency', '16'), 10);
const ROUNDS = parseInt(arg('rounds', '40'), 10);
const PROJECT = arg('project', '');

function mixedPaths() {
    const pid = PROJECT;
    const list = ['/api/health', '/api/settings', '/api/library/stats'];
    if (pid) {
        list.push(
            '/api/projects/' + pid,
            '/api/chapters?projectId=' + pid,
            '/api/materials?projectId=' + pid,
            '/api/entity-center/entities?projectId=' + pid,
            '/api/knowledge/facts/' + pid,
            '/api/pipeline/worldscope/' + pid,
            '/api/quests/quests?projectId=' + pid,
            '/api/pipeline/infinite/status'
        );
    }
    return list;
}
const PATHS = MODE === 'health' ? ['/api/health'] : mixedPaths();

function hit(p) {
    return new Promise((resolve) => {
        const t0 = Date.now();
        const req = http.request({
            hostname: 'localhost', port: PORT, path: p, method: 'GET',
            headers: { Authorization: 'Bearer ' + SECRET },
            timeout: 30000,
        }, (res) => {
            res.resume();
            res.on('end', () => resolve({
                ok: res.statusCode < 500,
                limited: res.statusCode === 429,
                status: res.statusCode,
                ms: Date.now() - t0,
                code: res.statusCode >= 500 ? 'HTTP' + res.statusCode : null,
            }));
        });
        req.on('error', (e) => resolve({ ok: false, status: 0, ms: Date.now() - t0, code: e.code || e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, ms: Date.now() - t0, code: 'timeout' }); });
        req.end();
    });
}

function latestDump() {
    try {
        const files = fs.readdirSync(DUMP_DIR).filter((f) => f.endsWith('.json'));
        if (!files.length) return null;
        return files.map((f) => ({ f, m: fs.statSync(path.join(DUMP_DIR, f)).mtimeMs })).sort((a, b) => b.m - a.m)[0].f;
    } catch (e) { return null; }
}

const CRASH_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'EHOSTUNREACH']);

(async () => {
    if (!fs.existsSync(DUMP_DIR)) fs.mkdirSync(DUMP_DIR, { recursive: true });

    // 预检：确认后端在跑，否则 ECONNREFUSED 会被误判为"崩溃"
    const pre = await hit('/api/health');
    if (!pre.ok && CRASH_CODES.has(pre.code)) {
        console.error(`[stress] ❌ 后端未运行（/api/health → ${pre.code}）。先执行 npm start，再压测。`);
        process.exit(1);
    }
    console.log(`[stress] 预检通过：/api/health → ${pre.status}${pre.limited ? '（注意：已在限流窗口内）' : ''}`);

    const total = CONCURRENCY * ROUNDS;
    console.log(`[stress] 目标 http://localhost:${PORT} mode=${MODE} 并发=${CONCURRENCY} 轮=${ROUNDS} 总请求≈${total}`);
    if (MODE === 'mixed' && !PROJECT) console.log('[stress] 未提供 --project：mixed 模式将跳过带 project 的端点');

    const started = Date.now();
    const stats = { ok: 0, fail: 0, limited: 0, codes: {}, lat: [] };
    let crashed = false;

    async function worker(id) {
        for (let r = 0; r < ROUNDS && !crashed; r++) {
            const p = PATHS[(id + r) % PATHS.length];
            const res = await hit(p);
            if (res.limited) stats.limited++;
            if (res.ok) { stats.ok++; stats.lat.push(res.ms); continue; }
            stats.fail++;
            stats.codes[res.code] = (stats.codes[res.code] || 0) + 1;
            if (CRASH_CODES.has(res.code)) {
                crashed = true;
                console.error(`[stress] ⛔ 后端疑似崩溃：${p} → ${res.code}（worker#${id} round#${r}）`);
                break;
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    const lat = stats.lat.sort((a, b) => a - b);
    const pct = (q) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * q))] : 0);
    console.log(`[stress] 完成 ${secs}s | ok=${stats.ok} fail=${stats.fail} | 延迟 p50=${pct(0.5)}ms p95=${pct(0.95)}ms max=${lat[lat.length - 1] || 0}ms`);
    if (stats.limited) console.log(`[stress] ⚠️ 429 限流 ${stats.limited} 次（express-rate-limit 生效，实际压力被削弱；复现崩溃需更大并发或临时放宽限流）`);
    if (Object.keys(stats.codes).length) console.log('[stress] 失败分类:', JSON.stringify(stats.codes));

    if (crashed) {
        const dump = latestDump();
        console.log('[stress] 后端进程崩溃。若有新转储：', dump ? path.join(DUMP_DIR, dump) : '(暂无，检查是否在崩溃前已退出)');
        console.log('[stress] 读取转储：node scripts/crashReport.js --latest --stack 24');
        process.exit(2);
    }
    console.log('[stress] 未检测到崩溃。若仍偶发，可提高 --concurrency/--rounds 或换 --mode health 复压。');
})().catch((e) => { console.error('[stress] FATAL', e.stack); process.exit(1); });
