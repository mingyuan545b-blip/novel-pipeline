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
        for (const [dept, depth] of Object.entries(DEPT_DEPTH)) {
            expect(DEPT_ICONS[dept], `部门 ${dept} 缺少图标`).toBeTruthy();
            expect(DEPT_COLORS[dept], `部门 ${dept} 缺少颜色`).toBeTruthy();
            expect(valid.has(depth), `部门 ${dept} 深度非法: ${depth}`).toBe(true);
        }
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
