/**
 * Character state constants tests
 */
import {
    ROLE_COLORS, ROLE_LABELS, ROLE_ICONS, SCHEMA_COLORS,
    GENRE_LABELS, GENRE_COLORS, SCOPE_ICONS, SCOPE_LABELS, TABS
} from '../../pages/characterstate/characterStateConstants';

describe('character state constants', () => {
    test('ROLE_COLORS has 3 roles', () => { expect(Object.keys(ROLE_COLORS)).toHaveLength(3); });
    test('ROLE_LABELS maps correctly', () => { expect(ROLE_LABELS.protagonist).toBe('主角'); });
    test('ROLE_ICONS has entries', () => { expect(ROLE_ICONS.protagonist).toBeTruthy(); });
    test('SCHEMA_COLORS has default', () => { expect(SCHEMA_COLORS.default).toBeTruthy(); });
    test('GENRE_LABELS has 11 genres', () => { expect(Object.keys(GENRE_LABELS)).toHaveLength(11); });
    test('GENRE_COLORS has 11 genres', () => { expect(Object.keys(GENRE_COLORS)).toHaveLength(11); });
    test('SCOPE_ICONS has entries', () => { expect(SCOPE_ICONS.character).toBeTruthy(); });
    test('SCOPE_LABELS maps correctly', () => { expect(SCOPE_LABELS.character).toBe('角色'); });
    test('TABS has 5 entries', () => { expect(TABS).toHaveLength(5); });
});
