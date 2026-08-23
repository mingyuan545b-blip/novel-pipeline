const logger = require('../../server/shared/logger');

describe('logger', () => {
    const origEnv = process.env;
    beforeEach(() => { process.env = { ...origEnv }; });
    afterAll(() => { process.env = origEnv; });

    describe('getConfig', () => {
        test('returns config with level and isProduction', () => {
            const config = logger.getConfig();
            expect(config).toHaveProperty('level');
            expect(config).toHaveProperty('isProduction');
            expect(config).toHaveProperty('levels');
        });
    });

    describe('log level filtering', () => {
        test('debug is suppressed at default info level', () => {
            const spy = jest.spyOn(console, 'debug').mockImplementation();
            logger.debug('test', 'debug message');
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
        test('info is output at default info level', () => {
            const spy = jest.spyOn(console, 'info').mockImplementation();
            logger.info('test', 'info message');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
        test('warn is output at default info level', () => {
            const spy = jest.spyOn(console, 'warn').mockImplementation();
            logger.warn('test', 'warn message');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
        test('error is output at default info level', () => {
            const spy = jest.spyOn(console, 'error').mockImplementation();
            logger.error('test', 'error message');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('context formatting', () => {
        test('includes context in non-production', () => {
            const spy = jest.spyOn(console, 'info').mockImplementation();
            logger.info('test', 'message', { key: 'value' });
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('"key"'));
            spy.mockRestore();
        });
        test('omits context when empty', () => {
            const spy = jest.spyOn(console, 'info').mockImplementation();
            logger.info('test', 'message');
            expect(spy).toHaveBeenCalledWith(expect.not.stringContaining('{}'));
            spy.mockRestore();
        });
    });

    describe('production mode', () => {
        test('outputs structured format in production', () => {
            process.env.NODE_ENV = 'production';
            const mod = require('../../server/shared/logger');
            const spy = jest.spyOn(console, 'error').mockImplementation();
            mod.error('test', 'error msg', { extra: 1 });
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('error msg'));
            spy.mockRestore();
            delete process.env.NODE_ENV;
        });
    });
});
