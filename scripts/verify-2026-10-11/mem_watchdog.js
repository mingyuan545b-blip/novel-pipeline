'use strict';
/** mem_watchdog.js — 由 --require 注入：每3s 记录内存到文件，便于与崩溃时序对齐 */
const fs = require('fs');
const path = require('path');
const LOG = path.join(__dirname, 'mem_watchdog.log');
const t0 = Date.now();
setInterval(() => {
    const m = process.memoryUsage();
    try { fs.appendFileSync(LOG, `${new Date().toISOString()} +${((Date.now()-t0)/1000).toFixed(0)}s rss=${(m.rss/1048576).toFixed(0)}MB heap=${(m.heapUsed/1048576).toFixed(0)}MB ext=${(m.external/1048576).toFixed(0)}MB\n`); } catch (_) {}
}, 3000).unref();
