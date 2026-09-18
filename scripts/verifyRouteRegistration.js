/**
 * verifyRouteRegistration - 路由注册一致性检测
 *
 * 检查项：
 *   R1: routeRegistration.js中所有app.use挂载路径都能在apiContractRoutePrefixes.js找到对应映射
 *   R2: apiContractRoutePrefixes.js中的映射没有多余条目（已废弃的路由文件）
 *   R3: 路由文件实际存在性检查
 */

const fs = require('fs');
const path = require('path');
const { ROUTE_PREFIXES } = require('./apiContractRoutePrefixes');

const ROOT = path.join(__dirname, '..');
let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`  ❌ [ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`  ⚠️  [WARN] ${msg}`); warnCount++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

/**
 * 从routeRegistration.js提取app.use挂载信息
 * 返回: [{ mountPath, routeVar }]
 * 支持复杂参数：app.use('/api/x', middleware, routeVar) 和 app.use('/api/x', lazyRoute('./path'))
 */
function extractRouteRegistrations() {
    const regPath = path.join(ROOT, 'server', 'config', 'routeRegistration.js');
    const content = fs.readFileSync(regPath, 'utf8');
    const lines = content.split('\n');
    const registrations = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 匹配 app.use('/api/xxx', ...)，提取挂载路径
        const match = line.match(/app\.use\(\s*['"`]([^'"`]+)['"`]/);
        if (match) {
            // 向后扫描最多5行，合并内容以处理跨多行的app.use
            let combinedLine = line;
            for (let j = 1; j <= 5 && i + j < lines.length; j++) {
                // 下一行是新的app.use语句，停止扫描
                if (lines[i + j].match(/app\.use\s*\(/)) break;
                combinedLine += ' ' + lines[i + j].trim();
                // 已能提取到路由变量或lazyRoute/require，停止扫描
                if (combinedLine.match(/(\w+Routes)\s*[\),]/) ||
                    combinedLine.match(/lazyRoute\s*\(/) ||
                    combinedLine.match(/require\s*\(\s*['"`]/)) break;
            }

            // 提取最后一个变量名或lazyRoute路径作为routeVar
            // 优先匹配变量名（如projectRoutes）
            const varMatch = combinedLine.match(/(\w+Routes)\s*[\),]/);
            // 匹配lazyRoute('./routes/xxx')
            const lazyMatch = combinedLine.match(/lazyRoute\(\s*['"`]([^'"`]+)['"`]\s*\)/);
            // 匹配require('...')模式
            const requireMatch = combinedLine.match(/require\(\s*['"`]([^'"`]+)['"`]\s*\)/);

            let routeVar = null;
            let routeFileHint = null;

            if (lazyMatch) {
                routeVar = 'lazyRoute';
                routeFileHint = lazyMatch[1];
            } else if (varMatch) {
                routeVar = varMatch[1];
            } else if (requireMatch) {
                routeVar = 'require';
                routeFileHint = requireMatch[1];
            }

            registrations.push({
                mountPath: match[1],
                routeVar: routeVar,
                routeFileHint: routeFileHint,
                line: i + 1,
                rawLine: line.trim(),
            });
        }
    }
    return registrations;
}

/**
 * 从routeVar名称推断路由文件路径
 * 例如: projectRoutes → server/routes/projects.js 或 server/routes/projects/index.js
 */
/**
 * 归一化 require 提示路径为仓库相对路径
 * routeRegistration.js 位于 server/config/，因此：
 *   './foo'          → server/foo.js
 *   '../routes/foo'  → server/routes/foo.js
 */
function normalizeRouteFile(hint) {
    let f = hint.replace(/^\.\//, 'server/');
    if (f.startsWith('../')) f = 'server/' + f.replace(/^\.\.\//, '');
    if (!f.endsWith('.js')) f += '.js';
    return f;
}

function inferRouteFile(routeVar) {
    // 去除Routes后缀，转kebab-case
    const baseName = routeVar.replace(/Routes$/, '').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');

    // 可能的文件路径
    const candidates = [
        `server/routes/${baseName}.js`,
        `server/routes/${baseName}/index.js`,
    ];

    // 特殊映射（变量名与目录名不一致的情况）
    const specialMappings = {
        'project': ['server/routes/projects.js', 'server/routes/projects/index.js'],
        'chapter': ['server/routes/chapters.js'],
        'material': ['server/routes/materials.js'],
        'review': ['server/routes/reviews.js'],
        'agent': ['server/routes/agents.js'],
        'setting': ['server/routes/settings.js'],
        'knowledge': ['server/routes/knowledge.js', 'server/routes/knowledge/index.js'],
        'franchise': ['server/routes/franchises.js', 'server/routes/franchiseCrudRoutes.js'],
        'map': ['server/routes/map.js'],
        'worldview-profile': ['server/routes/worldview-profiles.js'],
        'library': ['server/routes/library.js'],
        'prompt-config': ['server/routes/prompt-config.js'],
        'optimizer': ['server/routes/optimizer.js'],
        'chapter-audit': ['server/routes/chapterAudit.js'],
        'entity-center': ['server/routes/entityCenter.js'],
        'flavor': ['server/routes/flavors.js'],
        'character-state': ['server/routes/characterStates.js'],
        'style-template': ['server/routes/style-templates.js'],
        'quest': ['server/routes/quests.js'],
        'comic': ['server/routes/comic.js'],
        'publish': ['server/routes/publish.js'],
        'workshop': ['server/routes/workshop.js'],
        'pipeline': ['server/routes/pipeline.js', 'server/routes/pipeline/index.js'],
        'auth': ['server/routes/authRoutes.js'],
        'genre-debug': ['server/routes/genre-debug.js'],
        'api-key': ['server/routes/apiKeyRoutes.js', 'server/routes/apiKeys.js'],
        'api-keys': ['server/routes/apiKeyRoutes.js', 'server/routes/apiKeys.js'],
        'license': ['server/routes/licenseRoutes.js'],
        'version': ['server/routes/versionRoutes.js'],
        'health': ['server/routes/health.js'],
        'context-commander': ['server/routes/pipeline/contextCommanderRoutes.js'],
    };

    const files = specialMappings[baseName] || candidates;
    for (const f of files) {
        if (fs.existsSync(path.join(ROOT, f))) return f;
    }
    return null;
}

function main() {
    console.log('========================================');
    console.log('路由注册一致性检测（R1-R3）');
    console.log('========================================');

    console.log('\n=== R1: routeRegistration.js挂载路径检查 ===');
    const registrations = extractRouteRegistrations();
    ok(`提取${registrations.length}个路由挂载`);

    for (const reg of registrations) {
        let routeFile = null;

        if (reg.routeVar === 'lazyRoute' && reg.routeFileHint) {
            // lazyRoute('./routes/xxx') → server/routes/xxx.js
            routeFile = normalizeRouteFile(reg.routeFileHint);
        } else if (reg.routeVar === 'require' && reg.routeFileHint) {
            routeFile = normalizeRouteFile(reg.routeFileHint);
        } else if (reg.routeVar) {
            routeFile = inferRouteFile(reg.routeVar);
        }

        if (!routeFile) {
            // 跳过middleware-only的app.use（如requireFeature中间件）
            if (reg.routeVar === null && reg.rawLine.includes('requireFeature')) continue;
            warn(`routeRegistration.js:${reg.line} 无法推断路由文件: ${reg.rawLine.substring(0, 80)}`);
            continue;
        }

        const fullPath = path.join(ROOT, routeFile);
        if (!fs.existsSync(fullPath)) {
            warn(`routeRegistration.js:${reg.line} 路由文件不存在: ${routeFile}`);
            continue;
        }

        // 检查ROUTE_PREFIXES中是否有对应条目
        const prefixEntry = ROUTE_PREFIXES[routeFile];
        if (prefixEntry === undefined) {
            warn(`apiContractRoutePrefixes.js缺少: ${routeFile} → ${reg.mountPath}`);
        }
    }

    console.log('\n=== R2: ROUTE_PREFIXES多余条目检查 ===');
    let orphanCount = 0;
    for (const [file, prefix] of Object.entries(ROUTE_PREFIXES)) {
        const fullPath = path.join(ROOT, file);
        if (!fs.existsSync(fullPath)) {
            warn(`apiContractRoutePrefixes.js中${file}文件不存在（废弃条目）`);
            orphanCount++;
        }
    }
    if (orphanCount === 0) {
        ok('ROUTE_PREFIXES无废弃条目');
    }

    console.log('\n=== R3: 路由文件存在性检查 ===');
    let missingCount = 0;
    for (const reg of registrations) {
        let routeFile = null;
        if (reg.routeVar === 'lazyRoute' && reg.routeFileHint) {
            routeFile = normalizeRouteFile(reg.routeFileHint);
        } else if (reg.routeVar === 'require' && reg.routeFileHint) {
            routeFile = normalizeRouteFile(reg.routeFileHint);
        } else if (reg.routeVar) {
            routeFile = inferRouteFile(reg.routeVar);
        }

        if (!routeFile) {
            if (reg.routeVar === null && reg.rawLine.includes('requireFeature')) continue;
            continue; // 已在R1中warn
        }

        const fullPath = path.join(ROOT, routeFile);
        if (!fs.existsSync(fullPath)) {
            error(`routeRegistration.js:${reg.line} 路由文件不存在: ${routeFile}`);
            missingCount++;
        }
    }
    if (missingCount === 0) {
        ok('所有路由文件都存在');
    }

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.log('❌ 存在错误 — 路由注册配置不一致');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  存在警告');
    } else {
        console.log('✅ 校验通过 — 路由注册配置一致');
    }
}

main();
