/**
 * Knowledge constants tests
 */
import { KNOWLEDGE_TABS, SEVERITY_COLORS, DIMENSION_LABELS } from '../../pages/knowledge/knowledgeConstants';
import { EVENT_TYPE_LABELS, SIGNIFICANCE_LABELS, INITIAL_FORM } from '../../pages/knowledge/timelineConstants';

describe('knowledge constants', () => {
    test('KNOWLEDGE_TABS has 8 tabs', () => { expect(KNOWLEDGE_TABS).toHaveLength(8); });
    test('KNOWLEDGE_TABS first tab is overview', () => { expect(KNOWLEDGE_TABS[0].key).toBe('overview'); });
    test('SEVERITY_COLORS has 3 levels', () => { expect(Object.keys(SEVERITY_COLORS)).toHaveLength(3); });
    test('DIMENSION_LABELS has 6 dimensions', () => { expect(Object.keys(DIMENSION_LABELS)).toHaveLength(6); });
});

describe('timeline constants', () => {
    test('EVENT_TYPE_LABELS has entries', () => { expect(Object.keys(EVENT_TYPE_LABELS)).toHaveLength(11); });
    test('EVENT_TYPE_LABELS battle has label and color', () => {
        expect(EVENT_TYPE_LABELS.battle.label).toBeTruthy();
        expect(EVENT_TYPE_LABELS.battle.color).toBeTruthy();
    });
    test('SIGNIFICANCE_LABELS has 4 levels', () => { expect(Object.keys(SIGNIFICANCE_LABELS)).toHaveLength(4); });
    test('INITIAL_FORM has required fields', () => {
        expect(INITIAL_FORM).toHaveProperty('chapterNumber');
        expect(INITIAL_FORM).toHaveProperty('eventType');
        expect(INITIAL_FORM).toHaveProperty('description');
    });
});
