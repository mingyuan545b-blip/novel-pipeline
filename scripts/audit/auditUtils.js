'use strict';

/**
 * auditUtils.js — 深度审计公共工具
 *
 * 提供文件读取、问题记录、模块ID提取等公共能力
 * 供5个维度审计模块（D1-D5）共享
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

let criticalCount = 0;
let warnCount = 0;
let infoCount = 0;
const issues = [];

function critical(code, msg, detail) {
    criticalCount++;
    issues.push({ severity: 'CRITICAL', code, msg, detail });
    console.log(`  ❌ [CRITICAL][${code}] ${msg}`);
    if (detail) console.log(`     详情: ${JSON.stringify(detail).substring(0, 200)}`);
}

function warn(code, msg, detail) {
    warnCount++;
    issues.push({ severity: 'WARN', code, msg, detail });
    console.log(`  ⚠️  [WARN][${code}] ${msg}`);
    if (detail) console.log(`     详情: ${JSON.stringify(detail).substring(0, 200)}`);
}

function info(code, msg, detail) {
    infoCount++;
    console.log(`  ℹ️  [INFO][${code}] ${msg}`);
    if (detail) console.log(`     详情: ${JSON.stringify(detail).substring(0, 200)}`);
}

function ok(code, msg) {
    console.log(`  ✅ [${code}] ${msg}`);
}

function readFile(relPath) {
    const full = path.join(ROOT, relPath);
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, 'utf8');
}

/**
 * 从constraintModuleDefs.js及其依赖文件收集所有已定义的模块ID
 * 支持识别 ...EXTRA_CONSTRAINT_MODULES 展开语法，递归读取子文件
 *
 * 修复历史bug：
 * 1. spread正则要求后跟[,;]但...CRAFT_MODULES后跟}匹配不到 → 改为不限制后缀
 * 2. 递归路径没加.js扩展名导致文件找不到 → 自动补.js
 * 3. 模块定义key用引号包裹（如'redline-format'）→ 正则已支持可选引号
 */
function collectDefinedModuleIds() {
    const definedIds = new Set();
    const visited = new Set();

    function extractIdsFromFile(relPath) {
        if (visited.has(relPath)) return;
        visited.add(relPath);
        const content = readFile(relPath);
        if (!content) return;

        // 匹配 key: { 或 'key': { 形式的模块定义
        const idMatches = content.matchAll(/^\s*['"]?([\w-]+)['"]?\s*:\s*\{/gm);
        for (const m of idMatches) {
            const key = m[1];
            // 排除对象内部属性（id/rules/description等不是模块ID）
            if (!['id', 'rules', 'description', 'get'].includes(key)) {
                definedIds.add(key);
            }
        }

        // 匹配 ...VAR_NAME 展开语法（不限制后缀字符），递归读取
        const spreadMatches = content.matchAll(/\.\.\.([A-Z_][A-Z_]+)/g);
        for (const m of spreadMatches) {
            const varName = m[1];
            // 查找 require 语句获取文件路径
            const requireRegex = new RegExp(`const\\s*\\{[^}]*${varName}[^}]*\\}\\s*=\\s*require\\(['"]([^'"]+)['"]\\)`);
            const requireMatch = content.match(requireRegex);
            if (requireMatch) {
                let depPath = path.join(path.dirname(relPath), requireMatch[1]);
                // 自动补.js扩展名（如果文件不存在）
                if (!fs.existsSync(path.join(ROOT, depPath))) {
                    depPath = depPath + '.js';
                }
                extractIdsFromFile(depPath);
            }
        }
    }

    extractIdsFromFile('server/services/prompts/constraintModuleDefs.js');
    return definedIds;
}

function getSummary() {
    return { criticalCount, warnCount, infoCount, issues, total: issues.length };
}

module.exports = {
    critical, warn, info, ok, readFile,
    collectDefinedModuleIds, getSummary,
    ROOT
};
