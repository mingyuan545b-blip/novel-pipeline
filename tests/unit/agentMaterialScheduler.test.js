/**
 * agentMaterialScheduler.test.js — Agent素材统一调度器测试
 */
const {
    getDeclaration, getRequiredTypes, getAllTypes,
    getLifecycleFilter, getConstraintNeeds,
    DETAIL_LEVELS, CONSTRAINT_PRIORITY, AGENT_DECLARATIONS
} = require('../../server/services/pipeline/agentDeclarations');

const {
    detectConflicts, buildResolvedConstraints
} = require('../../server/services/pipeline/constraintConflictDetector');

// ─── agentDeclarations 测试 ───

describe('agentDeclarations', () => {
    test('6个Agent都有声明', () => {
        const agents = ['writer', 'first-review', 'second-review', 'fast-review', 'reader', 'material-manager'];
        for (const agent of agents) {
            const decl = getDeclaration(agent);
            expect(decl).not.toBeNull();
            expect(decl.id).toBe(agent);
            expect(decl.materialNeeds.length).toBeGreaterThan(0);
            expect(decl.totalBudget).toBeGreaterThan(0);
        }
    });

    test('writer声明角色素材required=true', () => {
        const charNeed = getDeclaration('writer').materialNeeds.find(n => n.type === 'character');
        expect(charNeed).toBeDefined();
        expect(charNeed.required).toBe(true);
        expect(charNeed.source).toBe('entity-center');
        expect(charNeed.detail).toBe('full');
    });

    test('review Agent使用reviewer生命周期过滤', () => {
        expect(getLifecycleFilter('writer')).toBe('writer');
        expect(getLifecycleFilter('first-review')).toBe('reviewer');
        expect(getLifecycleFilter('fast-review')).toBe('reviewer');
        expect(getLifecycleFilter('reader')).toBeNull();
    });

    test('getRequiredTypes只返回required=true的类型', () => {
        const writerRequired = getRequiredTypes('writer');
        expect(writerRequired).toContain('character');
        expect(writerRequired).toContain('worldview');
        // equipment是可选的
        expect(writerRequired).not.toContain('equipment');
    });

    test('getAllTypes包含所有类型', () => {
        const allTypes = getAllTypes('writer');
        expect(allTypes.length).toBeGreaterThan(getRequiredTypes('writer').length);
        expect(allTypes).toContain('equipment');
        expect(allTypes).toContain('foreshadowing');
    });

    test('约束优先级正确定义', () => {
        expect(CONSTRAINT_PRIORITY.entity.level).toBeGreaterThan(CONSTRAINT_PRIORITY.genre.level);
        expect(CONSTRAINT_PRIORITY.genre.level).toBeGreaterThan(CONSTRAINT_PRIORITY.global.level);
    });

    test('DETAIL_LEVELS有L0-L4和旧名兼容', () => {
        const keys = Object.keys(DETAIL_LEVELS);
        expect(keys).toContain('L0');
        expect(keys).toContain('L4');
        expect(keys).toContain('full');
        expect(keys).toContain('index');
        expect(DETAIL_LEVELS.L3.maxChars).toBeGreaterThan(DETAIL_LEVELS.L2.maxChars);
    });

    test('writer有约束需求', () => {
        const needs = getConstraintNeeds('writer');
        expect(needs.behaviorRules).toBeDefined();
        expect(needs.behaviorRules.priority).toBe('entity');
        expect(needs.genreRules).toBeDefined();
    });

    test('未知Agent返回null', () => {
        expect(getDeclaration('unknown-agent')).toBeNull();
        expect(getRequiredTypes('unknown')).toEqual([]);
        expect(getLifecycleFilter('unknown')).toBeNull();
    });
});

// ─── constraintConflictDetector 测试 ───

describe('constraintConflictDetector', () => {
    test('无冲突时返回空数组', () => {
        const result = detectConflicts({
            projectId: 'test',
            entityRules: { name: '角色A', content: '温和有礼' },
            genreRules: { key: 'genre1', content: '热情开朗' },
            globalRules: null,
        });
        expect(result.conflicts).toEqual([]);
        expect(result.resolved.behaviorRules).toBeTruthy();
    });

    test('entity与genre冲突时entity胜出', () => {
        const result = detectConflicts({
            projectId: 'test',
            entityRules: { name: '角色A', content: '对外冷酷，不近人情' },
            genreRules: { key: 'genre1', content: '对外沉稳，有距离感' },
            globalRules: null,
        });
        expect(result.conflicts.length).toBeGreaterThan(0);
        expect(result.conflicts[0].resolution).toBe('entity_wins');
        expect(result.resolved.source).toBe('entity');
    });

    test('只有genre规则时source=genre', () => {
        const result = detectConflicts({
            projectId: 'test',
            entityRules: null,
            genreRules: { key: 'genre1', content: '热情开朗' },
            globalRules: null,
        });
        expect(result.resolved.source).toBe('genre');
    });

    test('全部为空时source=none', () => {
        const result = detectConflicts({
            projectId: 'test',
            entityRules: null,
            genreRules: null,
            globalRules: null,
        });
        expect(result.resolved.source).toBe('none');
        expect(result.resolved.behaviorRules).toBe('');
    });

    test('buildResolvedConstraints返回带前缀的文本', () => {
        const text = buildResolvedConstraints({
            projectId: 'test',
            entityRules: { name: '角色A', content: '温和有礼' },
            genreRules: null,
            globalRules: null,
        });
        expect(text).toContain('实体级');
        expect(text).toContain('温和有礼');
    });

    test('视角冲突被检测到', () => {
        const result = detectConflicts({
            projectId: 'test',
            entityRules: { name: '角色A', content: '第一人称我视角叙事' },
            genreRules: { key: 'genre1', content: '第三人称上帝视角' },
            globalRules: null,
        });
        expect(result.conflicts.length).toBeGreaterThan(0);
        const viewConflict = result.conflicts.find(c => c.tag.includes('视角'));
        expect(viewConflict).toBeDefined();
    });
});
