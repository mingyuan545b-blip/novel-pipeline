/**
 * deadCodeAudit.js
 * 检测前端API对象中从未被调用的方法
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'client', 'src');

// 从API文件提取所有方法名
const apiFiles = [
    'services/api/pipelineApi.js',
    'services/api/projectApi.js',
    'services/api/materialApi.js',
    'services/api/chapterApi.js',
    'services/api/comicApi.js',
    'services/api/publishApi.js',
    'services/api/otherApi.js',
];

const allMethods = [];

for (const relFile of apiFiles) {
    const fp = path.join(ROOT, relFile);
    const content = fs.readFileSync(fp, 'utf8');
    const apiName = path.basename(relFile, '.js');

    // 匹配 export const xxxApi = { methodName: ... }
    const methodRegex = /(\w+):\s*(?:\(|async|\(|\(.*\)\s*=>)/g;
    // 更精确：匹配对象方法定义
    const objMethodRegex = /^\s+(\w+):\s/gm;
    let match;
    while ((match = objMethodRegex.exec(content)) !== null) {
        const methodName = match[1];
        // 跳过const定义
        if (methodName === 'EC' || methodName === 'KB') continue;
        allMethods.push({ apiFile: relFile, methodName });
    }
}

// 扫描所有前端源码，检查方法是否被使用
const srcContent = [];
function collectSrc(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '__tests__') {
                collectSrc(fp);
            }
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
            try { srcContent.push(fs.readFileSync(fp, 'utf8')); } catch (e) { /* skip */ }
        }
    }
}
collectSrc(ROOT);
const allSrc = srcContent.join('\n');

// 检查每个方法是否被使用
const unused = [];
for (const m of allMethods) {
    // 搜索 xxxApi.methodName( 或 xxxApi.methodName ,
    const usageRegex = new RegExp('\\w+Api\\.' + m.methodName + '\\b');
    if (!usageRegex.test(allSrc)) {
        unused.push(m);
    }
}

console.log('=== 前端API中从未被调用的方法 ===\n');
if (unused.length === 0) {
    console.log('(无)');
} else {
    // 按文件分组
    const grouped = {};
    for (const m of unused) {
        if (!grouped[m.apiFile]) grouped[m.apiFile] = [];
        grouped[m.apiFile].push(m.methodName);
    }
    for (const [file, methods] of Object.entries(grouped)) {
        console.log(`${file} (${methods.length}个):`);
        methods.forEach(m => console.log(`  - ${m}`));
    }
}

console.log('\n=== 统计 ===');
console.log('API方法总数:', allMethods.length);
console.log('从未调用:', unused.length);
