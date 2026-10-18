/**
 * 模块开关矩阵门禁单测（A1 / C2）
 * 防 F2/P0-A 复发：offValue 写反或新项目默认值缺失 → 模块被永久禁用且无门禁报警。
 * 见 docs/worklog/2026-10-17-假成果审查-问题统计.md
 */
const { registerModules } = require('../../server/startup');
const registry = require('../../server/services/pipelineModuleRegistry');
const { DEFAULT_MODULE_SETTINGS } = require('../../server/config/moduleDefaults');

describe('Pipeline 模块开关矩阵', () => {
    beforeAll(() => { registerModules(); });

    test('已注册模块非空（注册链未断裂）', () => {
        expect(registry.getRegisteredModuleMeta().length).toBeGreaterThan(0);
    });

    test('每个模块 offValue 语义为 off（禁止写成 on 等开启语义）', () => {
        for (const m of registry.getRegisteredModuleMeta()) {
            expect(m.offValue).toBe('off');
        }
    });

    test('每个模块 configKey 都有非 off 的项目创建默认值', () => {
        for (const m of registry.getRegisteredModuleMeta()) {
            expect(DEFAULT_MODULE_SETTINGS).toHaveProperty(m.configKey);
            expect(DEFAULT_MODULE_SETTINGS[m.configKey]).not.toBe(m.offValue);
        }
    });

    test('F2 修复锚点：constraint-feedback offValue=off 且默认档位=basic', () => {
        const meta = registry.getRegisteredModuleMeta().find(m => m.id === 'constraint-feedback');
        expect(meta).toBeTruthy();
        expect(meta.offValue).toBe('off');
        expect(meta.configKey).toBe('constraintFeedback');
        expect(DEFAULT_MODULE_SETTINGS.constraintFeedback).toBe('basic');
    });
});
