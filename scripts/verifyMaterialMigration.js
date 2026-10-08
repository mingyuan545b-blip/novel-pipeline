/**
 * verifyMaterialMigration.js — 素材构建器迁移完整性校验
 * 防止虚假打标：所有Agent必须真实使用materialInjector，不能只改注释不改代码
 *
 * 校验规则：
 * 1. 生产代码无 materialSectionBuilder 的 require 引用（防虚假打标）
 * 2. materialInjector 导出完整（injectMaterials + buildCharacterSection + buildCharacterBriefSection）
 * 3. SECTION_BUILDERS 运行时验证：注册的每个type都有对应builder函数（防P0 ReferenceError）
 * 4. 所有Agent文件必须调用 scheduleMaterials（防绕过调度器）
 * 5. 所有Agent文件的素材段必须通过 materialInjector 或专用 formatter 处理（防自己拼装）
 * 6. materialSectionBuilder.js 必须标记 @deprecated
 *
 * 用法：node scripts/verifyMaterialMigration.js
 * 退出码：0=通过，1=失败（应作为CI门禁）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { AGENT_FILES, ALLOWED_MATERIAL_SOURCES, KNOWN_NOT_MIGRATED } = require('./verifyMaterialMigrationConfig');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');

let errorCount = 0;
let warnCount = 0;

function error(msg) { console.error(`[ERROR] ${msg}`); errorCount++; }
function warn(msg) { console.warn(`[WARN]  ${msg}`); warnCount++; }
function ok(msg) { console.log(`[OK]    ${msg}`); }

function readFile(relPath) {
    const fullPath = path.join(SERVER, relPath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath, 'utf8');
}

/** 递归扫描目录，返回所有.js文件相对路径 */
function scanJsFiles(dirRelPath) {
    const result = [];
    const fullPath = path.join(SERVER, dirRelPath);
    if (!fs.existsSync(fullPath)) return result;
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    for (const entry of entries) {
        const relPath = path.join(dirRelPath, entry.name);
        if (entry.isDirectory()) {
            result.push(...scanJsFiles(relPath));
        } else if (entry.name.endsWith('.js')) {
            result.push(relPath);
        }
    }
    return result;
}

/** 校验1：生产代码无 materialSectionBuilder 的 require 引用 */
function checkNoMaterialSectionBuilderRequire() {
    console.log('\n=== 校验1：生产代码无 materialSectionBuilder require 引用 ===');
    const allFiles = scanJsFiles('.');
    let violations = 0;
    for (const relPath of allFiles) {
        const content = readFile(relPath);
        if (!content) continue;
        if (/require\(['"][^'"]*materialSectionBuilder['"]\)/.test(content)) {
            error(`${relPath} 仍 require materialSectionBuilder — 虚假打标！`);
            violations++;
        }
    }
    if (violations === 0) ok('生产代码无 materialSectionBuilder require 引用');
}

/** 校验2：materialInjector 导出完整 */
function checkMaterialInjectorExports() {
    console.log('\n=== 校验2：materialInjector 导出完整 ===');
    const content = readFile('services/pipeline/materialInjector.js');
    if (!content) { error('无法读取 materialInjector.js'); return; }
    const required = ['injectMaterials', 'SECTION_BUILDERS', 'buildCharacterSection', 'buildCharacterBriefSection'];
    for (const name of required) {
        if (content.includes(name)) ok(`materialInjector 导出 ${name}`);
        else error(`materialInjector 缺少导出 ${name}`);
    }
}

/** 校验3：SECTION_BUILDERS 运行时验证（防P0 ReferenceError） */
function checkSectionBuildersRuntime() {
    console.log('\n=== 校验3：SECTION_BUILDERS 运行时验证 ===');
    try {
        const { SECTION_BUILDERS } = require(path.join(SERVER, 'services/pipeline/materialInjector.js'));
        const types = Object.keys(SECTION_BUILDERS);
        if (types.length === 0) { error('SECTION_BUILDERS 为空'); return; }
        for (const type of types) {
            if (typeof SECTION_BUILDERS[type] !== 'function') {
                error(`SECTION_BUILDERS['${type}'] 不是函数 — P0 ReferenceError 风险！`);
            }
        }
        ok(`SECTION_BUILDERS 运行时验证通过（${types.length} 个构建器均为函数）`);
    } catch (e) {
        error(`materialInjector require 失败: ${e.message} — P0 运行时bug！`);
    }
}

/**
 * 校验4：所有 Agent 文件必须通过**统一装配入口**取素材
 *
 * 修正历史（2026-10-07）：装配入口在 P1-4c/S6 已从"直接调 scheduleMaterials"
 * 收敛为 materialStateAssembler.assembleMaterialState（单点装配 + 记账）。
 * 本校验器当时未同步，导致 6 个已合规的 agent 被误报为"绕过统一调度器"，ci:check 长期假红。
 * 现在两个签名都接受（assembleMaterialState 为首选），真正的绕过程序由
 * scripts/verifyMaterialAssemblyEntry.js 按 agent 名单逐一断言。
 */
function checkAgentsUseScheduler() {
    console.log('\n=== 校验4：所有Agent文件必须通过统一装配入口取素材 ===');
    for (const relPath of AGENT_FILES) {
        const content = readFile(relPath);
        if (!content) { error(`无法读取 ${relPath}`); continue; }
        const fileName = path.basename(relPath);
        if (content.includes('assembleMaterialState')) ok(`${fileName} 走单点装配入口 assembleMaterialState`);
        else if (content.includes('scheduleMaterials')) ok(`${fileName} 调用 scheduleMaterials`);
        else error(`${fileName} 未走统一装配入口（assembleMaterialState/scheduleMaterials）— 可能绕过统一调度器！`);
    }
}

/** 校验5：Agent素材段必须通过 materialInjector 或专用 formatter 处理 */
function checkAgentsUseInjector() {
    console.log('\n=== 校验5：Agent素材段通过 materialInjector 或专用 formatter 处理 ===');
    for (const relPath of AGENT_FILES) {
        const content = readFile(relPath);
        if (!content) continue;
        const fileName = path.basename(relPath);
        const usesAllowedSource = ALLOWED_MATERIAL_SOURCES.some(src => content.includes(src));
        if (usesAllowedSource) {
            ok(`${fileName} 使用允许的素材构建来源`);
        } else {
            const known = KNOWN_NOT_MIGRATED.find(k => k.file === relPath);
            if (known) {
                warn(`${fileName} 未使用materialInjector — 已知待迁移（${known.phase}）：${known.reason}`);
            } else {
                error(`${fileName} 未使用 materialInjector/formatter — 可能自己拼装素材段！`);
            }
        }
    }
}

/** 校验6：materialSectionBuilder.js 必须标记 @deprecated */
function checkMaterialSectionBuilderDeprecated() {
    console.log('\n=== 校验6：materialSectionBuilder.js 标记 @deprecated ===');
    const content = readFile('services/pipeline/steps/materialSectionBuilder.js');
    if (!content) { warn('materialSectionBuilder.js 不存在（已删除则无需校验）'); return; }
    if (content.includes('@deprecated')) ok('materialSectionBuilder.js 已标记 @deprecated');
    else error('materialSectionBuilder.js 未标记 @deprecated — 可能被误引用！');
}

function main() {
    console.log('========================================');
    console.log('素材构建器迁移完整性校验');
    console.log('========================================');
    checkNoMaterialSectionBuilderRequire();
    checkMaterialInjectorExports();
    checkSectionBuildersRuntime();
    checkAgentsUseScheduler();
    checkAgentsUseInjector();
    checkMaterialSectionBuilderDeprecated();

    // 校验7-8：声明式差异配置（从verifyDeclarativeDifferences.js引入）
    const { run: runDeclarativeChecks } = require('./verifyDeclarativeDifferences');
    const declResult = runDeclarativeChecks();
    errorCount += declResult.errorCount;
    warnCount += declResult.warnCount;

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');
    if (errorCount > 0) {
        console.error('\n❌ 校验失败 — 存在虚假打标或迁移不完整！');
        process.exit(1);
    } else {
        console.log('\n✅ 校验通过 — 素材构建器迁移完整性正常');
        process.exit(0);
    }
}

main();
