/**
 * scripts/serverStart.js — 服务器启动脚本（带端口自动清理）
 *
 * 根治"旧进程未杀掉导致新代码不生效"问题：
 * 1. 启动前自动杀掉占用端口的旧进程
 * 2. 通过PID文件记录当前服务器PID
 * 3. 进程退出时自动清理PID文件
 *
 * 用法:
 *   node scripts/serverStart.js          # 启动（默认从.env读PORT）
 *   node scripts/serverStart.js --stop   # 停止
 *   node scripts/serverStart.js --restart # 重启
 *   node scripts/serverStart.js --status  # 查看状态
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { killPortSync, findPidsOnPort, isPortInUse } = require('./killPort');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const PID_FILE = path.join(PROJECT_ROOT, '.server.pid');
const SERVER_ENTRY = path.join(PROJECT_ROOT, 'server', 'index.js');

// 加载.env获取PORT
function loadPort() {
    if (fs.existsSync(ENV_PATH)) {
        require('dotenv').config({ path: ENV_PATH, override: true }); // .env唯一事实源，同server/index.js
    }
    return parseInt(process.env.PORT, 10) || 3001;
}

// 读取PID文件
function readPidFile() {
    try {
        if (fs.existsSync(PID_FILE)) {
            const content = fs.readFileSync(PID_FILE, 'utf8').trim();
            return parseInt(content, 10) || null;
        }
    } catch (e) { /* ignore */ }
    return null;
}

// 写入PID文件
function writePidFile(pid) {
    fs.writeFileSync(PID_FILE, String(pid), 'utf8');
}

// 删除PID文件
function removePidFile() {
    try { fs.unlinkSync(PID_FILE); } catch (e) { /* ignore */ }
}

// 检查PID是否存活
function isPidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

// 停止服务器
function stopServer(port) {
    console.log('[serverStart] 停止服务器...');
    let stopped = false;

    // 1. 先通过PID文件杀（优先SIGTERM优雅关闭，失败则SIGKILL）
    const pid = readPidFile();
    if (pid && isPidAlive(pid)) {
        console.log(`[serverStart] 通过PID文件停止 PID ${pid}`);
        try {
            process.kill(pid, 'SIGTERM');
            stopped = true;
        } catch (e) {
            try {
                process.kill(pid, 'SIGKILL');
                stopped = true;
            } catch (e2) { /* ignore */ }
        }
    }

    // 2. 强制清理端口（兜底，处理PID文件缺失或进程不匹配的情况）
    const result = killPortSync(port);
    if (result.killed.length > 0) stopped = true;

    removePidFile();

    if (stopped) {
        console.log('[serverStart] 服务器已停止');
    } else {
        console.log('[serverStart] 未发现运行中的服务器');
    }
    return stopped;
}

// 查看状态
function statusServer(port) {
    const pid = readPidFile();
    const portInUse = isPortInUse(port);
    const pids = findPidsOnPort(port);

    console.log('[serverStart] 服务器状态:');
    console.log(`  端口 ${port}: ${portInUse ? '占用' : '空闲'}`);
    console.log(`  PID文件: ${pid || '无'}`);
    console.log(`  占用PID: ${pids.join(', ') || '无'}`);

    if (pid && isPidAlive(pid)) {
        console.log(`  状态: 运行中 (PID ${pid})`);
    } else if (portInUse) {
        console.log('  状态: 端口被占但PID文件缺失或进程不匹配（可能是僵尸进程）');
    } else {
        console.log('  状态: 未运行');
    }
}

// 启动服务器
function startServer(port) {
    console.log(`[serverStart] 启动服务器 (端口 ${port})...`);

    // 1. 清理端口（根治旧进程问题）
    const killResult = killPortSync(port);
    if (killResult.stillInUse) {
        console.error('[serverStart] 错误: 端口仍被占用，无法启动');
        process.exit(1);
    }

    // 2. 清理旧PID文件
    removePidFile();

    // 3. 启动服务器子进程（堆内存12GB，避免大量entity dedup + LLM调用导致OOM）
    // 陷阱#75：8GB堆内存在 postApproval 链路（material-organizer+registrar+knowledge-extraction）时OOM崩溃
    const child = spawn(process.execPath, [
        '--max-old-space-size=12288',
        '--max-semi-space-size=256',
        '--trace-gc',
        // 崩溃转储：CLI 兜底（JS 层 crashDump.initCrashDump 之前若崩，也留证）+ 提高 JS 栈上限便于定位深递归
        '--report-on-fatalerror',
        '--report-compact',
        '--stack-trace-limit=50',
        SERVER_ENTRY
    ], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        env: { ...process.env, NODE_PATH: path.join(PROJECT_ROOT, 'server') }
    });

    // 4. 记录PID
    writePidFile(child.pid);
    console.log(`[serverStart] 服务器已启动, PID ${child.pid}, PID文件已写入 ${PID_FILE}`);

    // 5. 子进程退出时清理PID文件
    child.on('exit', (code, signal) => {
        removePidFile();
        console.log(`[serverStart] 服务器进程退出 (code=${code}, signal=${signal})`);
        process.exit(code || 0);
    });

    // 6. 主进程收到信号时转发给子进程
    ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig => {
        process.on(sig, () => {
            if (!child.killed) child.kill(sig);
        });
    });
}

// 主入口
const port = loadPort();
const command = process.argv[2] || '--start';

switch (command) {
    case '--stop':
        stopServer(port);
        break;
    case '--restart':
        stopServer(port);
        // 短暂等待端口完全释放
        setTimeout(() => startServer(port), 500);
        break;
    case '--status':
        statusServer(port);
        break;
    case '--start':
    default:
        startServer(port);
        break;
}
