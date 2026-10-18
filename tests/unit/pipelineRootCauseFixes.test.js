/**
 * pipelineRootCauseFixes.test.js — 回归测试（2026-10-10 根因修复，防回退）
 *  A. 润色字数下限（steps/polisher.shouldAcceptPolishedLength）
 *     —— 修复"越润越短跌破 targetMin/rejectMin"（实测20章10章不达标）
 *  B. 关系写入三键去重（materialRelationSync.findExactRel）
 *     —— 修复关系摆动回旧类型时新建行撞唯一索引 idx_rel_unique（素材登记报错）
 *  C. 一致性校验接口方法名契约（routes/knowledge/consistencyRoutes）
 *     —— 修复调用不存在的 checkConsistency/aiCheck（必 500）
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn(), updateItem: jest.fn(),
    queryItems: jest.fn(async () => []), listItems: jest.fn(async () => [])
}));
jest.mock('../../server/config', () => ({ resolveConfig: jest.fn(() => ({ word: {} })) }));

const fs = require('fs');
const path = require('path');

describe('A. 润色字数下限守卫', () => {
    const { shouldAcceptPolishedLength } = require('../../server/services/pipeline/steps/polisher');
    const word = { targetMin: 2500, rejectMin: 2250 };

    test('已达标稿件被润色降回 targetMin 以下 → 拒绝', () => {
        expect(shouldAcceptPolishedLength(2800, 2400, word)).toBe(false);
    });
    test('终稿跌破 rejectMin 且比原文短 → 拒绝（复现实测 ch1 2420→2014）', () => {
        expect(shouldAcceptPolishedLength(2420, 2014, word)).toBe(false);
    });
    test('在 [rejectMin,targetMin) 轻微缩短且原文未达标 → 允许', () => {
        expect(shouldAcceptPolishedLength(2300, 2260, word)).toBe(true);
    });
    test('润色变长/持平 → 允许', () => {
        expect(shouldAcceptPolishedLength(2600, 2650, word)).toBe(true);
        expect(shouldAcceptPolishedLength(2600, 2600, word)).toBe(true);
    });
    test('空润色稿 → 拒绝', () => {
        expect(shouldAcceptPolishedLength(2600, 0, word)).toBe(false);
    });
});

describe('B. 关系三键去重 (findExactRel)', () => {
    const { findExactRel } = require('../../server/services/pipeline/steps/materialRelationSync');
    const rels = [
        { id: 'rel-1', fromCharacterId: 'A', toCharacterId: 'B', relType: 'ally' },
        { id: 'rel-2', fromCharacterId: 'A', toCharacterId: 'B', relType: 'enemy' }
    ];
    test('命中同 (from,to,relType) → 返回旧行（复活旧行而非新建，避免撞唯一索引）', () => {
        expect(findExactRel(rels, 'A', 'B', 'ally').id).toBe('rel-1');
    });
    test('方向相反不算同键（唯一索引是方向敏感的）', () => {
        expect(findExactRel(rels, 'B', 'A', 'ally')).toBeNull();
    });
    test('relType 缺省按 other 归一', () => {
        const r = [{ id: 'x', fromCharacterId: 'A', toCharacterId: 'C' }];
        expect(findExactRel(r, 'A', 'C', undefined).id).toBe('x');
        expect(findExactRel(r, 'A', 'C', 'other').id).toBe('x');
    });
});

describe('C. 一致性校验接口方法名契约', () => {
    test('引擎暴露路由所需方法', () => {
        const consistency = require('../../server/services/consistencyEngine/index');
        expect(typeof consistency.fullCheck).toBe('function');
        expect(typeof consistency.quickCheck).toBe('function');
        expect(typeof consistency.aiAssistedCheck).toBe('function');
    });
    test('路由不再调用不存在的 checkConsistency/aiCheck，且 quickCheck 传入章节参数', () => {
        const src = fs.readFileSync(path.join(__dirname, '../../server/routes/knowledge/consistencyRoutes.js'), 'utf8');
        expect(src).not.toMatch(/consistency\.checkConsistency\b/);
        expect(src).not.toMatch(/consistency\.aiCheck\b/);
        expect(src).toMatch(/consistency\.quickCheck\(projectId, Number\(chapterNumber\)/);
    });
});
