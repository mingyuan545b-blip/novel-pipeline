/**
 * CI脚本 - 路由参数名一致性校验
 *
 * 陷阱：validators.js的chapterIdParam期望param('chapterId')，
 * 但路由用 router.post('/:id/reset', chapterIdParam)，参数名不匹配导致400
 *
 * 本脚本扫描所有 router.xxx('/:paramName', validator) 路由，
 * 对照验证器的 param('paramName') 是否一致
 *
 * 用法：node scripts/audit-route-param-consistency.js
 * 不一致 exit(1)，CI拦截
 */
const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'server', 'routes');
const VALIDATORS_FILE = path.join(__dirname, '..', 'server', 'middleware', 'validators.js');

// 提取路由参数名
function extractRouteParams(content) {
    const matches = [];
    // 匹配 router.get/post/put/delete('/:paramName/...' or '/:paramName')
    const routeRegex = /router\.(?:get|post|put|delete)\s*\(\s*['"`]\/:([^/'"`\s]+)/g;
    let match;
    while ((match = routeRegex.exec(content)) !== null) {
        matches.push(match[1]);
    }
    return matches;
}

// 提取验证器param名
function extractValidatorParams(content) {
    const matches = [];
    // 匹配 param('paramName')
    const paramRegex = /param\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = paramRegex.exec(content)) !== null) {
        matches.push(match[1]);
    }
    return matches;
}

function walkDir(dir, callback) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkDir(fullPath, callback);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            callback(fullPath);
        }
    }
}

function main() {
    const issues = [];

    // 1. 扫描所有路由文件的 router.xxx('/:paramName', validator)
    walkDir(ROUTES_DIR, (filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        const routeParams = extractRouteParams(content);

        if (routeParams.length === 0) return;

        // 查该文件import了哪些验证器
        const validatorImportMatch = content.match(/require\s*\(\s*['"`][^'"`]*validators['"`]\s*\)\s*;?\s*(?:const|let|var)\s*{([^}]+)}/);
        if (!validatorImportMatch) return;

        const importedValidators = validatorImportMatch[1]
            .split(',')
            .map(v => v.trim())
            .filter(v => v);

        // 查这些验证器在validators.js里用的param名
        const validatorsContent = fs.readFileSync(VALIDATORS_FILE, 'utf8');

        // 简单校验：如果路由用'/:id'，验证器必须用param('id')
        // 如果路由用'/:chapterId'，验证器必须用param('chapterId')
        for (const routeParam of routeParams) {
            // 查该路由文件里所有验证器的param名
            const routeFileValidatorParams = extractValidatorParams(content);

            // 如果路由参数名不在验证器param名里，且文件用了验证器
            if (!routeFileValidatorParams.includes(routeParam) && importedValidators.length > 0) {
                // 查validators.js里这些验证器用的param名
                for (const vName of importedValidators) {
                    // 查 vName = [ ... param('xxx') ... ] 的定义
                    const vDefRegex = new RegExp(`const\\s+${vName}\\s*=\\s*\\[s*([\\s\\S]*?)\\]`);
                    const vDefMatch = validatorsContent.match(vDefRegex);
                    if (vDefMatch) {
                        const vParams = extractValidatorParams(vDefMatch[1]);
                        if (vParams.length > 0 && !vParams.includes(routeParam)) {
                            issues.push({
                                file: path.relative(process.cwd(), filePath),
                                routeParam: `/:${routeParam}`,
                                validatorParam: `param('${vParams[0]}')`,
                                validator: vName,
                                message: `路由用 /:${routeParam} 但验证器 ${vName} 用 param('${vParams[0]}')`
                            });
                        }
                    }
                }
            }
        }
    });

    // 2. 输出结果
    if (issues.length > 0) {
        console.error('\n[ROUTE-PARAM-AUDIT] 发现路由参数名不一致:');
        for (const issue of issues) {
            console.error(`  ❌ ${issue.file}`);
            console.error(`     ${issue.message}`);
            console.error(`     修复：验证器改为 param('${issue.routeParam.replace('/:','')}')`);
        }
        console.error(`\n共 ${issues.length} 处不一致\n`);
        process.exit(1);
    } else {
        console.log('[ROUTE-PARAM-AUDIT] 路由参数名一致性校验通过');
    }
}

main();
