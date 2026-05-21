const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let errors = 0;
let warnings = 0;
let checks = 0;

function fail(msg) {
    console.error(`  ❌ FAIL: ${msg}`);
    errors++;
}

function warn(msg) {
    console.warn(`  ⚠️  WARN: ${msg}`);
    warnings++;
}

function pass(msg) {
    console.log(`  ✅ PASS: ${msg}`);
}

function section(title) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'═'.repeat(60)}`);
}

function readFile(relPath) {
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) return null;
    return fs.readFileSync(abs, 'utf-8');
}

function readDir(relPath) {
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs);
}

section('1. 存储层安全检查');

checks++;
const jsonStore = readFile('server/db/jsonStore.js');
if (jsonStore) {
    if (jsonStore.includes('acquireLock') && jsonStore.includes('releaseLock')) {
        pass('jsonStore.js 有写锁机制 (acquireLock/releaseLock)');
    } else {
        fail('jsonStore.js 缺少写锁机制！并发写入会导致数据损坏');
    }
    if (jsonStore.includes('validateId')) {
        pass('jsonStore.js 有ID验证 (validateId)');
    } else {
        fail('jsonStore.js 缺少ID验证！路径穿越风险');
    }
    if (jsonStore.includes('.tmp.') && jsonStore.includes('renameSync')) {
        pass('jsonStore.js 使用原子写入 (tmp+rename)');
    } else {
        warn('jsonStore.js 未使用原子写入模式');
    }
    if (jsonStore.includes('JSON.parse(verifyContent)')) {
        pass('jsonStore.js 写后验证JSON完整性');
    } else {
        fail('jsonStore.js 缺少写后验证！可能写入损坏的JSON');
    }
} else {
    fail('jsonStore.js 文件不存在');
}

checks++;
const dbStore = readFile('server/db/store.js');
if (dbStore) {
    const valueInjectionPatterns = [
        /WHERE.*\$\{.*(?!table)\}/,
        /WHERE.*'\s*\+\s*(?!table)/,
        /VALUES.*\$\{/,
        /SET.*\$\{/,
    ];
    let hasValueInjection = false;
    for (const pattern of valueInjectionPatterns) {
        if (pattern.test(dbStore)) {
            hasValueInjection = true;
            break;
        }
    }
    const usesPlaceholders = dbStore.includes('?,') || dbStore.includes('?)');
    if (hasValueInjection) {
        fail('SQLite store 存在SQL值拼接！SQL注入风险');
    } else if (usesPlaceholders) {
        pass('SQLite store 使用参数化查询（?占位符）');
    } else {
        warn('SQLite store 需人工检查是否使用参数化查询');
    }
} else {
    warn('SQLite store.js 文件不存在（可能未启用SQLite后端）');
}

checks++;
const database = readFile('server/db/database.js');
if (database) {
    if (database.includes('stmt.bind(params)') || database.includes('?, ?')) {
        pass('database.js 使用参数化查询');
    } else {
        warn('database.js 需检查是否使用参数化查询');
    }
    if (database.includes('PRAGMA foreign_keys = ON')) {
        pass('SQLite 启用了外键约束');
    } else {
        warn('SQLite 未启用外键约束');
    }
}

section('2. API输入验证检查');

checks++;
const routesDir = path.join(ROOT, 'server', 'routes');
const routeFiles = readDir('server/routes').filter(f => f.endsWith('.js'));

let routesWithValidation = 0;
let routesWithoutValidation = 0;
const missingValidationRoutes = [];

for (const rf of routeFiles) {
    const content = readFile(`server/routes/${rf}`);
    if (!content) continue;
    if (content.includes('express-validator') || content.includes('validationResult') || content.includes('param(') || content.includes('body(') || content.includes('check(') || content.includes('validators')) {
        routesWithValidation++;
    } else {
        routesWithoutValidation++;
        if (['projects.js', 'chapters.js', 'materials.js', 'pipeline.js'].includes(rf)) {
            missingValidationRoutes.push(rf);
        }
    }
}

if (missingValidationRoutes.length > 0) {
    warn(`核心路由缺少输入验证: ${missingValidationRoutes.join(', ')} (${routesWithoutValidation}个路由无验证)`);
} else {
    pass(`核心路由均有输入验证`);
}

section('3. 安全配置检查');

checks++;
const envExample = readFile('.env.example') || readFile('.env');
const indexJs = readFile('server/index.js');

if (indexJs) {
    if (indexJs.includes('ENCRYPTION_SECRET') && indexJs.includes('REQUEST_SECRET')) {
        pass('入口文件检查ENCRYPTION_SECRET和REQUEST_SECRET');
    } else {
        fail('入口文件缺少安全配置检查');
    }

    if (indexJs.includes('cors') && indexJs.includes('allowedOrigins')) {
        pass('CORS配置存在');
    } else {
        fail('CORS配置缺失');
    }

    if (indexJs.includes('express.json') && indexJs.includes('limit')) {
        pass('请求体大小限制存在');
    } else {
        warn('请求体大小限制可能缺失');
    }
}

checks++;
const authMiddleware = readFile('server/middleware/auth.js');
if (authMiddleware) {
    if (authMiddleware.includes('timingSafeEqual')) {
        pass('认证中间件使用timing-safe比较');
    } else {
        fail('认证中间件未使用timing-safe比较！易受时序攻击');
    }
    if (authMiddleware.includes('publicPaths')) {
        pass('认证中间件有公开路径白名单');
    } else {
        warn('认证中间件无公开路径白名单');
    }
}

section('4. 代码质量检查');

checks++;
const fullPipeline = readFile('server/services/pipeline/fullPipeline.js');
if (fullPipeline) {
    const emptyCatchCount = (fullPipeline.match(/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g) || []).length;
    const bareCatchCount = (fullPipeline.match(/catch\s*\(\s*_\s*\)/g) || []).length;
    if (bareCatchCount > 10) {
        warn(`fullPipeline.js 有${bareCatchCount}个空catch(_)，错误可能被吞掉`);
    } else {
        pass(`fullPipeline.js 空catch数量: ${bareCatchCount}`);
    }
}

checks++;
const materialManager = readFile('server/services/pipeline/steps/materialManager.js');
if (materialManager) {
    const intensityMapCount = (materialManager.match(/intensityMap/g) || []).length;
    if (intensityMapCount > 3) {
        warn(`materialManager.js intensityMap重复${intensityMapCount}次，应提取为通用函数`);
    } else {
        pass('materialManager.js intensityMap重复度可接受');
    }

    const lineCount = materialManager.split('\n').length;
    if (lineCount > 600) {
        warn(`materialManager.js ${lineCount}行，建议拆分为子模块`);
    } else {
        pass('materialManager.js 行数合理');
    }
}

checks++;
const infinitePipeline = readFile('server/services/pipeline/infinitePipeline.js');
if (infinitePipeline) {
    if (infinitePipeline.includes('INFINITE_PIPELINE_STATE') && infinitePipeline.includes('delete INFINITE_PIPELINE_STATE')) {
        pass('infinitePipeline.js 有内存状态清理机制');
    } else {
        warn('infinitePipeline.js 内存状态清理可能不完整');
    }
    if (infinitePipeline.includes('cleanupStalePipelineStates')) {
        pass('infinitePipeline.js 有僵尸进程清理');
    } else {
        warn('infinitePipeline.js 缺少僵尸进程清理');
    }
}

section('5. 基底素材保护检查');

checks++;
const jsonStoreContent = readFile('server/db/jsonStore.js');
const dbStoreContent = readFile('server/db/store.js');

let hasFoundationProtection = false;
if (jsonStoreContent && jsonStoreContent.includes('isFoundationMaterial') && jsonStoreContent.includes('Blocked deletion of foundation material')) {
    hasFoundationProtection = true;
}
if (dbStoreContent && dbStoreContent.includes('isFoundationMaterial') && dbStoreContent.includes('Blocked deletion of foundation material')) {
    hasFoundationProtection = true;
}
if (hasFoundationProtection) {
    pass('存储层有基底素材删除保护');
} else {
    fail('存储层缺少基底素材删除保护！isFoundationMaterial检查缺失');
}

checks++;
const materialsRoute = readFile('server/routes/materials.js');
if (materialsRoute) {
    if (materialsRoute.includes('isFoundationMaterial')) {
        pass('素材路由有基底素材删除保护');
    } else {
        warn('素材路由可能缺少基底素材删除保护');
    }
}

section('6. 数据目录完整性检查');

checks++;
const dataDir = path.join(ROOT, 'data');
const requiredDirs = ['projects', 'materials', 'chapters', 'reviews', 'dialects', 'speech-styles'];
const missingDirs = requiredDirs.filter(d => !fs.existsSync(path.join(dataDir, d)));
if (missingDirs.length > 0) {
    warn(`数据目录缺失: ${missingDirs.join(', ')}（首次运行会自动创建）`);
} else {
    pass('所有必需数据目录存在');
}

checks++;
const dialectFiles = readDir('data/dialects').filter(f => f.endsWith('.json'));
if (dialectFiles.length >= 15) {
    pass(`方言数据文件: ${dialectFiles.length}个`);
} else if (dialectFiles.length > 0) {
    warn(`方言数据文件偏少: ${dialectFiles.length}个（预期21个）`);
} else {
    fail('方言数据目录为空');
}

checks++;
const styleFiles = readDir('data/speech-styles').filter(f => f.endsWith('.json'));
if (styleFiles.length >= 10) {
    pass(`说话风格数据文件: ${styleFiles.length}个`);
} else if (styleFiles.length > 0) {
    warn(`说话风格数据文件偏少: ${styleFiles.length}个（预期14个）`);
} else {
    fail('说话风格数据目录为空');
}

section('7. 测试覆盖检查');

checks++;
const testDir = path.join(ROOT, 'tests');
if (fs.existsSync(testDir)) {
    const unitTests = readDir('tests/unit').filter(f => f.endsWith('.test.js'));
    const integrationTests = readDir('tests/integration').filter(f => f.endsWith('.test.js'));
    const coreTests = fs.existsSync(path.join(testDir, 'core.test.js')) ? 1 : 0;
    const totalTests = unitTests.length + integrationTests.length + coreTests;
    if (totalTests >= 10) {
        pass(`测试文件: ${totalTests}个 (unit:${unitTests.length} integration:${integrationTests.length} core:${coreTests})`);
    } else {
        warn(`测试文件偏少: ${totalTests}个，核心逻辑缺乏测试保护`);
    }
} else {
    fail('tests目录不存在！无任何测试覆盖');
}

checks++;
const packageJson = JSON.parse(readFile('package.json') || '{}');
if (packageJson.scripts && packageJson.scripts.test) {
    pass(`package.json 有test命令: ${packageJson.scripts.test}`);
} else {
    fail('package.json 缺少test命令');
}
if (packageJson.scripts && packageJson.scripts.check) {
    pass(`package.json 有check命令: ${packageJson.scripts.check}`);
} else {
    warn('package.json 缺少check命令（建议添加自检脚本）');
}

section('8. 类型同步检查（三处同步铁律）');

checks++;
const materialTypesConfig = readFile('server/config/materialTypes.js');
const materialsRouteContent = readFile('server/routes/materials.js');

if (materialTypesConfig) {
    const validTypesMatch = materialTypesConfig.match(/VALID_MATERIAL_TYPES\s*=\s*\[([\s\S]*?)\]/);
    if (validTypesMatch) {
        const typesInConfig = validTypesMatch[1].match(/'([^']+)'/g);
        if (typesInConfig && typesInConfig.length >= 28) {
            pass(`materialTypes.js 定义了${typesInConfig.length}种素材类型`);
        } else {
            warn(`materialTypes.js 素材类型数量: ${typesInConfig ? typesInConfig.length : 0}（预期28+）`);
        }
    }
}

if (materialsRouteContent) {
    if (materialsRouteContent.includes('MATERIAL_TYPES')) {
        pass('materials.js 路由引用了MATERIAL_TYPES');
    } else {
        warn('materials.js 路由可能硬编码了素材类型列表');
    }
}

section('9. IP直呼检查');

checks++;
const ipNames = ['灰太狼', '喜羊羊', '哆啦A梦', '路飞', '孙悟空', '七龙珠', '海贼王', '奥特曼', '恶魔果实', '仙豆', '竹蜻蜓', '念能力'];
let ipViolations = [];

const subplaneDir = path.join(dataDir, 'subplanes');
if (fs.existsSync(subplaneDir)) {
    const subplaneFiles = fs.readdirSync(subplaneDir).filter(f => f.endsWith('.json'));
    for (const sf of subplaneFiles) {
        const content = fs.readFileSync(path.join(subplaneDir, sf), 'utf-8');
        for (const ip of ipNames) {
            if (content.includes(ip)) {
                ipViolations.push(`${sf}: ${ip}`);
            }
        }
    }
}

if (ipViolations.length > 0) {
    fail(`次位面数据存在IP直呼: ${ipViolations.join('; ')}`);
} else {
    pass('次位面数据无IP直呼违规');
}

section('10. 主角名硬编码检查');

checks++;
let hardcodedProtagonistNames = [];
const pipelineFiles = ['server/services/pipeline/steps/materialManager.js', 'server/services/pipeline/fullPipeline.js'];
for (const pf of pipelineFiles) {
    const content = readFile(pf);
    if (!content) continue;
    if (content.includes('"沈渡"') || content.includes("'沈渡'") || content.includes('沈渡')) {
        if (!content.includes('protagonistName')) {
            hardcodedProtagonistNames.push(pf);
        }
    }
}

if (hardcodedProtagonistNames.length > 0) {
    fail(`主角名硬编码: ${hardcodedProtagonistNames.join(', ')}`);
} else {
    pass('无主角名硬编码');
}

section('汇总');

console.log(`\n  检查项: ${checks}`);
console.log(`  ❌ 失败: ${errors}`);
console.log(`  ⚠️  警告: ${warnings}`);
console.log(`  ✅ 通过: ${checks - errors - warnings}`);

if (errors > 0) {
    console.log(`\n  🚨 存在${errors}个必须修复的问题！运行 npm run check 确认修复。`);
    process.exit(1);
} else if (warnings > 0) {
    console.log(`\n  ⚡ 存在${warnings}个警告，建议修复。`);
    process.exit(0);
} else {
    console.log(`\n  🎉 所有检查通过！`);
    process.exit(0);
}
