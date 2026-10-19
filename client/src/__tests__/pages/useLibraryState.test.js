import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useAppStore from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
    libraryApi: {
        list: vi.fn(() => Promise.resolve({ data: [] })),
        create: vi.fn((d) => Promise.resolve({ data: d })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
        getIndex: vi.fn(() => Promise.resolve({ data: { entries: [] } })),
        getStats: vi.fn(() => Promise.resolve({ data: {} })),
        getTechnique: vi.fn(() => Promise.resolve({ data: {} })),
        search: vi.fn(() => Promise.resolve({ data: [] })),
        updateTechnique: vi.fn(() => Promise.resolve({ data: {} })),
        updateMeta: vi.fn(() => Promise.resolve({ data: {} })),
        resetMeta: vi.fn(() => Promise.resolve({ data: {} })),
        getFeedback: vi.fn(() => Promise.resolve({ data: { techniques: [] } })),
    },
}));

import { libraryApi } from '../../services/api';
import useLibraryState, {
    DEPT_ICONS, DEPT_COLORS, SLOT_LABELS, cleanName, DEPT_DEPTH, resolveDepth,
} from '../../pages/library/useLibraryState';

describe('DEPT_ICONS', () => {
    test('has icons for departments', () => {
        expect(Object.keys(DEPT_ICONS).length).toBeGreaterThan(0);
    });
});

describe('cleanName', () => {
    test('removes numeric prefix', () => {
        expect(cleanName('00_叙事之魂部')).toBe('叙事之魂部');
        expect(cleanName('01_顶层设计部')).toBe('顶层设计部');
    });
    test('handles empty input', () => {
        expect(cleanName(undefined)).toBe('');
        expect(cleanName('')).toBe('');
    });
});

describe('resolveDepth（深度分类回归：原实现按色值比部门名，恒不相等 → micro 永不成立）', () => {
    test('优先使用服务端 worldviewDepth 字段（SSOT）', () => {
        expect(resolveDepth({ worldviewDepth: 'micro', department: '06_世界构建部' })).toBe('micro');
    });

    test('字段缺失时按部门兜底', () => {
        expect(resolveDepth({ department: '05_文笔滤镜部' })).toBe('micro');
        expect(resolveDepth({ department: '00_叙事之魂部' })).toBe('macro');
        expect(resolveDepth({ department: '02_情节引擎部' })).toBe('meso');
    });

    test('未知部门/空条目回落 meso，不抛错', () => {
        expect(resolveDepth({ department: '99_未知部' })).toBe('meso');
        expect(resolveDepth(undefined)).toBe('meso');
    });

    test('DEPT_DEPTH 覆盖全部 7 个部门，且取值合法', () => {
        const valid = new Set(['macro', 'meso', 'micro']);
        expect(Object.keys(DEPT_DEPTH)).toHaveLength(7);
        const entries = Object.entries(DEPT_DEPTH);
        // 失败时直接列出问题项（不用 expect 的第二参数——vitest/valid-expect 不允许）
        expect(entries.filter(([d]) => !DEPT_ICONS[d]).map(([d]) => d)).toEqual([]);
        expect(entries.filter(([d]) => !DEPT_COLORS[d]).map(([d]) => d)).toEqual([]);
        expect(entries.filter(([, depth]) => !valid.has(depth)).map(([d, depth]) => `${d}:${depth}`)).toEqual([]);
    });
});

describe('useLibraryState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({
                currentProject: { id: 'p1', name: 'Test' },
            });
        });
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        expect(result.current.searchQuery).toBe('');
        expect(result.current.treeData).toEqual({});
    });

    test('sets search query', () => {
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        act(() => { result.current.setSearchQuery('测试'); });
        expect(result.current.searchQuery).toBe('测试');
    });

    test('sets mode filter', () => {
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        act(() => { result.current.setModeFilter('novel'); });
        expect(result.current.modeFilter).toBe('novel');
    });

    test('按服务端 worldviewDepth 构建深度树', async () => {
        libraryApi.getIndex.mockResolvedValueOnce({
            data: {
                entries: [
                    { id: 't1', display_name: 'A', department: '05_文笔滤镜部', subcategory: '01_句式与节奏', worldviewDepth: 'micro' },
                    { id: 't2', display_name: 'B', department: '06_世界构建部', subcategory: '01_世界规则', worldviewDepth: 'macro' },
                ],
            },
        });
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.depthTree.micro).toBeTruthy());
        expect(Object.keys(result.current.depthTree.micro)).toEqual(['05_文笔滤镜部']);
        expect(result.current.depthTree.micro['05_文笔滤镜部']['01_句式与节奏']).toHaveLength(1);
        expect(Object.keys(result.current.depthTree.macro)).toEqual(['06_世界构建部']);
        // 部门树同源构建，两者条目数一致
        expect(result.current.treeData['05_文笔滤镜部']['01_句式与节奏']).toHaveLength(1);
    });

    test('worldviewDepth 缺失时按部门兜底，文笔滤镜部不再被错分到 meso', async () => {
        libraryApi.getIndex.mockResolvedValueOnce({
            data: { entries: [{ id: 't3', display_name: 'C', department: '05_文笔滤镜部', subcategory: '02_感官调度' }] },
        });
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.depthTree.micro).toBeTruthy());
        expect(result.current.depthTree.micro['05_文笔滤镜部']['02_感官调度']).toHaveLength(1);
        expect(result.current.depthTree.meso).toBeUndefined();
    });
});

/**
 * 回归：用户「按来源」点了《全球死考》后"什么东西都没变化，右侧什么变化都没有"。
 * 根因：点击只写了 filters.source，来源视图不渲染条目列表，右侧也无选中 → 只有边框变色。
 * 现在要求：展开该书条目 + 自动选中第一条（右侧立即有内容）+ 再点收起 + 返回能清空详情。
 */
describe('useLibraryState · 按来源展开', () => {
    const SRC_ENTRIES = [
        { id: 'a1', display_name: 'A', sourceNovel: '全球死考', completeness: 'full', department: '02_情节引擎部', subcategory: 's', modes: ['novel'] },
        { id: 'a2', display_name: 'B', sourceNovel: '全球死考', completeness: 'empty', department: '02_情节引擎部', subcategory: 's', modes: ['novel'] },
        { id: 'b1', display_name: 'C', sourceNovel: '别的书', completeness: 'full', department: '05_文笔滤镜部', subcategory: 's', modes: ['novel'] },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        libraryApi.getIndex.mockResolvedValue({ data: { entries: SRC_ENTRIES } });
        act(() => { useAppStore.setState({ currentProject: { id: 'p1', name: 'Test' } }); });
    });

    test('点书卡：展开该来源条目并自动选中第一条（右侧不再无反应）', async () => {
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.entries).toHaveLength(3));

        libraryApi.getTechnique.mockResolvedValueOnce({ data: { id: 'a1', display_name: 'A' } });
        await act(async () => { result.current.handlePickSource('全球死考'); });

        expect(result.current.filters.source).toBe('全球死考');
        expect(result.current.activeSource).toBe('全球死考');
        expect(result.current.sourceEntries['全球死考'].map(e => e.id)).toEqual(['a1', 'a2']);
        expect(result.current.selectedTech).toBe('a1');
        expect(result.current.techDetail.display_name).toBe('A');
    });

    test('再点同一本书 = 收起（清筛选），不请求技法', async () => {
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.entries).toHaveLength(3));

        await act(async () => { result.current.handlePickSource('全球死考'); });
        libraryApi.getTechnique.mockClear();
        await act(async () => { result.current.handlePickSource('全球死考'); });

        expect(result.current.filters.source).toBe('');
        expect(libraryApi.getTechnique).not.toHaveBeenCalled();
    });

    test('来源分组跟随完整度筛选（列表与筛选条件一致，不串味）', async () => {
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.entries).toHaveLength(3));

        act(() => { result.current.setFilter('completeness', 'full'); });
        await waitFor(() => expect(result.current.sourceEntries['全球死考'].map(e => e.id)).toEqual(['a1']));
        expect(result.current.sourceEntries['别的书'].map(e => e.id)).toEqual(['b1']);
    });

    test('返回：handleSelectTech(null) 清空详情且不再打接口（此前 404 被吞、右侧仍是上一条）', async () => {
        const { result } = renderHook(() => useLibraryState(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.entries).toHaveLength(3));

        libraryApi.getTechnique.mockResolvedValueOnce({ data: { id: 'a1', display_name: 'A' } });
        await act(async () => { await result.current.handleSelectTech('a1'); });
        expect(result.current.techDetail.display_name).toBe('A');

        libraryApi.getTechnique.mockClear();
        await act(async () => { await result.current.handleSelectTech(null); });
        expect(result.current.selectedTech).toBeNull();
        expect(result.current.techDetail).toBeNull();
        expect(libraryApi.getTechnique).not.toHaveBeenCalled();
    });
});
