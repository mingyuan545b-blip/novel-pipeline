/**
 * scripts/killPort.js — 端口占用进程清理工具
 *
 * 根治"旧服务器进程杀不掉"问题：
 * 1. 用 netstat -ano 查找占用端口的PID（不依赖PowerShell）
 * 2. 用 taskkill /F /T /PID 强制杀掉进程树
 * 3. 轮询等待端口释放
 *
 * 用法:
 *   node scripts/killPort.js [port]
 *   const { killPortSync } = require('./killPort');
 */
const { execSync } = require('child_process');
const path = require('path');

const DEFAULT_PORT = 3001;
const MAX_WAIT_MS = 8000;
const POLL_INTERVAL_MS = 200;

/**
 * 查找占用指定端口的所有PID
 * @param {number} port
 * @returns {number[]} PID列表
 */
function findPidsOnPort(port) {
    try {
        const output = execSync(`netstat -ano | findstr ":${port}"`, {
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        const pids = new Set();
        for (const line of output.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            // 只匹配LISTENING状态的行
            if (!trimmed.includes('LISTENING')) continue;
            const parts = trimmed.split(/\s+/);
            const pid = parseInt(parts[parts.length - 1], 10);
            if (pid && pid > 0) pids.add(pid);
        }
        return Array.from(pids);
    } catch (e) {
        // netstat无匹配时findstr返回非0退出码，属正常
        return [];
    }
}

/**
 * 强制杀掉指定PID及其子进程树
 * 优先用taskkill，失败时回退到Node.js process.kill（更可靠）
 * @param {number} pid
 * @returns {boolean} 是否成功
 */
function killPid(pid) {
    // 方案1: taskkill /F /T（杀进程树）
    try {
        execSync(`taskkill /F /T /PID ${pid}`, {
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return true;
    } catch (e) {
        // taskkill可能超时或权限不足，继续尝试方案2
    }

    // 方案2: Node.js process.kill（SIGKILL强制杀）
    try {
        process.kill(pid, 'SIGKILL');
        return true;
    } catch (e) {
        // 进程可能已退出，或权限不足
        return false;
    }
}

/**
 * 检查端口是否仍被占用
 * @param {number} port
 * @returns {boolean}
 */
function isPortInUse(port) {
    return findPidsOnPort(port).length > 0;
}

/**
 * 同步清理端口占用：杀掉所有占用进程并等待释放
 * @param {number} port 端口号
 * @param {object} options { silent: boolean }
 * @returns {{ killed: number[], stillInUse: boolean }}
 */
function killPortSync(port = DEFAULT_PORT, options = {}) {
    const silent = options.silent === true;
    const killed = [];
    const pids = findPidsOnPort(port);

    if (pids.length === 0) {
        if (!silent) console.log(`[killPort] 端口 ${port} 无占用进程`);
        return { killed, stillInUse: false };
    }

    if (!silent) console.log(`[killPort] 端口 ${port} 被占用，PID: ${pids.join(', ')}`);

    for (const pid of pids) {
        const ok = killPid(pid);
        if (ok) {
            killed.push(pid);
            if (!silent) console.log(`[killPort] 已杀掉 PID ${pid}`);
        } else {
            if (!silent) console.log(`[killPort] 杀 PID ${pid} 失败（可能已退出）`);
        }
    }

    // 轮询等待端口释放
    const start = Date.now();
    while (Date.now() - start < MAX_WAIT_MS) {
        if (!isPortInUse(port)) {
            if (!silent) console.log(`[killPort] 端口 ${port} 已释放`);
            return { killed, stillInUse: false };
        }
        // 还有残留就再杀一次
        const remaining = findPidsOnPort(port);
        for (const pid of remaining) killPid(pid);
        const wait = require('util').promisify(setTimeout);
        // 同步等待
        execSync(`ping 127.0.0.1 -n 1 -w ${POLL_INTERVAL_MS} > nul`, { stdio: 'ignore' });
    }

    const stillInUse = isPortInUse(port);
    if (stillInUse && !silent) {
        console.error(`[killPort] 警告: 端口 ${port} 在 ${MAX_WAIT_MS}ms 后仍被占用`);
    }
    return { killed, stillInUse };
}

module.exports = { findPidsOnPort, killPid, isPortInUse, killPortSync, DEFAULT_PORT };

// 直接运行时执行清理
if (require.main === module) {
    const port = parseInt(process.argv[2], 10) || DEFAULT_PORT;
    const result = killPortSync(port);
    process.exit(result.stillInUse ? 1 : 0);
}
