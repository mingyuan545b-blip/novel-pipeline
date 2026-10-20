/**
 * techniqueSchedulerConstants.test.js — 技法调度常量测试
 */
const {
    SCENE_DEPARTMENT_MAP,
    TECH_WORLDVIEW_DEPTH,
    DEPTH_LOAD_STRATEGY,
    KNOWLEDGE_DEPARTMENT_BOOST,
    GENRE_DEPARTMENT_AFFINITY,
    getTechWorldviewDepth,
} = require('../../server/services/pipeline/techniqueScheduler');

describe('techniqueScheduler constants', () => {
    describe('SCENE_DEPARTMENT_MAP', () => {
        test('has all 6 scene types', () => {
            const scenes = ['combat', 'social', 'exploration', 'revelation', 'training', 'emotional'];
            for (const s of scenes) {
                expect(SCENE_DEPARTMENT_MAP[s]).toBeDefined();
                expect(Array.isArray(SCENE_DEPARTMENT_MAP[s])).toBe(true);
            }
        });

        test('uses actual department names with 部 suffix', () => {
            const allDepts = Object.values(SCENE_DEPARTMENT_MAP).flat();
            for (const d of allDepts) {
                expect(d).toMatch(/部$/);
            }
        });
    });

    describe('TECH_WORLDVIEW_DEPTH', () => {
        test('has macro/meso/micro', () => {
            expect(TECH_WORLDVIEW_DEPTH.macro).toBeDefined();
            expect(TECH_WORLDVIEW_DEPTH.meso).toBeDefined();
            expect(TECH_WORLDVIEW_DEPTH.micro).toBeDefined();
        });

        test('macro includes 叙事之魂部, 顶层设计部, 世界构建部', () => {
            expect(TECH_WORLDVIEW_DEPTH.macro).toContain('叙事之魂部');
            expect(TECH_WORLDVIEW_DEPTH.macro).toContain('顶层设计部');
            expect(TECH_WORLDVIEW_DEPTH.macro).toContain('世界构建部');
        });

        test('micro includes 文笔滤镜部', () => {
            expect(TECH_WORLDVIEW_DEPTH.micro).toContain('文笔滤镜部');
        });
    });

    describe('DEPTH_LOAD_STRATEGY', () => {
        test('macro always loads', () => {
            expect(DEPTH_LOAD_STRATEGY.macro.alwaysLoad).toBe(true);
        });

        test('meso and micro do not always load', () => {
            expect(DEPTH_LOAD_STRATEGY.meso.alwaysLoad).toBe(false);
            expect(DEPTH_LOAD_STRATEGY.micro.alwaysLoad).toBe(false);
        });

        test('micro has higher sceneBoost than meso', () => {
            expect(DEPTH_LOAD_STRATEGY.micro.sceneBoost).toBeGreaterThan(DEPTH_LOAD_STRATEGY.meso.sceneBoost);
        });
    });

    describe('KNOWLEDGE_DEPARTMENT_BOOST', () => {
        test('has all 4 confidence levels', () => {
            expect(KNOWLEDGE_DEPARTMENT_BOOST.suspect).toBeDefined();
            expect(KNOWLEDGE_DEPARTMENT_BOOST.misinformed).toBeDefined();
            expect(KNOWLEDGE_DEPARTMENT_BOOST.unknown).toBeDefined();
            expect(KNOWLEDGE_DEPARTMENT_BOOST.certain).toBeDefined();
        });

        test('each confidence maps to department arrays', () => {
            for (const [conf, depts] of Object.entries(KNOWLEDGE_DEPARTMENT_BOOST)) {
                expect(Array.isArray(depts)).toBe(true);
                expect(depts.length).toBeGreaterThan(0);
            }
        });
    });

    describe('GENRE_DEPARTMENT_AFFINITY', () => {
        test('has key genre mappings', () => {
            // 修复：tomato-sweet/urban-fantasy/rule-horror 题材已从系统移除，
            // 断言未同步（铁律原则2：显式契约）。当前映射表权威值见
            // techniqueScheduler.js 的 GENRE_DEPARTMENT_AFFINITY。
            expect(GENRE_DEPARTMENT_AFFINITY['high-martial-comedy']).toBeDefined();
            expect(GENRE_DEPARTMENT_AFFINITY['tomato-sweet']).toBeUndefined();
        });

        test('each genre maps to department arrays', () => {
            for (const [genre, depts] of Object.entries(GENRE_DEPARTMENT_AFFINITY)) {
                expect(Array.isArray(depts)).toBe(true);
                expect(depts.length).toBeGreaterThan(0);
            }
        });
    });

    describe('getTechWorldviewDepth', () => {
        test('classifies 世界构建部 as macro', () => {
            expect(getTechWorldviewDepth({ department: '06_世界构建部' })).toBe('macro');
        });

        test('classifies 人物熔炉部 as meso', () => {
            expect(getTechWorldviewDepth({ department: '03_人物熔炉部' })).toBe('meso');
        });

        test('classifies 文笔滤镜部 as micro', () => {
            expect(getTechWorldviewDepth({ department: '05_文笔滤镜部' })).toBe('micro');
        });

        test('defaults to meso for unknown', () => {
            expect(getTechWorldviewDepth({ department: '99_未知部门' })).toBe('meso');
        });
    });
});
