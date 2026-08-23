/**
 * apiSelfCheck.js — API 契约启动自检
 *
 * 两层防御：
 * 1. ROUTE_MOUNTS 文件存在性 — apiRegistry 声明的每个路由文件必须实际存在
 * 2. SERVICE_DEPENDENCIES 导出完整性 — service 模块必须导出声明中的函数
 *
 * 这能捕获两类死 bug：
 * - 路由文件路径写错（如 worldscopeRoutes.js 路径变更后 SSOT 没同步）
 * - 路由调用了不存在的 service 函数（如 getWorldScopeForProject 实际名是 getWorldScopes）
 */
const fs = require('fs');
const path = require('path');
const { ROUTE_MOUNTS, SERVICE_DEPENDENCIES, getRouteFiles } = require('../config/apiRegistry');

/**
 * 验证 ROUTE_MOUNTS 中每个挂载点对应的所有路由文件存在
 * G2：扩展为检查主文件 + extraFiles（多文件挂载场景）
 */
function checkRouteMountFiles() {
    const errors = [];
    let checked = 0;
    for (const [mountPath, entry] of Object.entries(ROUTE_MOUNTS)) {
        const files = getRouteFiles(mountPath);
        if (files.length === 0) {
            errors.push(`${mountPath} 在 ROUTE_MOUNTS 中声明但 getRouteFiles 返回空`);
            continue;
        }
        for (const filePath of files) {
            checked++;
            if (!fs.existsSync(filePath)) {
                const relPath = path.relative(path.join(__dirname, '..'), filePath);
                errors.push(`${mountPath} → ${relPath} 文件不存在`);
            }
        }
    }
    return { errors, checked };
}

/** 验证 SERVICE_DEPENDENCIES 中声明的 service 函数实际存在 */
function checkServiceExports() {
    const errors = [];
    let checked = 0;
    const serverRoot = path.join(__dirname, '..');
    for (const [moduleRelPath, expectedExports] of Object.entries(SERVICE_DEPENDENCIES)) {
        const fullPath = path.join(serverRoot, moduleRelPath);
        try {
            // 注意：不删除 require.cache，避免破坏有状态模块（如 pipelineModuleRegistry）的单例
            // 原代码 delete require.cache[require.resolve(fullPath)] 会导致模块被重新加载，
            // 创建新的空实例，使 startup.js 中注册的模块钩子丢失
            const mod = require(fullPath);
            for (const fnName of expectedExports) {
                checked++;
                if (mod[fnName] === undefined || mod[fnName] === null) {
                    errors.push(`${moduleRelPath} 缺少导出: ${fnName}`);
                }
            }
        } catch (err) {
            errors.push(`${moduleRelPath} 模块加载失败: ${err.message}`);
            checked += expectedExports.length;
        }
    }
    return { errors, checked };
}

/**
 * 执行 API 自检（路由文件 + service 函数）
 * @returns {{ passed: boolean, errors: string[], checked: number, details: object }}
 */
function runApiSelfCheck() {
    const fileCheck = checkRouteMountFiles();
    const svcCheck = checkServiceExports();
    const allErrors = [...fileCheck.errors, ...svcCheck.errors];
    return {
        passed: allErrors.length === 0,
        errors: allErrors,
        checked: fileCheck.checked + svcCheck.checked,
        details: {
            routeFiles: fileCheck.checked,
            serviceFns: svcCheck.checked
        }
    };
}

module.exports = { runApiSelfCheck };
