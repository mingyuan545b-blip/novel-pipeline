/**
 * libraryTreeBuild.test.js — 藏经阁"条目→树/统计/筛选"纯函数测试
 * 对应需求：用户要"优先展示有数据的""按已提取的书查看"，这两件事都靠这里的筛选与计数。
 */
import { describe, test, expect } from 'vitest';
import {
    DEPT_DEPTH, resolveDepth, buildTrees, countByCompleteness, filterEntries, collectExpandKeys,
    groupBySource, sourceOf, UNKNOWN_SOURCE,
} from '../../pages/library/libraryTreeBuild';

const E = (over = {}) => ({
    id: 'x', display_name: 'n', department: '02_情节引擎部', subcategory: '01_冲突类型',
    completeness: 'empty', sourceNovel: '', modes: ['novel'], ...over,
});

describe('resolveDepth', () => {
    test('服务端 worldviewDepth 优先', () => {
        expect(resolveDepth(E({ worldviewDepth: 'micro', department: '06_世界构建部' }))).toBe('micro');
    });
    test('缺失时按部门兜底，未知部门回落 meso', () => {
        expect(resolveDepth(E({ department: '05_文笔滤镜部' }))).toBe('micro');
        expect(resolveDepth(E({ department: '99_未知部' }))).toBe('meso');
        expect(resolveDepth(undefined)).toBe('meso');
    });
    test('DEPT_DEPTH 覆盖 7 个部门', () => {
        expect(Object.keys(DEPT_DEPTH)).toHaveLength(7);
    });
});

describe('buildTrees', () => {
    test('部门树与深度树同源，条目数一致', () => {
        const entries = [E({ id: 'a', department: '05_文笔滤镜部', subcategory: '01_句式与节奏' })];
        const { tree, byDepth } = buildTrees(entries);
        expect(tree['05_文笔滤镜部']['01_句式与节奏']).toHaveLength(1);
        expect(byDepth.micro['05_文笔滤镜部']['01_句式与节奏']).toHaveLength(1);
    });
    test('空输入返回空树', () => {
        const { tree, byDepth } = buildTrees([]);
        expect(tree).toEqual({});
        expect(byDepth).toEqual({});
    });
});

describe('countByCompleteness', () => {
    test('按完整度计数并回传当前筛选', () => {
        const c = countByCompleteness([E({ completeness: 'full' }), E({ completeness: 'empty' }), E({ completeness: 'empty' })], 'empty');
        expect(c).toMatchObject({ total: 3, full: 1, empty: 2, active: 'empty' });
    });
});

describe('filterEntries', () => {
    const entries = [
        E({ id: '1', completeness: 'full', sourceNovel: '全球死考', modes: ['novel'] }),
        E({ id: '2', completeness: 'empty', sourceNovel: '通用技法体系', modes: ['novel'] }),
        E({ id: '3', completeness: 'full', sourceNovel: '', modes: ['shuangwen'] }),
    ];
    test('按完整度筛选（"只看有内容"）', () => {
        expect(filterEntries(entries, { completeness: 'full' }).map(e => e.id)).toEqual(['1', '3']);
    });
    test('按来源筛选（"前面那本提取了什么"）', () => {
        expect(filterEntries(entries, { source: '全球死考' }).map(e => e.id)).toEqual(['1']);
    });
    test('来源为空的条目归入"（未标注来源）"', () => {
        expect(filterEntries(entries, { source: '（未标注来源）' }).map(e => e.id)).toEqual(['3']);
    });
    test('按模式筛选 + 多条件叠加', () => {
        expect(filterEntries(entries, { mode: 'shuangwen' }).map(e => e.id)).toEqual(['3']);
        expect(filterEntries(entries, { mode: 'novel', completeness: 'full' }).map(e => e.id)).toEqual(['1']);
    });
    test('空条件返回全部', () => {
        expect(filterEntries(entries, {})).toHaveLength(3);
    });
});

/**
 * groupBySource —— 回归：用户点「按来源」里的《全球死考》后"什么东西都没变化"。
 * 根因是来源视图只设筛选条件、没有渲染该来源的条目列表；分组函数是列表的数据来源，
 * 因此必须保证"点哪本书 → 拿到那本书的全部条目"，且分组键与服务端 /sources 一致。
 */
describe('groupBySource', () => {
    const entries = [
        E({ id: '1', sourceNovel: '全球死考' }),
        E({ id: '2', sourceNovel: '全球死考' }),
        E({ id: '3', sourceNovel: '' }),
        E({ id: '4', sourceNovel: '另一本' }),
    ];

    test('按 sourceNovel 分组，顺序与入参一致（服务端已按有内容优先排序）', () => {
        const g = groupBySource(entries);
        expect(g['全球死考'].map(e => e.id)).toEqual(['1', '2']);
        expect(g['另一本'].map(e => e.id)).toEqual(['4']);
    });

    test('无来源条目归入 UNKNOWN_SOURCE（与 /api/library/sources 的分组键必须一致）', () => {
        expect(UNKNOWN_SOURCE).toBe('（未标注来源）');
        expect(groupBySource(entries)[UNKNOWN_SOURCE].map(e => e.id)).toEqual(['3']);
        expect(sourceOf(E({ sourceNovel: '' }))).toBe(UNKNOWN_SOURCE);
    });

    test('分组结果可直接喂给 filterEntries —— 组内每条都命中该来源筛选', () => {
        const list = groupBySource(entries)['全球死考'];
        expect(filterEntries(entries, { source: '全球死考' }).map(e => e.id)).toEqual(list.map(e => e.id));
    });

    test('空输入不抛错', () => {
        expect(groupBySource(undefined)).toEqual({});
        expect(groupBySource([])).toEqual({});
    });
});

describe('collectExpandKeys', () => {
    test('同时覆盖部门视图与深度视图的 key（否则切视图后全折叠）', () => {
        const { tree, byDepth } = buildTrees([E({ id: 'a', department: '05_文笔滤镜部', subcategory: '01_句式与节奏' })]);
        const keys = collectExpandKeys(tree, byDepth);
        expect(keys.has('05_文笔滤镜部')).toBe(true);
        expect(keys.has('05_文笔滤镜部/01_句式与节奏')).toBe(true);
        expect(keys.has('micro')).toBe(true);
        expect(keys.has('micro/05_文笔滤镜部')).toBe(true);
        expect(keys.has('micro/05_文笔滤镜部/01_句式与节奏')).toBe(true);
    });
});
