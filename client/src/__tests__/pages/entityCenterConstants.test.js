/**
 * Entity center constants tests
 */
import {
    ROLE_COLORS, ROLE_LABELS, ROLE_PRIORITY, RARITY_COLORS, RARITY_LABELS,
    MASTERY_MAP, GROWTH_COLORS, SERVANT_LABELS, REL_TYPE_COLORS, REL_TYPE_LABELS,
    SCOPE_ICONS, SCOPE_LABELS, GENRE_LABELS, GENRE_COLORS, TABS, STATS_CONFIG,
    SCOPE_BORDER_COLORS, CONFIDENCE_LABELS, CONFIDENCE_COLORS, SOURCE_HOW_LABELS
} from '../../pages/entitycenter/constants';

describe('entity center constants', () => {
    test('ROLE_COLORS has protagonist/supporting/npc', () => {
        expect(ROLE_COLORS.protagonist).toBe('#ffd700');
        expect(ROLE_COLORS.supporting).toBe('#00c8ff');
    });
    test('ROLE_LABELS maps correctly', () => {
        expect(ROLE_LABELS.protagonist).toBe('主角');
        expect(ROLE_LABELS.supporting).toBe('配角');
    });
    test('ROLE_PRIORITY orders correctly', () => {
        expect(ROLE_PRIORITY.protagonist).toBeGreaterThan(ROLE_PRIORITY.npc);
    });
    test('RARITY_COLORS has 5 levels', () => {
        expect(Object.keys(RARITY_COLORS)).toHaveLength(5);
    });
    test('RARITY_LABELS has 5 levels', () => {
        expect(RARITY_LABELS.common).toBe('普通');
        expect(RARITY_LABELS.legendary).toBe('传说');
    });
    test('MASTERY_MAP has 5 levels', () => {
        expect(MASTERY_MAP['初学']).toBe(10);
        expect(MASTERY_MAP['化境']).toBe(100);
    });
    test('GROWTH_COLORS has 5 stages', () => {
        expect(Object.keys(GROWTH_COLORS)).toHaveLength(5);
    });
    test('SERVANT_LABELS has entries', () => {
        expect(SERVANT_LABELS.retainer).toBe('家臣');
    });
    test('REL_TYPE_COLORS has entries', () => {
        expect(REL_TYPE_COLORS.ally).toBeTruthy();
    });
    test('REL_TYPE_LABELS maps correctly', () => {
        expect(REL_TYPE_LABELS.ally).toBe('盟友');
        expect(REL_TYPE_LABELS.enemy).toBe('敌人');
    });
    test('SCOPE_ICONS has entries', () => {
        expect(SCOPE_ICONS.character).toBeTruthy();
    });
    test('SCOPE_LABELS maps correctly', () => {
        expect(SCOPE_LABELS.character).toBe('角色');
    });
    test('GENRE_LABELS has entries', () => {
        expect(GENRE_LABELS['high-martial']).toBe('修仙玄幻');
    });
    test('GENRE_COLORS has entries', () => {
        expect(GENRE_COLORS['high-martial']).toBeTruthy();
    });
    test('TABS has 14 entries', () => {
        expect(TABS).toHaveLength(14);
        expect(TABS[0].key).toBe('characters');
    });
    test('STATS_CONFIG has 5 entries', () => {
        expect(STATS_CONFIG).toHaveLength(5);
    });
    test('SCOPE_BORDER_COLORS has entries', () => {
        expect(SCOPE_BORDER_COLORS.character).toBeTruthy();
    });
    test('CONFIDENCE_LABELS has entries', () => {
        expect(CONFIDENCE_LABELS.certain).toBe('确信');
    });
    test('CONFIDENCE_COLORS has entries', () => {
        expect(CONFIDENCE_COLORS.certain).toBeTruthy();
    });
    test('SOURCE_HOW_LABELS has entries', () => {
        expect(SOURCE_HOW_LABELS.witnessed).toBe('亲眼');
    });
});
