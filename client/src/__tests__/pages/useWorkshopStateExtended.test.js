import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const STORE_OBJ = {
    currentProject: { id: 'p1', name: 'Test' },
    setMaterials: vi.fn(), setChapters: vi.fn(),
};

vi.mock('../../store/useAppStore', () => ({
    default: vi.fn((sel) => sel ? sel(STORE_OBJ) : STORE_OBJ)
}));

vi.mock('../../services/api', () => ({
    workshopApi: {
        importSettingText: vi.fn().mockResolvedValue({ data: { materials: [], outlines: [] } }),
        importSettingFiles: vi.fn().mockResolvedValue({ data: {} }),
        generateMaterials: vi.fn().mockResolvedValue({ data: [] }),
        generateOutlines: vi.fn().mockResolvedValue({ data: [] }),
        fuseNovelsText: vi.fn().mockResolvedValue({ data: {} }),
        fuseNovelsFiles: vi.fn().mockResolvedValue({ data: {} }),
        validateTemplate: vi.fn().mockResolvedValue({ data: { valid: true, errors: [], warnings: [], summary: {} } }),
        importTemplate: vi.fn().mockResolvedValue({ data: {} }),
        exportTemplate: vi.fn().mockResolvedValue({ data: {} }),
    },
    materialsApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
    chaptersApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../../shared/logger', () => ({
    default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}));

describe('useWorkshopState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', async () => {
        const { default: useWorkshopState } = await import('../../pages/workshop/useWorkshopState');
        const { result } = renderHook(() => useWorkshopState());
        expect(result.current.activeTab).toBe('import');
        expect(result.current.loading).toBe(false);
        expect(result.current.loadingStep).toBe('');
        expect(result.current.result).toBeNull();
    });

    test('switchTab updates activeTab and clears result', async () => {
        const { default: useWorkshopState } = await import('../../pages/workshop/useWorkshopState');
        const { result } = renderHook(() => useWorkshopState());
        act(() => { result.current.switchTab('fusion'); });
        expect(result.current.activeTab).toBe('fusion');
    });

    test('setImportState updates', async () => {
        const { default: useWorkshopState } = await import('../../pages/workshop/useWorkshopState');
        const { result } = renderHook(() => useWorkshopState());
        act(() => { result.current.setImportState(prev => ({ ...prev, settingText: 'test' })); });
        expect(result.current.importState.settingText).toBe('test');
    });

    test('setFusionState updates', async () => {
        const { default: useWorkshopState } = await import('../../pages/workshop/useWorkshopState');
        const { result } = renderHook(() => useWorkshopState());
        act(() => { result.current.setFusionState(prev => ({ ...prev, extractTechniques: true })); });
        expect(result.current.fusionState.extractTechniques).toBe(true);
    });

    test('addFusionNovel adds empty string', async () => {
        const { default: useWorkshopState } = await import('../../pages/workshop/useWorkshopState');
        const { result } = renderHook(() => useWorkshopState());
        const initialLen = result.current.fusionState.novels.length;
        act(() => { result.current.addFusionNovel(); });
        expect(result.current.fusionState.novels.length).toBe(initialLen + 1);
    });

    test('removeFusionNovel removes by index', async () => {
        const { default: useWorkshopState } = await import('../../pages/workshop/useWorkshopState');
        const { result } = renderHook(() => useWorkshopState());
        act(() => {
            result.current.setFusionState({ novels: ['novel1', 'novel2', 'novel3'], extractTechniques: false, extractElements: false, fusionAnalysis: false, files: [] });
        });
        act(() => { result.current.removeFusionNovel(1); });
        expect(result.current.fusionState.novels).toEqual(['novel1', 'novel3']);
    });

    test('updateFusionNovel updates by index', async () => {
        const { default: useWorkshopState } = await import('../../pages/workshop/useWorkshopState');
        const { result } = renderHook(() => useWorkshopState());
        act(() => {
            result.current.setFusionState({ novels: ['a', 'b'], extractTechniques: false, extractElements: false, fusionAnalysis: false, files: [] });
        });
        act(() => { result.current.updateFusionNovel(0, 'updated'); });
        expect(result.current.fusionState.novels[0]).toBe('updated');
    });

    test('handleImportText alerts without setting text', async () => {
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        const { default: useWorkshopState } = await import('../../pages/workshop/useWorkshopState');
        const { result } = renderHook(() => useWorkshopState());
        await result.current.handleImportText();
        expect(alertSpy).toHaveBeenCalledWith('请输入世界观设定文本');
        alertSpy.mockRestore();
    });
});
