'use strict';
/** exp_orphan_stdout.js — 复现机制：以 stdio:'pipe' 启动服务器且父进程【不读取】stdout，观察内存 */
const { spawn } = require('child_process');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const child = spawn(process.execPath, [
  '--max-old-space-size=2048', '--trace-gc',
  path.join(ROOT, 'server', 'index.js')
], { cwd: ROOT, env: { ...process.env, NODE_PATH: path.join(ROOT, 'server') }, stdio: ['ignore', 'pipe', 'pipe'] });
// 关键：故意不读 child.stdout / child.stderr（模拟"读者消失"）
console.log('spawned pid', child.pid, '（stdout 故意不读）');
const t0 = Date.now();
const timer = setInterval(() => {
  // 无法直接读子进程内存；用 pid 通过 tasklist 不可用 -> 用子进程自身报告不可行
  // 改为观察子进程是否还活着 + 粗略计时
  console.log(`+${((Date.now()-t0)/1000).toFixed(0)}s alive=${child.exitCode === null && !child.killed}`);
}, 5000);
child.on('exit', (code, sig) => { console.log('child EXIT code=', code, 'sig=', sig, 'after', ((Date.now()-t0)/1000).toFixed(0)+'s'); clearInterval(timer); process.exit(0); });
