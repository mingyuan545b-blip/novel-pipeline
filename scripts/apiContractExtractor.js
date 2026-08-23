/**
 * apiContractExtractor - 前端API调用提取 + 后端路由提取 + 契约比对
 *
 * 从verifyApiContract.js拆出，避免主文件超过200行限制
 */
const fs = require('fs');
const path = require('path');
const { ROUTE_PREFIXES } = require('./apiContractRoutePrefixes');

const ROOT = path.join(__dirname, '..');
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'];

function scanJsFiles(dir, ignoreDirs = []) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (ignoreDirs.includes(entry.name) || entry.name.startsWith('.')) continue;
            results.push(...scanJsFiles(fullPath, ignoreDirs));
        } else if (entry.name.endsWith('.js')) {
            results.push(fullPath);
        }
    }
    return results;
}

function parseConstVars(content) {
    const vars = {};
    const varRegex = /const\s+(\w+)\s*=\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = varRegex.exec(content)) !== null) {
        vars[match[1]] = match[2];
    }
    return vars;
}

function resolveVars(rawPath, vars) {
    return rawPath.replace(/\$\{(\w+)\}/g, (_, varName) => vars[varName] || `\${${varName}}`);
}

function extractFrontendCalls() {
    const apiDir = path.join(ROOT, 'client', 'src', 'services', 'api');
    const files = fs.readdirSync(apiDir).filter(f => f.endsWith('.js'));
    const calls = [];
    for (const file of files) {
        const filePath = path.join(apiDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const vars = parseConstVars(content);
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const regex = new RegExp(
                `\\b(?:api|longApi)\\.(${HTTP_METHODS.join('|')})\\s*\\(\\s*(['"\`])([^'"\`]+)\\2`,
                'g'
            );
            let match;
            while ((match = regex.exec(line)) !== null) {
                calls.push({
                    method: match[1].toUpperCase(),
                    path: resolveVars(match[3], vars),
                    file: `client/src/services/api/${file}`,
                    line: i + 1
                });
            }
        }
    }
    return calls;
}

function extractBackendRoutes() {
    const routesDir = path.join(ROOT, 'server', 'routes');
    const files = scanJsFiles(routesDir, ['node_modules', '__tests__']);
    const routes = [];
    for (const file of files) {
        const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
        const prefix = ROUTE_PREFIXES[relPath];
        if (prefix === undefined) continue;
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const regex = new RegExp(
                `(?:router|app)\\.(${HTTP_METHODS.join('|')})\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`,
                'g'
            );
            let match;
            while ((match = regex.exec(line)) !== null) {
                let routePath = match[2];
                if (routePath === '/') routePath = '';
                routes.push({
                    method: match[1].toUpperCase(),
                    path: prefix + routePath,
                    file: relPath,
                    line: i + 1
                });
            }
        }
    }
    // entityCenter动态路由（使用变量pathPrefix，无法自动提取）
    const entityTypes = ['/entity-registry', '/entities', '/item-definitions',
        '/character-binds', '/character-relations', '/pet-entities', '/servant-entities'];
    for (const et of entityTypes) {
        for (const m of ['GET']) routes.push({ method: m, path: `/api/entity-center${et}`, file: 'server/routes/entityCenter.js', line: 0 });
        routes.push({ method: 'GET', path: `/api/entity-center${et}/:id`, file: 'server/routes/entityCenter.js', line: 0 });
        routes.push({ method: 'POST', path: `/api/entity-center${et}`, file: 'server/routes/entityCenter.js', line: 0 });
        routes.push({ method: 'PUT', path: `/api/entity-center${et}/:id`, file: 'server/routes/entityCenter.js', line: 0 });
        routes.push({ method: 'DELETE', path: `/api/entity-center${et}/:id`, file: 'server/routes/entityCenter.js', line: 0 });
    }
    return routes;
}

function normalizePath(p) {
    return p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p;
}

function pathToRegex(p) {
    let regexStr = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regexStr = regexStr.replace(/\$\{[^}]+\}/g, '[^/]+');
    regexStr = regexStr.replace(/:[^/]+/g, '[^/]+');
    return new RegExp('^' + regexStr + '$');
}

function compareContracts(frontendCalls, backendRoutes) {
    const brokenCalls = [];
    const backendPatterns = backendRoutes.map(r => ({
        method: r.method,
        regex: pathToRegex(normalizePath(r.path.replace(/^\/api/, '')))
    }));
    for (const call of frontendCalls) {
        const callPath = normalizePath(call.path);
        const matched = backendPatterns.some(bp => bp.method === call.method && bp.regex.test(callPath));
        if (!matched) brokenCalls.push(call);
    }
    return brokenCalls;
}

module.exports = { extractFrontendCalls, extractBackendRoutes, compareContracts };
