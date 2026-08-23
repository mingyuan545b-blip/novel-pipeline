/**
 * StepRegistry tests - Pipeline步骤注册表
 */
const StepRegistry = require('../../server/core/pipeline/steps/StepRegistry');

describe('StepRegistry', () => {
    describe('hasNewStep', () => {
        it('should return true for known steps', () => {
            expect(StepRegistry.hasNewStep('writer')).toBe(true);
            expect(StepRegistry.hasNewStep('first-review')).toBe(true);
            expect(StepRegistry.hasNewStep('final-editor')).toBe(true);
            expect(StepRegistry.hasNewStep('material-manager')).toBe(true);
        });

        it('should return false for unknown steps', () => {
            expect(StepRegistry.hasNewStep('nonexistent')).toBe(false);
            expect(StepRegistry.hasNewStep('adjuster')).toBe(false);
        });
    });

    describe('getStep', () => {
        it('should return step instance for known steps', () => {
            const step = StepRegistry.getStep('writer');
            expect(step).not.toBeNull();
            expect(typeof step.runWithRetry).toBe('function');
        });

        it('should return null for unknown steps', () => {
            expect(StepRegistry.getStep('nonexistent')).toBeNull();
        });
    });

    describe('getMigratedSteps', () => {
        it('should return array of all migrated step names', () => {
            const steps = StepRegistry.getMigratedSteps();
            expect(Array.isArray(steps)).toBe(true);
            expect(steps.length).toBeGreaterThanOrEqual(11);
            expect(steps).toContain('writer');
            expect(steps).toContain('first-review');
            expect(steps).toContain('final-editor');
            expect(steps).toContain('material-manager');
        });

        it('should not include adjuster (deprecated)', () => {
            const steps = StepRegistry.getMigratedSteps();
            expect(steps).not.toContain('adjuster');
        });
    });

    describe('executeStep', () => {
        it('should throw for unknown step', async () => {
            await expect(StepRegistry.executeStep('nonexistent', {}))
                .rejects.toThrow('unknown step');
        });
    });
});
