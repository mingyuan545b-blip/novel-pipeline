/**
 * apiContractAudit.js
 * 前后端API契约审计 — 找出前端调用无后端路由、后端路由无前端调用的API
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 后端路由文件 → 前缀映射
const routeFileMap = {
    'server/routes/genre-debug.js': '/api/genre-debug',
    'server/routes/apiKeys.js': '/api/api-keys',
    'server/routes/health.js': '/api/health',
    'server/routes/pipeline/pipelineExecutionRoutes.js': '/api/pipeline',
    'server/routes/pipeline/pipelineFeatureRoutes.js': '/api/pipeline',
    'server/routes/pipeline/pipelineChapterRoutes.js': '/api/pipeline',
    'server/routes/pipeline/pipelineDiagnosticRoutes.js': '/api/pipeline',
    'server/routes/pipeline/subplaneRoutes.js': '/api/pipeline',
    'server/routes/pipeline/templateRoutes.js': '/api/pipeline',
    'server/routes/pipeline/materialRoutes.js': '/api/pipeline',
    'server/routes/pipeline/taskRoutes.js': '/api/pipeline',
    'server/routes/pipeline/infiniteRoutes.js': '/api/pipeline',
    'server/routes/pipeline/toolRoutes.js': '/api/pipeline',
    'server/routes/projects/crudRoutes.js': '/api/projects',
    'server/routes/projects/styleRoutes.js': '/api/projects',
    'server/routes/projects/cleanupRoutes.js': '/api/projects',
    'server/routes/characterStates.js': '/api/character-states',
    'server/routes/chapterAudit.js': '/api/chapter-audit',
    'server/routes/flavorProjectPrompt.js': '/api/flavors',
    'server/routes/promptStyleRoutes.js': '/api/prompt-config',
    'server/routes/promptTemplateRoutes.js': '/api/prompt-config',
    'server/routes/entityCenter.js': '/api/entity-center',
    'server/routes/entityCenterRepairRoutes.js': '/api/entity-center',
    'server/routes/guide.js': '/api/guide',
    'server/routes/admin.js': '/api/admin',
    'server/routes/apiKeyRoutes.js': '/api/settings',
};

// 提取后端路由
const backendRoutes = [];
for (const [file, prefix] of Object.entries(routeFileMap)) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) {
        console.log('MISSING FILE:', file);
        continue;
    }
    const content = fs.readFileSync(fp, 'utf8');
    const routeRegex = /router\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)/g;
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        const routePath = prefix + match[2];
        backendRoutes.push({ method, path: routePath, file });
    }
}

// 提取前端API调用
const apiDir = path.join(ROOT, 'client', 'src', 'services', 'api');
const frontendCalls = [];
for (const apiFile of fs.readdirSync(apiDir).filter(f => f.endsWith('.js') && f !== 'httpClient.js' && f !== 'authInterceptor.js' && f !== 'index.js')) {
    const content = fs.readFileSync(path.join(apiDir, apiFile), 'utf8');
    // 匹配 api.get/post/put/delete/longApi.get/post 调用
    const callRegex = /(api|longApi)\.(get|post|put|delete)\(\s*[`'"]([^`'"]+)/g;
    let match;
    while ((match = callRegex.exec(content)) !== null) {
        const method = match[2].toUpperCase();
        const routePath = '/api' + match[3];
        frontendCalls.push({ method, path: routePath, file: apiFile });
    }
}

// 路由匹配函数（参数化路由匹配）
function routeMatches(pattern, testPath) {
    const regexStr = pattern.replace(/:[^/]+/g, '[^/]+');
    return new RegExp('^' + regexStr + '$').test(testPath);
}

function routeMatchesPrefix(pattern, testPath) {
    const regexStr = pattern.replace(/:[^/]+/g, '[^/]+');
    return new RegExp('^' + regexStr).test(testPath);
}

// 检查前端调用无后端路由
console.log('\n=== 前端调用无后端路由（404风险）===');
const missing = [];
for (const fc of frontendCalls) {
    let found = false;
    for (const br of backendRoutes) {
        if (br.method === fc.method && routeMatches(br.path, fc.path)) {
            found = true;
            break;
        }
    }
    if (!found) missing.push(fc);
}

if (missing.length === 0) {
    console.log('(无)');
} else {
    // 去重
    const seen = new Set();
    for (const m of missing) {
        const key = m.method + ' ' + m.path;
        if (!seen.has(key)) {
            seen.add(key);
            console.log('  MISSING:', key, '(' + m.file + ')');
        }
    }
}

// 检查后端路由无前端调用
console.log('\n=== 后端路由无前端调用（可能死代码）===');
const unused = [];
for (const br of backendRoutes) {
    let found = false;
    for (const fc of frontendCalls) {
        if (br.method === fc.method && routeMatchesPrefix(br.path, fc.path)) {
            found = true;
            break;
        }
    }
    if (!found) unused.push(br);
}

if (unused.length === 0) {
    console.log('(无)');
} else {
    const seen = new Set();
    for (const u of unused) {
        const key = u.method + ' ' + u.path;
        if (!seen.has(key)) {
            seen.add(key);
            console.log('  UNUSED:', key, '(' + u.file + ')');
        }
    }
}

console.log('\n=== 统计 ===');
console.log('后端路由总数:', backendRoutes.length);
console.log('前端调用总数:', frontendCalls.length);
console.log('404风险:', missing.length);
console.log('可能死代码:', unused.length);
