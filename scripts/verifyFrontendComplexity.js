/**
 * verifyFrontendComplexity - 前端组件复杂度约束检测
 *
 * 检查项：
 *   F1: 单文件行数≤200行（硬限制）
 *   F2: 单组件useState数量≤5个（硬限制）
 *   F3: 内联style检测（应使用CSS模块或styled-components）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAX_LINES = 200;
const MAX_USE_STATE = 5;
let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`  ❌ [ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`  ⚠️  [WARN] ${msg}`); warnCount++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

function scanFiles(dir, exts, ignoreDirs = []) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (ignoreDirs.includes(entry.name) || entry.name.startsWith('.')) continue;
            results.push(...scanFiles(fullPath, exts, ignoreDirs));
        } else if (exts.some(ext => entry.name.endsWith(ext))) {
            results.push(fullPath);
        }
    }
    return results;
}

function checkFileLines(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    return lines.length;
}

function countUseStatePerComponent(content) {
    // 按组件边界统计useState数量
    // 识别function ComponentName或const ComponentName = () =>或export default function
    const components = [];
    const lines = content.split('\n');
    let currentComponent = null;
    let braceDepth = 0;
    let inComponent = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 检测组件定义开始
        const funcMatch = line.match(/^(?:export\s+default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9]+)\s*(?:[:=]|(?:\s*\())/);
        if (funcMatch && !inComponent) {
            currentComponent = { name: funcMatch[1], startLine: i + 1, useStateCount: 0 };
            inComponent = true;
            braceDepth = 0;
        }

        if (inComponent) {
            // 统计useState
            const stateMatches = line.match(/useState\s*\(/g);
            if (stateMatches) {
                currentComponent.useStateCount += stateMatches.length;
            }

            // 统计大括号深度（简化版，可能不完美但足够用）
            for (const ch of line) {
                if (ch === '{') braceDepth++;
                if (ch === '}') braceDepth--;
            }

            // 当大括号深度回到0或以下，组件结束
            if (braceDepth <= 0 && i > currentComponent.startLine - 1) {
                components.push(currentComponent);
                inComponent = false;
                currentComponent = null;
            }
        }
    }

    // 如果组件未正常结束（如箭头函数），也加入结果
    if (currentComponent) {
        components.push(currentComponent);
    }

    return components;
}

function checkInlineStyle(content) {
    // 检测style={{ ... }}内联样式
    // 排除纯CSS变量设置：style={{ '--xxx': value }}（这是CSS变量传递，不是样式内联）
    let count = 0;
    const regex = /style\s*=\s*\{\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\}/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const styleContent = match[1].trim();
        // 如果只包含CSS变量设置（--开头），不计为内联style
        const props = styleContent.split(',').map(p => p.trim());
        const isOnlyCssVars = props.length > 0 && props.every(p => p.startsWith("'--") || p.startsWith('"--'));
        if (!isOnlyCssVars) count++;
    }
    return count;
}

function main() {
    console.log('========================================');
    console.log('前端组件复杂度约束检测（F1-F3）');
    console.log('========================================');

    const clientDir = path.join(ROOT, 'client', 'src');
    const files = scanFiles(clientDir, ['.jsx', '.js'], ['node_modules', '__tests__', '__mocks__', 'dist', 'build']);

    console.log(`\n=== F1: 单文件行数≤${MAX_LINES}行 ===`);
    let lineViolationCount = 0;
    for (const file of files) {
        const lineCount = checkFileLines(file);
        if (lineCount > MAX_LINES) {
            const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
            error(`${relPath} ${lineCount}行 超过${MAX_LINES}行限制`);
            lineViolationCount++;
        }
    }
    if (lineViolationCount === 0) {
        ok(`所有${files.length}个前端文件行数合规（≤${MAX_LINES}行）`);
    }

    console.log(`\n=== F2: 单组件useState数量≤${MAX_USE_STATE}个 ===`);
    let stateViolationCount = 0;
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (!file.endsWith('.jsx')) continue;
        const components = countUseStatePerComponent(content);
        for (const comp of components) {
            if (comp.useStateCount > MAX_USE_STATE) {
                const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
                error(`${relPath}:${comp.startLine} 组件${comp.name} ${comp.useStateCount}个useState 超过${MAX_USE_STATE}个限制 — 应提取自定义hook`);
                stateViolationCount++;
            }
        }
    }
    if (stateViolationCount === 0) {
        ok(`所有jsx组件useState数量合规（≤${MAX_USE_STATE}个）`);
    }

    console.log(`\n=== F3: 内联style检测 ===`);
    let inlineStyleCount = 0;
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (!file.endsWith('.jsx')) continue;
        const inlineCount = checkInlineStyle(content);
        if (inlineCount > 0) {
            const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
            warn(`${relPath} 检测到${inlineCount}处内联style={{}} — 建议使用CSS模块`);
            inlineStyleCount += inlineCount;
        }
    }
    if (inlineStyleCount === 0) {
        ok('无内联style');
    }

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.log('❌ 存在错误 — 前端组件复杂度超标');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  存在警告');
    } else {
        console.log('✅ 校验通过 — 前端组件复杂度合规');
    }
}

main();
