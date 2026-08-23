/**
 * configSyncCheck.test.js — Pipeline配置同步自动校验测试
 */
const { checkPipelineConfigSync } = require('../../server/services/pipeline/configSyncCheck');

describe('Pipeline配置同步校验', () => {
    test('checkPipelineConfigSync应返回ok级别（当前配置应一致）', () => {
        const result = checkPipelineConfigSync();
        expect(result).toBeDefined();
        expect(result.level).toMatch(/^(ok|warning|critical)$/);
        expect(result.message).toBeDefined();
        expect(result.details).toBeInstanceOf(Array);
    });

    test('YAML契约应覆盖所有STEP_ORDER步骤', () => {
        const result = checkPipelineConfigSync();
        // 不应有"无YAML契约定义"的warning
        const missingYaml = result.details.filter(d => d.includes('无YAML契约定义'));
        expect(missingYaml).toHaveLength(0);
    });

    test('REQUIRED_OUTPUT_FIELDS的步骤应在STEP_ORDER中', () => {
        const result = checkPipelineConfigSync();
        const missingInOrder = result.details.filter(d => d.includes('不在STEP_ORDER中'));
        expect(missingInOrder).toHaveLength(0);
    });

    test('MIN_WORD_COUNT应小于MAX_WORD_COUNT', () => {
        const result = checkPipelineConfigSync();
        const wordCountIssue = result.details.filter(d => d.includes('MIN_WORD_COUNT'));
        expect(wordCountIssue).toHaveLength(0);
    });

    test('TERMINAL_STATUSES不应为空', () => {
        const result = checkPipelineConfigSync();
        const terminalIssue = result.details.filter(d => d.includes('TERMINAL_STATUSES为空'));
        expect(terminalIssue).toHaveLength(0);
    });

    test('校验结果应包含YAML契约统计信息', () => {
        const result = checkPipelineConfigSync();
        expect(result.message).toMatch(/YAML契约.*agents=\d+\/\d+/);
    });
});
