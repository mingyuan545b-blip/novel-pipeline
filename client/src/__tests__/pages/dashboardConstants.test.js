/**
 * Dashboard constants tests
 */
import {
    LAYOUT_KEY, DEFAULT_LAYOUT, MODE_LABELS, SUBGENRE_LABELS,
    FILE_TYPE_LABELS, CLEANUP_ITEMS, STYLE_RULE_LABELS,
    loadLayout, saveLayout
} from '../../pages/dashboard/constants';

describe('dashboard constants', () => {
    test('LAYOUT_KEY is defined', () => { expect(LAYOUT_KEY).toBe('dashboard-layout'); });
    test('DEFAULT_LAYOUT has left and right', () => {
        expect(DEFAULT_LAYOUT.left).toContain('flavor');
        expect(DEFAULT_LAYOUT.right).toContain('worldview');
    });
    test('MODE_LABELS has novel', () => { expect(MODE_LABELS.novel.label).toBe('长篇'); });
    test('SUBGENRE_LABELS has entries', () => { expect(SUBGENRE_LABELS['tomato-revenge']).toContain('复仇'); });
    test('FILE_TYPE_LABELS has character', () => { expect(FILE_TYPE_LABELS.character).toContain('人物'); });
    test('CLEANUP_ITEMS has entries', () => { expect(CLEANUP_ITEMS.length).toBeGreaterThan(0); });
    test('STYLE_RULE_LABELS has entries', () => { expect(STYLE_RULE_LABELS.narrativePacing).toBe('节奏'); });

    describe('loadLayout', () => {
        beforeEach(() => { localStorage.clear(); });
        test('returns DEFAULT_LAYOUT when nothing saved', () => {
            expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
        });
        test('returns saved layout when valid', () => {
            localStorage.setItem(LAYOUT_KEY, JSON.stringify(DEFAULT_LAYOUT));
            expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
        });
        test('returns DEFAULT_LAYOUT when saved layout is missing cards', () => {
            const incomplete = { left: ['flavor'], right: ['worldview'] };
            localStorage.setItem(LAYOUT_KEY, JSON.stringify(incomplete));
            expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
        });
        test('returns DEFAULT_LAYOUT when JSON is invalid', () => {
            localStorage.setItem(LAYOUT_KEY, 'not-json');
            expect(loadLayout()).toEqual(DEFAULT_LAYOUT);
        });
    });

    describe('saveLayout', () => {
        beforeEach(() => { localStorage.clear(); });
        test('saves layout to localStorage', () => {
            saveLayout(DEFAULT_LAYOUT);
            expect(localStorage.getItem(LAYOUT_KEY)).toBe(JSON.stringify(DEFAULT_LAYOUT));
        });
    });
});
