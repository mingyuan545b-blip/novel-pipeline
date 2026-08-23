import { describe, test, expect, vi, beforeEach } from 'vitest';
import logger from '../../shared/logger';

describe('logger', () => {
    beforeEach(() => {
        vi.spyOn(console, 'debug').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('warn calls console.warn with formatted message', () => {
        logger.warn('TestTag', 'warn message');
        expect(console.warn).toHaveBeenCalledWith('[WARN] [TestTag] warn message');
    });

    test('error calls console.error with formatted message', () => {
        logger.error('TestTag', 'error message');
        expect(console.error).toHaveBeenCalledWith('[ERROR] [TestTag] error message');
    });

    test('formatMsg includes level and tag', () => {
        logger.warn('MyTag', 'hello');
        expect(console.warn).toHaveBeenCalledWith('[WARN] [MyTag] hello');
    });

    test('debug and info are suppressed at warn level', () => {
        logger.debug('Tag', 'debug msg');
        logger.info('Tag', 'info msg');
        expect(console.debug).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
    });
});
