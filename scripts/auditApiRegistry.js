/**
 * auditApiRegistry.js — G2: apiRegistry 与实际挂载一致性审计
 *
 * 校验三层数据一致性：
 *   A1: routeRegistration.js 中每个 app.use('/api/xxx', ...) 挂载点都在 ROUTE_MOUNTS 中声明
 *   A2: ROUTE_MOUNTS 中声明的每个挂载点的所有文件（file + extraFiles）实际存在
 *   A3: ROUTE_MOUNTS 中声明的挂载点没有"孤儿"（routeRegistration.js 已移除但 registry 还保留）
 *
 * 与 verifyRouteRegistration.js 的区别：
 *   - verifyRouteRegistration.js 校验 apiContractRoutePrefixes.js（细粒度文件→前缀映射，含辅助文件）
 *   - auditApiRegistry.js 校验 apiRegistry.ROUTE_MOUNTS（挂载点 SSOT，仅含直接挂载文件）
 *
 * 用法: node scripts/auditApiRegistry.js
 * CI 集成: 退出码 0=通过，1=有错误
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { ROUTE_MOUNTS, getRouteFiles } = require('../server/config/apiRegistry');

const ROOT = path.join(__dirname, '..');
const SERVER_ROOT = path.join(ROOT, 'server');
const ROUTE_REG_PATH = path.join(SERVER_ROOT, 'config', 'routeRegistration.js');

let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`  ❌ [ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`  ⚠️  [WARN] ${msg}`); warnCount++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

/**
 * 从 routeRegistration.js 提取所有 app.use('/api/xxx', ...) 挂载点
 * 返回: Set<string> 挂载路径集合
 */
function extractActualMounts() {
    const content = fs.readFileSync(ROUTE_REG_PATH, 'utf8');
    const mounts = new Set();
    // 匹配 app.use('/api/xxx', ...) 或 app.use("/api/xxx", ...)
    const regex = /app\.use\(\s*['"`](\/api[^'"`]*?)['"`]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        mounts.add(match[1]);
    }
    return mounts;
}

/**
 * A1: routeRegistration.js 中每个挂载点都在 ROUTE_MOUNTS 中声明
 */
function checkActualMountsDeclared(actualMounts) {
    console.log('\n=== A1: 实际挂载点是否在 ROUTE_MOUNTS 中声明 ===');
    let missing = 0;
    for (const mount of actualMounts) {
        if (!ROUTE_MOUNTS[mount]) {
            error(`routeRegistration.js 挂载 ${mount} 但 ROUTE_MOUNTS 未声明`);
            missing++;
        }
    }
    if (missing === 0) {
        ok(`所有 ${actualMounts.size} 个实际挂载点均已在 ROUTE_MOUNTS 声明`);
    }
    return missing;
}

/**
 * A2: ROUTE_MOUNTS 中每个挂载点的所有文件实际存在
 */
function checkDeclaredFilesExist() {
    console.log('\n=== A2: ROUTE_MOUNTS 声明的路由文件是否存在 ===');
    let missing = 0;
    let totalFiles = 0;
    for (const [mountPath] of Object.entries(ROUTE_MOUNTS)) {
        const files = getRouteFiles(mountPath);
        for (const filePath of files) {
            totalFiles++;
            if (!fs.existsSync(filePath)) {
                const relPath = path.relative(ROOT, filePath);
                error(`${mountPath} → ${relPath} 文件不存在`);
                missing++;
            }
        }
    }
    if (missing === 0) {
        ok(`ROUTE_MOUNTS 声明的 ${totalFiles} 个文件全部存在`);
    }
    return missing;
}

/**
 * A3: ROUTE_MOUNTS 中没有 routeRegistration.js 已移除的"孤儿"挂载点
 * 注意: /api/docs 等非 /api/xxx 挂载或 swagger 等可能不在 routeRegistration.js
 */
function checkOrphanMounts(actualMounts) {
    console.log('\n=== A3: ROUTE_MOUNTS 是否有孤儿挂载点 ===');
    let orphan = 0;
    for (const mountPath of Object.keys(ROUTE_MOUNTS)) {
        if (!actualMounts.has(mountPath)) {
            warn(`ROUTE_MOUNTS 声明 ${mountPath} 但 routeRegistration.js 未挂载（可能为动态挂载或已废弃）`);
            orphan++;
        }
    }
    if (orphan === 0) {
        ok('ROUTE_MOUNTS 无孤儿挂载点');
    }
    return orphan;
}

function main() {
    console.log('========================================');
    console.log('G2: apiRegistry 一致性审计');
    console.log('========================================');

    if (!fs.existsSync(ROUTE_REG_PATH)) {
        error(`routeRegistration.js 不存在: ${ROUTE_REG_PATH}`);
        console.log('\n========================================');
        console.log(`审计失败: ${errorCount} errors`);
        process.exit(1);
    }

    const actualMounts = extractActualMounts();
    ok(`从 routeRegistration.js 提取 ${actualMounts.size} 个挂载点`);

    const e1 = checkActualMountsDeclared(actualMounts);
    const e2 = checkDeclaredFilesExist();
    const w3 = checkOrphanMounts(actualMounts);

    console.log('\n========================================');
    console.log(`审计完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.log('❌ 存在错误 — apiRegistry 与实际挂载不一致');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  存在警告 — 请检查孤儿挂载点');
    } else {
        console.log('✅ 审计通过 — apiRegistry 与实际挂载一致');
    }
}

main();
