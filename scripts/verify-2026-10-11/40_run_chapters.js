'use strict';
/**
 * 40_run_chapters.js <projectId> <start> <end> — 串行驱动 /api/pipeline/full，逐章轮询，写 run.log
 * 自愈：服务端不可达时等待（daemon 已独立存活，通常无需重启）。
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env'), override: true });
const fs = require('fs');
const path = require('path');
const { api, sleep } = require('./_lib');
const LOG = path.join(__dirname, 'run.log');
function log(o) { const s = JSON.stringify({ t: new Date().toISOString(), ...o }); fs.appendFileSync(LOG, s + '\n'); console.log(s); }
async function ping() { try { const r = await api('GET', '/api/health', null, 5000); return r.status === 200; } catch (e) { return false; } }
(async () => {
    const pid = process.argv[2];
    const start = parseInt(process.argv[3] || '1', 10), end = parseInt(process.argv[4] || '10', 10);
    log({ ev: 'run_start', pid, start, end });
    for (let n = start; n <= end; n++) {
        const cl = await api('GET', '/api/chapters?projectId=' + pid);
        const chapters = Array.isArray(cl.data) ? cl.data : (cl.data.chapters || []);
        const ch = chapters.find(c => c.chapterNumber === n);
        if (!ch) { log({ ev: 'missing', ch: n }); continue; }
        if (['material-updated', 'approved', 'second-reviewed'].includes(ch.status) && (ch.content || '').length > 800) { log({ ev: 'skip_done', ch: n, status: ch.status }); continue; }
        let done = false;
        for (let attempt = 1; attempt <= 4 && !done; attempt++) {
            if (!(await ping())) { log({ ev: 'server_down_wait', ch: n }); await sleep(20000); if (!(await ping())) { log({ ev: 'server_unreachable', ch: n }); break; } }
            const t0 = Date.now();
            let launch;
            try { launch = await api('POST', '/api/pipeline/full', { projectId: pid, chapterId: ch.id, maxRounds: 3 }, 60000); }
            catch (e) { log({ ev: 'launch_fail', ch: n, attempt, error: e.code || e.message }); await sleep(10000); continue; }
            const taskId = launch.data && launch.data.taskId;
            if (!taskId) { log({ ev: 'no_task', ch: n, attempt, resp: JSON.stringify(launch.data || {}).substring(0, 200) }); await sleep(15000); continue; }
            log({ ev: 'launched', ch: n, attempt, taskId });
            for (let i = 0; i < 400; i++) {
                await sleep(15000);
                let s; try { s = await api('GET', '/api/pipeline/task/' + taskId); } catch (e) { log({ ev: 'poll_down', ch: n, error: e.code || e.message }); break; }
                const st = s.data && s.data.status;
                if (st === 'completed' || st === 'done' || st === 'failed' || st === 'timeout') {
                    let words = null, st2 = null;
                    try { const c2 = await api('GET', '/api/chapters/' + ch.id); words = (c2.data.content || '').length; st2 = c2.data.status; } catch (e) { /* ignore */ }
                    log({ ev: 'done', ch: n, taskStatus: st, chapterStatus: st2, words, durSec: ((Date.now() - t0) / 1000).toFixed(0), error: s.data.error || null });
                    if (st === 'completed') done = true;
                    break;
                }
            }
            if (!done) log({ ev: 'attempt_incomplete', ch: n, attempt });
        }
        if (!done) log({ ev: 'chapter_giveup', ch: n });
    }
    log({ ev: 'run_end', pid, start, end });
    process.exit(0);
})().catch(e => { log({ ev: 'run_fatal', error: e.message }); process.exit(1); });
