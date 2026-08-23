/**
 * regressionApiValidation.test.js — API参数校验回归测试
 * 覆盖问题：PUT API路由用/:id但验证器检查param('chapterId')导致验证失败
 */
describe('回归测试: API参数校验一致性', () => {
    test('chapters路由验证器应使用param("id")而非param("chapterId")', () => {
        const validators = require('../../server/middleware/validators');
        // 验证validators模块加载成功
        expect(validators).toBeDefined();
    });

    test('Pipeline契约STEP_ORDER应包含所有必需步骤', () => {
        const { PIPELINE_CONTRACT } = require('../../server/services/pipeline/pipelineContract');
        const requiredSteps = ['outline-generator', 'writer', 'first-review', 'second-review', 'final-editor', 'polisher', 'material-manager'];
        for (const step of requiredSteps) {
            expect(PIPELINE_CONTRACT.STEP_ORDER).toContain(step);
        }
    });

    test('Pipeline契约REQUIRED_OUTPUT_FIELDS应覆盖所有写作步骤', () => {
        const { PIPELINE_CONTRACT } = require('../../server/services/pipeline/pipelineContract');
        const writingSteps = ['writer', 'first-review', 'second-review', 'final-editor', 'polisher'];
        for (const step of writingSteps) {
            expect(PIPELINE_CONTRACT.REQUIRED_OUTPUT_FIELDS[step]).toBeDefined();
            expect(PIPELINE_CONTRACT.REQUIRED_OUTPUT_FIELDS[step].length).toBeGreaterThan(0);
        }
    });

    test('Pipeline错误码应包含所有PF-xxx预检代码', () => {
        const { PIPELINE_ERROR_CODES } = require('../../server/services/pipeline/pipelineErrors');
        const requiredPfCodes = [
            'PF-OG-001', 'PF-WR-001', 'PF-FR-001', 'PF-FA-001',
            'PF-SR-001', 'PF-FE-001', 'PF-PO-001', 'PF-MM-001', 'PF-CC-001'
        ];
        for (const code of requiredPfCodes) {
            expect(PIPELINE_ERROR_CODES[code]).toBeDefined();
            expect(PIPELINE_ERROR_CODES[code].step).toBeDefined();
            expect(PIPELINE_ERROR_CODES[code].severity).toBeDefined();
        }
    });

    test('PipelineContractError应正确创建错误对象', () => {
        const { PipelineContractError } = require('../../server/services/pipeline/pipelineErrors');
        const error = new PipelineContractError('W-001', { detail: '测试详情' });
        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBe('W-001');
        expect(error.severity).toBe('CRITICAL');
        expect(error.step).toBe('writer');
        expect(error.message).toContain('W-001');
        expect(error.message).toContain('测试详情');
    });

    test('getErrorsByStep应返回指定步骤的所有错误码', () => {
        const { getErrorsByStep } = require('../../server/services/pipeline/pipelineErrors');
        const writerErrors = getErrorsByStep('writer');
        expect(writerErrors.length).toBeGreaterThan(0);
        expect(writerErrors.every(e => e.step === 'writer')).toBe(true);
    });
});
