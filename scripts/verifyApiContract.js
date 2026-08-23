/**
 * verifyApiContract - 前后端API契约自动化检测工具
 *
 * 职责：扫描前端所有API调用 + 后端所有路由定义，自动比对
 *       发现前端调用但后端无对应路由的"断裂"，立即报错
 *
 * 检查项：
 *   A1: 前端API调用端点提取（client/src/services/api/*.js）
 *   A2: 后端路由端点提取（server/routes/ 目录下所有JS文件）
 *   A3: 前后端契约比对（前端每个调用必须能在后端找到匹配路由）
 *
 * 使用方式：node scripts/verifyApiContract.js
 * 加入ci:check，防止前后端API断裂
 */

const { extractFrontendCalls, extractBackendRoutes, compareContracts } = require('./apiContractExtractor');

let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`  ❌ [ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`  ⚠️  [WARN] ${msg}`); warnCount++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

function main() {
    console.log('========================================');
    console.log('前后端API契约一致性校验（A1-A3）');
    console.log('========================================');

    console.log('\n=== A1: 前端API调用端点提取 ===');
    const frontendCalls = extractFrontendCalls();
    ok(`提取前端API调用: ${frontendCalls.length}个`);

    console.log('\n=== A2: 后端路由端点提取 ===');
    const backendRoutes = extractBackendRoutes();
    ok(`提取后端路由定义: ${backendRoutes.length}个`);

    console.log('\n=== A3: 前后端契约比对 ===');
    const brokenCalls = compareContracts(frontendCalls, backendRoutes);

    if (brokenCalls.length === 0) {
        ok('所有前端API调用都有对应的后端路由');
    } else {
        for (const call of brokenCalls) {
            error(`${call.file}:${call.line} ${call.method} ${call.path} — 后端无对应路由`);
        }
    }

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.log('❌ 存在前后端API断裂 — 必须修复');
        process.exit(1);
    } else if (warnCount > 0) {
        console.log('⚠️  存在警告');
    } else {
        console.log('✅ 校验通过 — 前后端API契约一致');
    }
}

main();
