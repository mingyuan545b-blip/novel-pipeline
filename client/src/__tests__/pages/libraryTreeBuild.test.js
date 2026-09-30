/**
 * libraryTreeBuild.test.js — 藏经阁"条目→树/统计/筛选"纯函数测试
 * 对应需求：用户要"优先展示有数据的""按已提取的书查看"，这两件事都靠这里的筛选与计数。
 */
import { describe, test, expect } from 'vitest';
import {
    DEPT_DEPTH, resolveDepth, buildTrees, countByCompleteness, filterEntries, collectExpandKeys,
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
