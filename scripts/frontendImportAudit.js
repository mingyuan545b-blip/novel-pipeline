/**
 * frontendImportAudit.js
 * 检测前端所有import是否指向存在的文件
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'client', 'src');
const PROJECT_ROOT = path.join(__dirname, '..');

const brokenImports = [];
const checkedFiles = new Set();

function resolveImport(fromFile, importPath) {
    // 跳过npm包
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) return null;

    const dir = path.dirname(fromFile);
    let resolved = path.resolve(dir, importPath);

    // 尝试各种扩展名
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.module.css', '.json'];
    if (fs.existsSync(resolved)) return resolved;
    for (const ext of extensions) {
        if (fs.existsSync(resolved + ext)) return resolved + ext;
    }
    // 尝试index
    for (const ext of extensions) {
        if (fs.existsSync(path.join(resolved, 'index' + ext))) return path.join(resolved, 'index' + ext);
    }

    return null;
}

function scanFile(filePath) {
    if (checkedFiles.has(filePath)) return;
    checkedFiles.add(filePath);

    const content = fs.readFileSync(filePath, 'utf8');

    // 匹配 import ... from '...' 和 import ... from "..."
    const importRegex = /from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        const resolved = resolveImport(filePath, importPath);
        if (resolved === null) continue; // npm包
        if (!resolved) {
            const line = content.substring(0, match.index).split('\n').length;
            brokenImports.push({ file: path.relative(PROJECT_ROOT, filePath), import: importPath, line });
        }
    }
}

function scanDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '__tests__' && entry.name !== 'dist') {
                scanDir(fullPath);
            }
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
            try { scanFile(fullPath); } catch (e) { /* skip */ }
        }
    }
}

console.log('扫描前端所有import路径...\n');
scanDir(ROOT);

if (brokenImports.length === 0) {
    console.log('✅ 所有import路径都有效');
} else {
    console.log('❌ 发现', brokenImports.length, '个broken import:\n');
    for (const bi of brokenImports) {
        console.log(`  ${bi.file}:${bi.line} — from '${bi.import}' 文件不存在`);
    }
}
