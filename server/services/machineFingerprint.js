'use strict';

/**
 * machineFingerprint.js — 稳定机器指纹
 *
 * 背景（历史缺陷）：原实现用 `hostname + CPU型号 + os.totalmem()` 哈希机器码，
 * 内存条一升级/更换（甚至系统报告内存容量变化）就会让已激活许可证判定为
 * "Machine mismatch" → 会员降级为免费版 → 整个 /api/pipeline 被 requireFeature 拦成 403。
 * 实测：同一台机器 2026-09-18 激活的许可证在 2026-09-26 因内存变化失效。
 *
 * 策略：优先读取操作系统安装时生成、不随硬件升级变化的 machine-id；
 * 读不到时才退回"主机名 + CPU型号 + 架构"（注意：**禁止纳入内存容量**）。
 *
 * 文件位置：server/services/machineFingerprint.js
 */

const fs = require('fs');
const crypto = require('crypto');

/** 指纹缓存：checkMembership 每次请求都会调用，避免重复读注册表/文件 */
let _cache = null;

/** Windows MachineGuid（系统安装时生成，硬件升级不变） */
function _readWindowsGuid() {
    const { execFileSync } = require('child_process');
    const out = execFileSync(
        'reg',
        ['query', String.raw`HKLM\SOFTWARE\Microsoft\Cryptography`, '/v', 'MachineGuid'],
        { encoding: 'utf-8', timeout: 3000, windowsHide: true }
    );
    const m = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
    return m ? m[1] : null;
}

/** macOS IOPlatformUUID */
function _readMacUuid() {
    const { execFileSync } = require('child_process');
    const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf-8', timeout: 3000 });
    const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
    return m ? m[1] : null;
}

/** Linux /etc/machine-id */
function _readLinuxMachineId() {
    for (const p of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
        try {
            if (fs.existsSync(p)) {
                const v = fs.readFileSync(p, 'utf-8').trim();
                if (v) return v;
            }
        } catch { /* 尝试下一个来源 */ }
    }
    return null;
}

/** 读取 OS 级稳定标识；失败返回 null（由调用方退回兜底指纹） */
function readOsMachineId() {
    try {
        if (process.platform === 'win32') return _readWindowsGuid();
        if (process.platform === 'darwin') return _readMacUuid();
        return _readLinuxMachineId();
    } catch {
        return null;
    }
}

/** 兜底指纹来源：主机名 + CPU型号 + 架构（不含内存容量） */
function buildFallbackSource() {
    const os = require('os');
    const cpus = os.cpus() || [];
    const cpuModel = cpus[0] ? cpus[0].model : 'unknown';
    return `${os.hostname()}-${cpuModel}-${os.arch()}`;
}

/**
 * 机器指纹（32位hex），同一台机器在硬件升级后应保持不变
 * @returns {string}
 */
function getMachineId() {
    if (_cache) return _cache;
    const source = readOsMachineId() || buildFallbackSource();
    _cache = crypto.createHash('sha256').update(`${source}-novelpipeline`).digest('hex').substring(0, 32);
    return _cache;
}

/** 指纹来源（用于许可证诊断，不泄露原始标识） */
function getMachineIdSource() {
    return readOsMachineId() ? `os-machine-id(${process.platform})` : `fallback(${process.platform})`;
}

/** 仅测试用：清除缓存以便重新计算 */
function resetMachineIdCache() {
    _cache = null;
}

module.exports = { getMachineId, getMachineIdSource, readOsMachineId, resetMachineIdCache };
