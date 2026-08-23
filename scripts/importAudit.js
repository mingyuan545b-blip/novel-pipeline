/**
 * importAudit.js
 * 检测后端所有require/import是否指向存在的文件
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'server');
const NODE_MODULES = path.join(__dirname, '..', 'node_modules');

const brokenImports = [];
const checkedFiles = new Set();

function resolveRequire(fromFile, reqPath) {
    // 跳过内置模块和npm包
    if (!reqPath.startsWith('.') && !reqPath.startsWith('/')) {
        // 检查是否是npm包
        const pkgPath = path.join(NODE_MODULES, reqPath, 'package.json');
        if (fs.existsSync(pkgPath)) return null; // npm包存在
        const directPath = path.join(NODE_MODULES, reqPath + '.js');
        if (fs.existsSync(directPath)) return null;
        const scopedMatch = reqPath.startsWith('@');
        if (scopedMatch) {
            const scopePath = path.join(NODE_MODULES, reqPath.split('/').slice(0, 2).join('/'));
            if (fs.existsSync(scopePath)) return null;
        }
        // 可能是内置模块
        return null;
    }

    const dir = path.dirname(fromFile);
    let resolved;

    if (reqPath.startsWith('/')) {
        resolved = reqPath;
    } else {
        resolved = path.resolve(dir, reqPath);
    }

    // 尝试各种扩展名
    const extensions = ['.js', '.json', '/index.js', '/index.json'];
    if (fs.existsSync(resolved)) return resolved;
    for (const ext of extensions) {
        if (fs.existsSync(resolved + ext)) return resolved + ext;
    }

    return null;
}

function scanFile(filePath) {
    if (checkedFiles.has(filePath)) return;
    checkedFiles.add(filePath);

    const content = fs.readFileSync(filePath, 'utf8');

    // 匹配 require('...') 和 require("...")
    const requireRegex = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
        const reqPath = match[1];
        const resolved = resolveRequire(filePath, reqPath);
        if (resolved === null) continue; // npm包或内置模块
        if (!resolved) {
            const line = content.substring(0, match.index).split('\n').length;
            brokenImports.push({ file: path.relative(ROOT, filePath), import: reqPath, line });
        }
    }
}

function scanDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '__tests__' && entry.name !== '.git') {
                scanDir(fullPath);
            }
        } else if (entry.name.endsWith('.js')) {
            try { scanFile(fullPath); } catch (e) { /* skip unreadable */ }
        }
    }
}

console.log('扫描后端所有require/import路径...\n');
scanDir(ROOT);

if (brokenImports.length === 0) {
    console.log('✅ 所有require路径都有效');
} else {
    console.log('❌ 发现', brokenImports.length, '个broken import:\n');
    for (const bi of brokenImports) {
        console.log(`  ${bi.file}:${bi.line} — require('${bi.import}') 文件不存在`);
    }
}
