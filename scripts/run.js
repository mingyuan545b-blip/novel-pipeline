/**
 * scripts/run.js — 统一脚本启动入口
 * 自动加载.env + 设置NODE_PATH，避免每个脚本重复配置
 *
 * 用法:
 *   node scripts/run.js <script-path> [args...]
 *
 * 示例:
 *   node scripts/run.js _test_chapters.js
 *   node scripts/run.js scripts/health-check.js
 *   node scripts/run.js server/scripts/smoke-test.js
 */
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(PROJECT_ROOT, 'server');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');

// 1. 加载.env (如果存在)
if (fs.existsSync(ENV_PATH)) {
    require('dotenv').config({ path: ENV_PATH });
} else {
    console.warn('[run.js] .env not found at', ENV_PATH, '— using process.env defaults');
}

// 2. 设置NODE_PATH (server目录优先)
const existingNodePath = process.env.NODE_PATH || '';
const nodePaths = [SERVER_DIR, ...existingNodePath.split(path.delimiter).filter(Boolean)];
process.env.NODE_PATH = nodePaths.join(path.delimiter);

// 3. require.main的搜索路径也加上server目录
module.paths.unshift(SERVER_DIR);

// 4. 解析目标脚本路径 (支持相对路径和绝对路径)
const targetScript = process.argv[2];
if (!targetScript) {
    console.error('[run.js] Usage: node scripts/run.js <script-path> [args...]');
    process.exit(1);
}

let resolvedPath;
if (path.isAbsolute(targetScript)) {
    resolvedPath = targetScript;
} else {
    // 尝试相对于项目根目录解析
    resolvedPath = path.join(PROJECT_ROOT, targetScript);
    if (!fs.existsSync(resolvedPath)) {
        // 尝试相对于当前工作目录解析
        resolvedPath = path.resolve(targetScript);
    }
}

if (!fs.existsSync(resolvedPath)) {
    console.error('[run.js] Script not found:', targetScript);
    console.error('[run.js] Searched:', resolvedPath);
    process.exit(1);
}

// 5. 替换argv，让目标脚本看到正确的参数
process.argv = [process.argv[0], resolvedPath, ...process.argv.slice(3)];

// 6. 加载目标脚本
console.log('[run.js] Loading:', resolvedPath);
console.log('[run.js] NODE_PATH:', process.env.NODE_PATH);
require(resolvedPath);
