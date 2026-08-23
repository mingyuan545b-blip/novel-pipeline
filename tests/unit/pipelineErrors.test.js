/**
 * pipelineErrors tests - 契约错误码系统
 */
const { PIPELINE_ERROR_CODES, PipelineContractError, getErrorDef, getErrorsByStep } = require('../../server/services/pipeline/pipelineErrors');

describe('pipelineErrors', () => {
    describe('PIPELINE_ERROR_CODES', () => {
        it('should have error codes for all pipeline steps', () => {
            const steps = new Set(Object.values(PIPELINE_ERROR_CODES).map(d => d.step));
            expect(steps.has('writer')).toBe(true);
            expect(steps.has('review')).toBe(true);
            expect(steps.has('material')).toBe(true);
            expect(steps.has('general')).toBe(true);
        });

        it('should have required fields for each error code', () => {
            for (const [code, def] of Object.entries(PIPELINE_ERROR_CODES)) {
                expect(def.severity).toBeDefined();
                expect(def.message).toBeDefined();
                expect(def.step).toBeDefined();
                expect(def.cause).toBeDefined();
                expect(def.fix).toBeDefined();
            }
        });
    });

    describe('PipelineContractError', () => {
        it('should create error with valid code', () => {
            const err = new PipelineContractError('W-001');
            expect(err.code).toBe('W-001');
            expect(err.severity).toBe('CRITICAL');
            expect(err.step).toBe('writer');
            expect(err.message).toContain('W-001');
            expect(err.message).toContain('素材数量为0');
            expect(err.fixGuide).toBeDefined();
        });

        it('should include context detail in message', () => {
            const err = new PipelineContractError('R-001', { detail: 'chapter ch-123' });
            expect(err.message).toContain('chapter ch-123');
            expect(err.context.detail).toBe('chapter ch-123');
        });

        it('should throw for unknown error code', () => {
            expect(() => new PipelineContractError('INVALID')).toThrow('Unknown pipeline error code');
        });
    });

    describe('getErrorDef', () => {
        it('should return definition for valid code', () => {
            const def = getErrorDef('W-001');
            expect(def).toBeDefined();
            expect(def.step).toBe('writer');
        });

        it('should return null for unknown code', () => {
            expect(getErrorDef('NONEXISTENT')).toBeNull();
        });
    });

    describe('getErrorsByStep', () => {
        it('should return all writer errors', () => {
            const writerErrors = getErrorsByStep('writer');
            expect(writerErrors.length).toBeGreaterThan(0);
            writerErrors.forEach(e => expect(e.step).toBe('writer'));
        });

        it('should return empty array for unknown step', () => {
            expect(getErrorsByStep('nonexistent')).toEqual([]);
        });

        it('should include code in each result', () => {
            const errors = getErrorsByStep('review');
            errors.forEach(e => expect(e.code).toBeDefined());
        });
    });
});
