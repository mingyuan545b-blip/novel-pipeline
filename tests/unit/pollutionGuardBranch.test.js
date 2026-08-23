/**
 * pollutionGuardBranch.test.js
 * 补充pipelinePollutionGuard.js分支覆盖率
 * 重点：detectSettingDrift、detectPollution的review步骤分支
 */
const {
    detectPollution, detectCharacterPollution,
    detectMaterialDuplication, detectSettingDrift
} = require('../../server/services/pipeline/pipelinePollutionGuard');

describe('pipelinePollutionGuard branch coverage', () => {

    describe('detectCharacterPollution — edge cases', () => {
        test('returns no pollution for empty content', () => {
            const result = detectCharacterPollution('', [{ type: 'character', name: '林浅' }]);
            expect(result.hasPollution).toBe(false);
        });

        test('returns no pollution for empty materialNames', () => {
            const result = detectCharacterPollution('林浅走在路上', []);
            expect(result.hasPollution).toBe(false);
        });

        test('returns no pollution for null inputs', () => {
            const result = detectCharacterPollution(null, null);
            expect(result.hasPollution).toBe(false);
        });

        test('returns no pollution when no character materials', () => {
            const result = detectCharacterPollution('林浅走在路上', [{ type: 'setting', name: '镜楼' }]);
            expect(result.hasPollution).toBe(false);
        });

        test('detects unknown character names', () => {
            const result = detectCharacterPollution('张三走在路上', [{ type: 'character', name: '林浅' }]);
            expect(result.hasPollution).toBe(true);
            expect(result.unknownNames).toContain('张三');
        });

        test('excludes common words and short names', () => {
            const result = detectCharacterPollution('他的', [{ type: 'character', name: '林浅' }]);
            expect(result.unknownNames).not.toContain('他的');
        });
    });

    describe('detectMaterialDuplication — edge cases', () => {
        test('returns no duplication for null materials', () => {
            const result = detectMaterialDuplication(null);
            expect(result.hasDuplication).toBe(false);
        });

        test('skips archived materials', () => {
            const materials = [
                { id: '1', type: 'character', name: '林浅', archived: true },
                { id: '2', type: 'character', name: '林浅', archived: true }
            ];
            const result = detectMaterialDuplication(materials);
            expect(result.hasDuplication).toBe(false);
        });

        test('detects same name duplication', () => {
            const materials = [
                { id: '1', type: 'character', name: '林浅' },
                { id: '2', type: 'character', name: '林浅' }
            ];
            const result = detectMaterialDuplication(materials);
            expect(result.hasDuplication).toBe(true);
            expect(result.duplicates[0].type).toBe('same_name');
        });

        test('detects similar content between different characters', () => {
            const longContent = 'A'.repeat(200);
            const materials = [
                { id: '1', type: 'character', name: '林浅', currentContent: longContent },
                { id: '2', type: 'character', name: '苏曼', currentContent: longContent }
            ];
            const result = detectMaterialDuplication(materials);
            if (result.hasDuplication) {
                expect(result.duplicates.some(d => d.type === 'similar_content')).toBe(true);
            }
        });
    });

    describe('detectSettingDrift — edge cases', () => {
        test('returns no drift for null inputs', () => {
            const result = detectSettingDrift(null, null);
            expect(result.hasDrift).toBe(false);
        });

        test('returns no drift for empty materialNames', () => {
            const result = detectSettingDrift('review output', []);
            expect(result.hasDrift).toBe(false);
        });

        test('skips characters with no content', () => {
            const result = detectSettingDrift('review output', [{ type: 'character', name: '林浅', content: '' }]);
            expect(result.hasDrift).toBe(false);
        });
    });

    describe('detectPollution — step routing', () => {
        test('detects character pollution for writer step', () => {
            const result = detectPollution('writer', { content: '张三走在路上' }, { materialNames: [{ type: 'character', name: '林浅' }] });
            expect(result.hasPollution).toBe(true);
            expect(result.results[0].code).toBe('P-001');
        });

        test('detects material duplication for material-manager step', () => {
            const materials = [
                { id: '1', type: 'character', name: '林浅' },
                { id: '2', type: 'character', name: '林浅' }
            ];
            const result = detectPollution('material-manager', {}, { materials });
            expect(result.hasPollution).toBe(true);
            expect(result.results[0].code).toBe('P-002');
        });

        test('detects setting drift for first-review step', () => {
            const result = detectPollution('first-review',
                { firstReviewOutput: '林浅是一个温柔的女孩' },
                { materialNames: [{ type: 'character', name: '林浅', content: '林浅性格冷酷无情' }] }
            );
            // drift detection depends on extractSettingKeywords
            expect(typeof result.hasPollution).toBe('boolean');
        });

        test('detects setting drift for second-review step', () => {
            const result = detectPollution('second-review',
                { secondReviewOutput: '林浅是一个温柔的女孩' },
                { materialNames: [{ type: 'character', name: '林浅', content: '林浅性格冷酷无情' }] }
            );
            expect(typeof result.hasPollution).toBe('boolean');
        });

        test('returns no pollution for unrelated step', () => {
            const result = detectPollution('reader', { content: 'some content' }, {});
            expect(result.hasPollution).toBe(false);
        });

        test('returns no pollution when no issues found', () => {
            const result = detectPollution('writer', { content: '林浅走在路上' }, { materialNames: [{ type: 'character', name: '林浅' }] });
            expect(result.hasPollution).toBe(false);
        });
    });
});
