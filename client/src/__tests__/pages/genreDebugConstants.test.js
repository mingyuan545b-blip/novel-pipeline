/**
 * Genre debug constants tests
 */
import { DETAIL_LABELS, TAB_LIST, SCOPE_COLORS, AGENT_TYPE_LABELS, STYLE_FIELDS } from '../../pages/genre-debug/constants';

describe('genre-debug constants', () => {
    test('DETAIL_LABELS has 5 entries', () => { expect(Object.keys(DETAIL_LABELS)).toHaveLength(5); });
    test('TAB_LIST has 5 tabs', () => { expect(TAB_LIST).toHaveLength(5); });
    test('TAB_LIST first tab is agents', () => { expect(TAB_LIST[0].key).toBe('agents'); });
    test('SCOPE_COLORS has 4 scopes', () => { expect(Object.keys(SCOPE_COLORS)).toHaveLength(4); });
    test('SCOPE_COLORS universal has bg/color/label', () => {
        expect(SCOPE_COLORS.universal.bg).toBeTruthy();
        expect(SCOPE_COLORS.universal.label).toBe('通用');
    });
    test('AGENT_TYPE_LABELS has entries', () => { expect(AGENT_TYPE_LABELS.writer).toContain('执笔人'); });
    test('STYLE_FIELDS has 5 fields', () => { expect(STYLE_FIELDS).toHaveLength(5); });
    test('STYLE_FIELDS entries have key/label/icon/desc', () => {
        STYLE_FIELDS.forEach(f => {
            expect(f.key).toBeTruthy();
            expect(f.label).toBeTruthy();
            expect(f.icon).toBeTruthy();
            expect(f.desc).toBeTruthy();
        });
    });
});
