/**
 * verifyModuleSwitchDefaults.js — Pipeline 模块开关矩阵门禁
 *
 * 背景（F2 / P0-A，见 docs/worklog/2026-10-17-假成果审查-问题统计.md）：
 * - 模块钩子靠 pipelineModuleRegistry 的 offValue 判断启用与否；若 offValue 被写成"开启语义"的值
 *   （如 'on'），getModuleConfig 在项目未配置时返回该值，isModuleEnabled = (config !== offValue) = false
 *   → 模块被永久禁用且无任何门禁报警（16 项目/137 章 0 数据）。
 * - 新项目若不写入非 off 的默认档位，模块同样永不触发。
 *
 * 本门禁遍历所有已注册模块，断言：
 *   1) offValue 语义正确（=== 'off'）；
 *   2) 每个模块的 configKey 都进入项目创建默认值（config/moduleDefaults.js），且默认值 ≠ offValue。
 *
 * 用法：node scripts/verifyModuleSwitchDefaults.js   （CI / pre-commit 调用，失败 exit 1）
 */
'use strict';

const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');

// 允许服务端绝对 require（shared/logger 等）
process.env.NODE_PATH = [SERVER, process.env.NODE_PATH || ''].filter(Boolean).join(path.delimiter);
require('module').Module._initPaths();

let errorCount = 0;
let warnCount = 0;
const error = (m) => { console.error(`[ERROR] ${m}`); errorCount++; };
const warn = (m) => { console.warn(`[WARN]  ${m}`); warnCount++; };
const ok = (m) => console.log(`[OK]    ${m}`);

function main() {
    const registry = require(path.join(SERVER, 'services/pipelineModuleRegistry'));
    const { registerModules } = require(path.join(SERVER, 'startup'));
    const { DEFAULT_MODULE_SETTINGS } = require(path.join(SERVER, 'config/moduleDefaults'));

    registerModules();
    const meta = registry.getRegisteredModuleMeta();

    console.log('========================================');
    console.log('模块开关矩阵校验（offValue 语义 + 默认值覆盖）');
    console.log('========================================');

    if (meta.length === 0) {
        error('registry 为空——未注册任何 pipeline 模块（注册链断裂）');
    }

    const usedKeys = new Set();
    for (const m of meta) {
        usedKeys.add(m.configKey);
        if (m.offValue !== 'off') {
            error(`模块 ${m.id}: offValue='${m.offValue}' 破坏关闭语义（必须 'off'）→ isModuleEnabled 会误判为禁用`);
        } else {
            ok(`模块 ${m.id}: offValue='off' 语义正确`);
        }
        if (!(m.configKey in DEFAULT_MODULE_SETTINGS)) {
            error(`模块 ${m.id}: configKey '${m.configKey}' 未进入项目创建默认值 → 新项目永不启用（P0-A/F2 复发）`);
        } else if (DEFAULT_MODULE_SETTINGS[m.configKey] === m.offValue) {
            error(`模块 ${m.id}: 默认值 ${m.configKey}='${DEFAULT_MODULE_SETTINGS[m.configKey]}' 等于 offValue → 默认禁用（F2 复发）`);
        } else {
            ok(`模块 ${m.id}: 默认 ${m.configKey}='${DEFAULT_MODULE_SETTINGS[m.configKey]}'（≠off）`);
        }
    }

    for (const k of Object.keys(DEFAULT_MODULE_SETTINGS)) {
        if (!usedKeys.has(k)) warn(`默认值 '${k}' 不对应任何已注册模块（可能残留/漂移）`);
    }

    console.log('========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');
    if (errorCount > 0) {
        console.error('\n❌ 模块开关矩阵校验失败');
        process.exit(1);
    }
    console.log('\n✅ 模块开关矩阵校验通过');
    process.exit(0);
}

main();
