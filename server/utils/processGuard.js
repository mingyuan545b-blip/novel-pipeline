/**
 * processGuard.js — 进程守护机制
 * 启动时检测端口占用，自动杀掉旧进程，避免"幽灵进程"导致新代码不生效
 */
const net = require('net');
const { exec } = require('child_process');
const logger = require('../shared/logger');

const { SERVER_DEFAULTS } = require('../config/systemConfig');

const DEFAULT_PORT = SERVER_DEFAULTS.DEFAULT_PORT;
const GRACE_PERIOD_MS = 3000;

/**
 * 检测端口是否被占用
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port, '127.0.0.1');
    });
}

/**
 * 获取占用端口的进程PID
 * @param {number} port
 * @returns {Promise<number|null>}
 */
function getPidOnPort(port) {
    return new Promise((resolve) => {
        const cmd = `netstat -ano | findstr ":${port} " | findstr "LISTENING"`;
        exec(cmd, { timeout: 5000 }, (err, stdout) => {
            if (err || !stdout.trim()) {
                resolve(null);
                return;
            }
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                const pid = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(pid) && pid > 0) {
                    resolve(pid);
                    return;
                }
            }
            resolve(null);
        });
    });
}

/**
 * 终止指定PID的进程
 * @param {number} pid
 * @returns {Promise<boolean>}
 */
function killProcess(pid) {
    return new Promise((resolve) => {
        exec(`taskkill /PID ${pid} /F`, { timeout: 5000 }, (err) => {
            resolve(!err);
        });
    });
}

/**
 * 等待端口释放
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
function waitForPortFree(port, timeoutMs = GRACE_PERIOD_MS) {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = async () => {
            const inUse = await isPortInUse(port);
            if (!inUse) {
                resolve(true);
                return;
            }
            if (Date.now() - start > timeoutMs) {
                resolve(false);
                return;
            }
            setTimeout(check, 300);
        };
        check();
    });
}

/**
 * 主入口：检测并清理端口占用
 * @param {number} [port=DEFAULT_PORT]
 * @returns {Promise<{cleared: boolean, killedPid: number|null, error: string|null}>}
 */
async function guardPort(port = DEFAULT_PORT) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
        return { cleared: true, killedPid: null, error: null };
    }

    const pid = await getPidOnPort(port);
    if (!pid) {
        return { cleared: false, killedPid: null, error: `Port ${port} in use but PID not found` };
    }

    logger.warn('processGuard', `Port ${port} occupied by PID ${pid}, attempting to terminate...`);
    const killed = await killProcess(pid);
    if (!killed) {
        return { cleared: false, killedPid: pid, error: `Failed to kill PID ${pid}` };
    }

    logger.info('processGuard', `Killed stale process PID ${pid} on port ${port}`);
    const freed = await waitForPortFree(port);
    if (!freed) {
        return { cleared: false, killedPid: pid, error: `Port ${port} still in use after killing PID ${pid}` };
    }

    logger.info('processGuard', `Port ${port} is now free`);
    return { cleared: true, killedPid: pid, error: null };
}

module.exports = { guardPort, isPortInUse, getPidOnPort, killProcess, waitForPortFree };
