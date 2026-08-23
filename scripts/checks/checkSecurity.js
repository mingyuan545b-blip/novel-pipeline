const { fail, warn, pass, section, readFile, addCheck } = require('./checkUtils');

function checkStorageSafety() {
    section('1. 存储层安全检查');

    addCheck();
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

    addCheck();
    const dbStore = readFile('server/db/store.js');
    if (dbStore) {
        const valueInjectionPatterns = [/WHERE.*\$\{.*(?!table)\}/, /WHERE.*'\s*\+\s*(?!table)/, /VALUES.*\$\{/, /SET.*\$\{/];
        let hasValueInjection = false;
        for (const pattern of valueInjectionPatterns) { if (pattern.test(dbStore)) { hasValueInjection = true; break; } }
        const usesPlaceholders = dbStore.includes('?,') || dbStore.includes('?)');
        if (hasValueInjection) { fail('SQLite store 存在SQL值拼接！SQL注入风险'); }
        else if (usesPlaceholders) { pass('SQLite store 使用参数化查询（?占位符）'); }
        else { warn('SQLite store 需人工检查是否使用参数化查询'); }
    } else {
        warn('SQLite store.js 文件不存在（可能未启用SQLite后端）');
    }

    addCheck();
    const database = readFile('server/db/database.js');
    if (database) {
        if (database.includes('stmt.bind(params)') || database.includes('?, ?')) { pass('database.js 使用参数化查询'); }
        else { warn('database.js 需检查是否使用参数化查询'); }
        if (database.includes('PRAGMA foreign_keys = ON')) { pass('SQLite 启用了外键约束'); }
        else { warn('SQLite 未启用外键约束'); }
    }
}

function checkApiValidation() {
    section('2. API输入验证检查');

    addCheck();
    const routeFiles = require('./checkUtils').readDir('server/routes').filter(f => f.endsWith('.js'));
    let routesWithValidation = 0, routesWithoutValidation = 0;
    const missingValidationRoutes = [];

    for (const rf of routeFiles) {
        const content = readFile(`server/routes/${rf}`);
        if (!content) continue;
        if (content.includes('express-validator') || content.includes('validationResult') || content.includes('param(') || content.includes('body(') || content.includes('check(') || content.includes('validators')) {
            routesWithValidation++;
        } else {
            routesWithoutValidation++;
            if (['projects.js', 'chapters.js', 'materials.js', 'pipeline.js'].includes(rf)) { missingValidationRoutes.push(rf); }
        }
    }

    if (missingValidationRoutes.length > 0) { warn(`核心路由缺少输入验证: ${missingValidationRoutes.join(', ')} (${routesWithoutValidation}个路由无验证)`); }
    else { pass('核心路由均有输入验证'); }
}

function checkSecurityConfig() {
    section('3. 安全配置检查');

    addCheck();
    const indexJs = readFile('server/index.js');
    if (indexJs) {
        if (indexJs.includes('ENCRYPTION_SECRET') && indexJs.includes('REQUEST_SECRET')) { pass('入口文件检查ENCRYPTION_SECRET和REQUEST_SECRET'); }
        else { fail('入口文件缺少安全配置检查'); }
        if (indexJs.includes('cors') && indexJs.includes('allowedOrigins')) { pass('CORS配置存在'); }
        else { fail('CORS配置缺失'); }
        if (indexJs.includes('express.json') && indexJs.includes('limit')) { pass('请求体大小限制存在'); }
        else { warn('请求体大小限制可能缺失'); }
    }

    addCheck();
    const authMiddleware = readFile('server/middleware/auth.js');
    if (authMiddleware) {
        if (authMiddleware.includes('timingSafeEqual')) { pass('认证中间件使用timing-safe比较'); }
        else { fail('认证中间件未使用timing-safe比较！易受时序攻击'); }
        if (authMiddleware.includes('publicPaths')) { pass('认证中间件有公开路径白名单'); }
        else { warn('认证中间件无公开路径白名单'); }
    }
}

module.exports = { checkStorageSafety, checkApiValidation, checkSecurityConfig };
