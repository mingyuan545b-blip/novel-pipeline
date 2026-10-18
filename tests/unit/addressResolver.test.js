/**
 * addressResolver 单测（D2-c 称谓模版）+ 实体详情接线
 */
const { resolveAddressGuide } = require('../../server/services/addressResolver');
const { ADDRESS_BY_ROLE } = require('../../server/config/addressTemplates');
const { _buildDetailText } = require('../../server/services/entityCenter/formatters');

describe('resolveAddressGuide', () => {
    test('按 roleLevel 取模版', () => {
        expect(resolveAddressGuide({ entityType: 'character', roleLevel: 'protagonist' })).toBe(ADDRESS_BY_ROLE.protagonist);
        expect(resolveAddressGuide({ entityType: 'character', roleLevel: 'antagonist' })).toBe(ADDRESS_BY_ROLE.antagonist);
    });
    test('未知等级 → default', () => {
        expect(resolveAddressGuide({ entityType: 'character', roleLevel: 'xxx' })).toBe(ADDRESS_BY_ROLE.default);
        expect(resolveAddressGuide({ entityType: 'character' })).toBe(ADDRESS_BY_ROLE.default);
    });
    test('非角色/空值 → 空串（不污染提示词）', () => {
        expect(resolveAddressGuide({ entityType: 'item', roleLevel: 'protagonist' })).toBe('');
        expect(resolveAddressGuide(null)).toBe('');
    });
});

describe('formatters 接线', () => {
    test('角色详情含称谓建议；道具不含', () => {
        const charText = _buildDetailText({ name: '林晚', entityType: 'character', roleLevel: 'protagonist' });
        expect(charText).toContain('称谓建议');
        const itemText = _buildDetailText({ name: '断刃', entityType: 'item' });
        expect(itemText).not.toContain('称谓建议');
    });
});
