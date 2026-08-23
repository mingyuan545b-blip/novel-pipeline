const {
    detectCharacterPollution, detectMaterialDuplication,
    detectSettingDrift, detectPollution
} = require('../../server/services/pipeline/pipelinePollutionGuard');

describe('pipelinePollutionGuard', () => {
    describe('detectCharacterPollution', () => {
        test('returns no pollution for empty content', () => {
            const result = detectCharacterPollution('', [{ name: '张三', type: 'character' }]);
            expect(result.hasPollution).toBe(false);
        });
        test('returns no pollution for empty materials', () => {
            const result = detectCharacterPollution('张三走了', []);
            expect(result.hasPollution).toBe(false);
        });
        test('returns no pollution for null inputs', () => {
            expect(detectCharacterPollution(null, null)).toEqual({ hasPollution: false, unknownNames: [], knownNames: [] });
            expect(detectCharacterPollution(null, [])).toEqual({ hasPollution: false, unknownNames: [], knownNames: [] });
        });
        test('returns no pollution for non-character materials', () => {
            const result = detectCharacterPollution('李四走了', [{ name: '宝剑', type: 'equipment' }]);
            expect(result.hasPollution).toBe(false);
        });
        test('detects unknown character names', () => {
            const result = detectCharacterPollution('李四走进了房间', [{ name: '张三', type: 'character' }]);
            expect(result.hasPollution).toBe(true);
            expect(result.unknownNames.length).toBeGreaterThan(0);
        });
        test('recognizes known character names', () => {
            const result = detectCharacterPollution('张三走进了房间', [{ name: '张三', type: 'character' }]);
            expect(result.knownNames.length).toBeGreaterThan(0);
        });
    });

    describe('detectMaterialDuplication', () => {
        test('returns no duplication for empty materials', () => {
            expect(detectMaterialDuplication([])).toEqual({ hasDuplication: false, duplicates: [] });
            expect(detectMaterialDuplication(null)).toEqual({ hasDuplication: false, duplicates: [] });
        });
        test('detects same-name duplicates', () => {
            const materials = [
                { id: '1', name: '张三', type: 'character', archived: false },
                { id: '2', name: '张三', type: 'character', archived: false }
            ];
            const result = detectMaterialDuplication(materials);
            expect(result.hasDuplication).toBe(true);
            expect(result.duplicates[0].type).toBe('same_name');
        });
        test('skips archived materials', () => {
            const materials = [
                { id: '1', name: '张三', type: 'character', archived: true },
                { id: '2', name: '张三', type: 'character', archived: false }
            ];
            const result = detectMaterialDuplication(materials);
            expect(result.hasDuplication).toBe(false);
        });
        test('detects similar content between characters', () => {
            const longContent = '这是一个非常长的角色描述内容，包含了角色的背景故事、性格特点、外貌特征等详细信息。这个角色有着复杂的过去和独特的个性。'.repeat(5);
            const materials = [
                { id: '1', name: '张三', type: 'character', archived: false, currentContent: longContent },
                { id: '2', name: '李四', type: 'character', archived: false, currentContent: longContent }
            ];
            const result = detectMaterialDuplication(materials);
            expect(result.hasDuplication).toBe(true);
        });
    });

    describe('detectSettingDrift', () => {
        test('returns no drift for empty inputs', () => {
            expect(detectSettingDrift(null, null)).toEqual({ hasDrift: false, driftItems: [] });
            expect(detectSettingDrift('', [])).toEqual({ hasDrift: false, driftItems: [] });
        });
        test('returns no drift when character has no content', () => {
            const result = detectSettingDrift('审核内容', [{ name: '张三', type: 'character', content: '' }]);
            expect(result.hasDrift).toBe(false);
        });
    });

    describe('detectPollution', () => {
        test('returns no pollution for unknown step', () => {
            const result = detectPollution('unknown-step', {}, {});
            expect(result.hasPollution).toBe(false);
        });
        test('detects character pollution for writer step', () => {
            const result = detectPollution('writer', { content: '李四走了' }, { materialNames: [{ name: '张三', type: 'character' }] });
            expect(result.hasPollution).toBe(true);
        });
        test('detects character pollution for reviser step', () => {
            const result = detectPollution('reviser', { content: '王五走了' }, { materialNames: [{ name: '张三', type: 'character' }] });
            expect(result.hasPollution).toBe(true);
        });
        test('detects material duplication for material-manager step', () => {
            const materials = [
                { id: '1', name: '张三', type: 'character', archived: false },
                { id: '2', name: '张三', type: 'character', archived: false }
            ];
            const result = detectPollution('material-manager', {}, { materials });
            expect(result.hasPollution).toBe(true);
        });
        test('no pollution for clean writer output', () => {
            const result = detectPollution('writer', { content: '张三走了' }, { materialNames: [{ name: '张三', type: 'character' }] });
            expect(result.hasPollution).toBe(false);
        });
    });
});
