/**
 * Workshop constants tests
 */
import {
    INITIAL_IMPORT_STATE, INITIAL_FUSION_STATE, INITIAL_TEMPLATE_STATE,
    TABS, MAX_TEXT_LENGTH, buildErrorMessage
} from '../../pages/workshop/constants';

describe('workshop constants', () => {
    test('INITIAL_IMPORT_STATE has required fields', () => {
        expect(INITIAL_IMPORT_STATE.generateMaterials).toBe(true);
        expect(INITIAL_IMPORT_STATE.chapterCount).toBe(10);
    });
    test('INITIAL_FUSION_STATE has 2 novel slots', () => {
        expect(INITIAL_FUSION_STATE.novels).toHaveLength(2);
    });
    test('INITIAL_TEMPLATE_STATE is null by default', () => {
        expect(INITIAL_TEMPLATE_STATE.validationResult).toBeNull();
    });
    test('TABS has 3 tabs', () => { expect(TABS).toHaveLength(3); });
    test('MAX_TEXT_LENGTH is 20000', () => { expect(MAX_TEXT_LENGTH).toBe(20000); });

    describe('buildErrorMessage', () => {
        test('returns error message', () => {
            expect(buildErrorMessage(new Error('test error'), 'fallback')).toBe('test error');
        });
        test('extracts response.data.error', () => {
            const e = { message: 'base', response: { data: { error: 'API error' } } };
            expect(buildErrorMessage(e, 'fallback')).toBe('API error');
        });
        test('uses fallback for timeout', () => {
            const e = { message: 'Request timeout', response: {} };
            expect(buildErrorMessage(e, '请重试')).toBe('请重试');
        });
        test('uses fallback for 超时', () => {
            const e = { message: '请求超时' };
            expect(buildErrorMessage(e, '请重试')).toBe('请重试');
        });
    });
});
