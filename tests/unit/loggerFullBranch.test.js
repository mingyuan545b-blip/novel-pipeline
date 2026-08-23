/**
 * logger.js branch coverage tests
 * Covers: isProduction JSON output, _formatOutput context branch,
 *         debug level filtering, getConfig
 */

const ORIGINAL_ENV = { ...process.env };

describe('logger', () => {
    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        jest.resetModules();
    });

    test('outputs JSON in production mode', () => {
        process.env.NODE_ENV = 'production';
        process.env.LOG_LEVEL = 'debug';
        const logger = require('../../server/shared/logger');
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        logger.error('test-mod', 'test message', { key: 'val' });
        expect(spy).toHaveBeenCalledTimes(1);
        const output = spy.mock.calls[0][0];
        const parsed = JSON.parse(output);
        expect(parsed.level).toBe('error');
        expect(parsed.module).toBe('test-mod');
        expect(parsed.message).toBe('test message');
        expect(parsed.key).toBe('val');
        spy.mockRestore();
    });

    test('outputs formatted string in development mode', () => {
        delete process.env.NODE_ENV;
        process.env.LOG_LEVEL = 'debug';
        const logger = require('../../server/shared/logger');
        const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
        logger.info('dev-mod', 'dev message', { foo: 'bar' });
        expect(spy).toHaveBeenCalledTimes(1);
        const output = spy.mock.calls[0][0];
        expect(output).toContain('[INFO]');
        expect(output).toContain('[dev-mod]');
        expect(output).toContain('dev message');
        expect(output).toContain('"foo":"bar"');
        spy.mockRestore();
    });

    test('outputs without context when context is empty', () => {
        delete process.env.NODE_ENV;
        process.env.LOG_LEVEL = 'debug';
        const logger = require('../../server/shared/logger');
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        logger.warn('noctx', 'no context');
        expect(spy).toHaveBeenCalledTimes(1);
        const output = spy.mock.calls[0][0];
        expect(output).toContain('[WARN]');
        expect(output).not.toContain('{}');
        spy.mockRestore();
    });

    test('filters debug messages when level is info', () => {
        process.env.LOG_LEVEL = 'info';
        delete process.env.NODE_ENV;
        const logger = require('../../server/shared/logger');
        const spy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        logger.debug('mod', 'should be filtered');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    test('filters info messages when level is warn', () => {
        process.env.LOG_LEVEL = 'warn';
        delete process.env.NODE_ENV;
        const logger = require('../../server/shared/logger');
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        logger.info('mod', 'should be filtered');
        logger.warn('mod', 'should appear');
        expect(infoSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledTimes(1);
        infoSpy.mockRestore();
        warnSpy.mockRestore();
    });

    test('getConfig returns current configuration', () => {
        process.env.LOG_LEVEL = 'error';
        delete process.env.NODE_ENV;
        const logger = require('../../server/shared/logger');
        const config = logger.getConfig();
        expect(config.level).toBe('error');
        expect(config.isProduction).toBe(false);
        expect(config.levels).toHaveProperty('debug');
    });

    test('falls back to info level for unknown LOG_LEVEL', () => {
        process.env.LOG_LEVEL = 'invalid';
        delete process.env.NODE_ENV;
        const logger = require('../../server/shared/logger');
        const config = logger.getConfig();
        expect(config.level).toBe('invalid');
        // Should still work - info messages should be visible
        const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
        logger.info('mod', 'test');
        expect(spy).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });
});
