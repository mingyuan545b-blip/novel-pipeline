'use strict';
/** probe_outline.js <projectId> — 隔离复现大纲生成，2s 一次内存遥测定位膨胀阶段 */
process.env.NODE_PATH = require('path').join(__dirname, '..', '..', 'server');
require('module').Module._initPaths();
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env'), override: true });
const pid = process.argv[2];
function mb() { const m = process.memoryUsage(); return { rss: (m.rss/1048576).toFixed(0), heap: (m.heapUsed/1048576).toFixed(0), ext: (m.external/1048576).toFixed(0) }; }
let last = '';
const t = setInterval(() => {
    const m = mb();
    const line = `rss=${m.rss}MB heap=${m.heap}MB ext=${m.ext}MB`;
    if (line !== last) { console.log(`[mem ${((Date.now()-t0)/1000).toFixed(0)}s] ${line}`); last = line; }
}, 2000);
const t0 = Date.now();
(async () => {
    console.log('[probe] projectId =', pid);
    const store = require('../../server/store');
    const pipeline = require('../../server/services/pipeline');
    console.log('[probe] 依赖加载完成', mb());
    console.log('[probe] 调用 generateChapterOutlines(scope=far)...');
    const r = await pipeline.generateChapterOutlines(pid, '', 10);
    console.log('[probe] 完成 count=', r.count, 'error=', r.error || '-', mb());
    clearInterval(t);
    process.exit(0);
})().catch(e => { console.error('[probe] FATAL', e.message); clearInterval(t); process.exit(1); });
