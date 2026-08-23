const { parseOrganizerOutput } = require('../../server/services/pipeline/steps/materialOrganizer');
const { validateOrganizingPlan } = require('../../server/services/pipeline/steps/materialRegistrar');

describe('materialOrganizer - parseOrganizerOutput', () => {
    test('parses clean JSON from text', () => {
        const text = `以下是整理计划：
{"characters": [{"name": "张三", "appeared": true}], "newMaterials": []}`;
        const result = parseOrganizerOutput(text);
        expect(result.characters[0].name).toBe('张三');
    });

    test('parses JSON with trailing text', () => {
        const text = `{"characters": [{"name": "李四", "appeared": true}]}
整理完毕。`;
        const result = parseOrganizerOutput(text);
        expect(result.characters[0].name).toBe('李四');
    });

    test('throws when no JSON found', () => {
        expect(() => parseOrganizerOutput('This is just text with no JSON')).toThrow('No JSON found');
    });

    test('parses complex organizing plan', () => {
        const text = `{
    "characters": [
        {
            "name": "叶凡",
            "appeared": true,
            "actions": ["战斗", "修炼"],
            "stateChanges": {
                "hp": {"from": 100, "to": 70, "reason": "战斗中受伤"},
                "cultivationStage": {"from": "筑基二层", "to": "筑基三层", "reason": "突破"}
            },
            "relationshipChanges": [
                {"with": "庞博", "from": "陌生", "to": "信任", "reason": "共同经历战斗"}
            ]
        }
    ],
    "newMaterials": [],
    "archiveCandidates": [],
    "foreshadowProgress": [],
    "worldviewChanges": []
}`;
        const result = parseOrganizerOutput(text);
        expect(result.characters.length).toBe(1);
        expect(result.characters[0].stateChanges.hp.to).toBe(70);
        expect(result.characters[0].relationshipChanges[0].with).toBe('庞博');
    });
});

describe('materialRegistrar - validateOrganizingPlan', () => {
    test('valid plan passes', () => {
        const plan = {
            characters: [{ name: '张三', appeared: true }],
            newMaterials: [],
            archiveCandidates: []
        };
        const result = validateOrganizingPlan(plan);
        expect(result.passed).toBe(true);
        expect(result.errors.length).toBe(0);
    });

    test('null plan fails', () => {
        const result = validateOrganizingPlan(null);
        expect(result.passed).toBe(false);
    });

    test('non-object plan fails', () => {
        const result = validateOrganizingPlan('not an object');
        expect(result.passed).toBe(false);
    });

    test('characters must be array', () => {
        const plan = { characters: 'not an array' };
        const result = validateOrganizingPlan(plan);
        expect(result.passed).toBe(false);
    });

    test('newMaterials must be array', () => {
        const plan = { newMaterials: 'not an array' };
        const result = validateOrganizingPlan(plan);
        expect(result.passed).toBe(false);
    });

    test('character missing name fails', () => {
        const plan = { characters: [{ appeared: true }] };
        const result = validateOrganizingPlan(plan);
        expect(result.passed).toBe(false);
    });

    test('valid plan with state changes', () => {
        const plan = {
            characters: [{
                name: '叶凡',
                stateChanges: { hp: { from: 100, to: 80 } }
            }],
            newMaterials: [],
            archiveCandidates: [],
            foreshadowProgress: [],
            worldviewChanges: []
        };
        const result = validateOrganizingPlan(plan);
        expect(result.passed).toBe(true);
    });
});
