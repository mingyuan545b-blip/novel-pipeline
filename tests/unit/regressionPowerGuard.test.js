/**
 * regressionPowerGuard.test.js — powerGuard导出兼容性回归测试
 * 覆盖问题：powerGuard.js导出对象但3个文件用const { powerGuard }解构导入
 */
describe('回归测试: powerGuard导出兼容性', () => {
    test('powerGuard应同时支持直接导入和解构导入', () => {
        const powerGuardModule = require('../../server/services/powerGuard');

        // 直接导入的函数应存在
        expect(powerGuardModule.checkPowerConsistency).toBeDefined();
        expect(powerGuardModule.getPowerCurve).toBeDefined();
        expect(powerGuardModule.generatePowerCheckHint).toBeDefined();

        // 解构导入的powerGuard属性应存在且为对象
        expect(powerGuardModule.powerGuard).toBeDefined();
        expect(typeof powerGuardModule.powerGuard).toBe('object');

        // 解构导入的powerGuard应包含所有函数
        expect(powerGuardModule.powerGuard.checkPowerConsistency).toBeDefined();
        expect(powerGuardModule.powerGuard.getPowerCurve).toBeDefined();
        expect(powerGuardModule.powerGuard.generatePowerCheckHint).toBeDefined();
    });

    test('const { powerGuard }解构导入后应能调用generatePowerCheckHint', () => {
        const { powerGuard } = require('../../server/services/powerGuard');
        expect(powerGuard).toBeDefined();
        expect(typeof powerGuard.generatePowerCheckHint).toBe('function');
    });

    test('dataContextDelegates应能正确加载powerGuard', () => {
        // 验证dataContextDelegates.js中的解构导入不会导致undefined
        const delegates = require('../../server/services/dataContextDelegates');
        expect(delegates).toBeDefined();
    });

    test('powerGuard.generatePowerCheckHint应返回字符串或null', async () => {
        const { powerGuard } = require('../../server/services/powerGuard');
        const result = await powerGuard.generatePowerCheckHint('test-project-id', 1);
        // 返回值应为字符串（空字符串或提示文本）
        expect(typeof result).toBe('string');
    });
});
