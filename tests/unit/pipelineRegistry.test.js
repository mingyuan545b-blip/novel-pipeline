jest.mock('../../server/services/pipeline/pipelineStepRunner', () => {
    throw new Error('MODULE_NOT_FOUND');
}, { virtual: true });

jest.mock('../../server/services/pipeline/fullPipeline', () => {
    throw new Error('MODULE_NOT_FOUND');
}, { virtual: true });

const { registerStepFn, getStepFn, registerPipelineFn, getPipelineFn } = require('../../server/services/pipelineRegistry');

describe('pipelineRegistry - registerStepFn / getStepFn', () => {
    afterEach(() => {
        try { registerStepFn(undefined); } catch (_) {}
    });

    test('getStepFn throws when no step function is registered', () => {
        expect(() => getStepFn()).toThrow('runPipelineStep is not');
    });

    test('registerStepFn stores a function that getStepFn retrieves', () => {
        const fn = () => 'step-result';
        registerStepFn(fn);
        expect(getStepFn()).toBe(fn);
    });

    test('registered step function is callable and returns expected value', () => {
        const fn = (x, y) => x + y;
        registerStepFn(fn);
        expect(getStepFn()(3, 4)).toBe(7);
    });

    test('getStepFn throws if registered value is not a function', () => {
        registerStepFn('not-a-function');
        expect(() => getStepFn()).toThrow('runPipelineStep is not');
    });

    test('re-registration overwrites the previous step function', () => {
        const first = () => 'first';
        const second = () => 'second';
        registerStepFn(first);
        expect(getStepFn()).toBe(first);
        registerStepFn(second);
        expect(getStepFn()).toBe(second);
        expect(getStepFn()).not.toBe(first);
    });
});

describe('pipelineRegistry - registerPipelineFn / getPipelineFn', () => {
    afterEach(() => {
        try { registerPipelineFn(undefined); } catch (_) {}
    });

    test('getPipelineFn throws when no pipeline function is registered', () => {
        expect(() => getPipelineFn()).toThrow('runFullPipeline is not');
    });

    test('registerPipelineFn stores a function that getPipelineFn retrieves', () => {
        const fn = () => 'pipeline-result';
        registerPipelineFn(fn);
        expect(getPipelineFn()).toBe(fn);
    });

    test('registered pipeline function is callable and returns expected value', () => {
        const fn = async (id) => ({ projectId: id, status: 'done' });
        registerPipelineFn(fn);
        expect(getPipelineFn()('p1')).resolves.toEqual({ projectId: 'p1', status: 'done' });
    });

    test('getPipelineFn throws if registered value is not a function', () => {
        registerPipelineFn(42);
        expect(() => getPipelineFn()).toThrow('runFullPipeline is not');
    });

    test('re-registration overwrites the previous pipeline function', () => {
        const first = () => 'first-pipeline';
        const second = () => 'second-pipeline';
        registerPipelineFn(first);
        expect(getPipelineFn()).toBe(first);
        registerPipelineFn(second);
        expect(getPipelineFn()).toBe(second);
        expect(getPipelineFn()).not.toBe(first);
    });
});

describe('pipelineRegistry - step and pipeline registries are independent', () => {
    afterEach(() => {
        try { registerStepFn(undefined); } catch (_) {}
        try { registerPipelineFn(undefined); } catch (_) {}
    });

    test('registering a step function does not affect getPipelineFn', () => {
        registerStepFn(() => 'step');
        expect(() => getPipelineFn()).toThrow('runFullPipeline is not');
    });

    test('registering a pipeline function does not affect getStepFn', () => {
        registerPipelineFn(() => 'pipeline');
        expect(() => getStepFn()).toThrow('runPipelineStep is not');
    });

    test('both can be registered and retrieved independently', () => {
        const stepFn = () => 'step';
        const pipelineFn = () => 'pipeline';
        registerStepFn(stepFn);
        registerPipelineFn(pipelineFn);
        expect(getStepFn()).toBe(stepFn);
        expect(getPipelineFn()).toBe(pipelineFn);
    });
});
