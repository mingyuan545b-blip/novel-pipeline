/**
 * useWorkshopState hook tests
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/api', () => ({
    workshopApi: {
        importSettingText: vi.fn().mockResolvedValue({ data: {} }),
        importSettingFiles: vi.fn().mockResolvedValue({ data: {} }),
        generateMaterials: vi.fn().mockResolvedValue({ data: {} }),
        generateOutlines: vi.fn().mockResolvedValue({ data: {} }),
        fuseNovelsText: vi.fn().mockResolvedValue({ data: {} }),
        fuseNovelsFiles: vi.fn().mockResolvedValue({ data: {} }),
        validateTemplate: vi.fn().mockResolvedValue({ data: { valid: true, errors: [], warnings: [], summary: {} } }),
        importTemplate: vi.fn().mockResolvedValue({ data: {} }),
        exportTemplate: vi.fn().mockResolvedValue({ data: {} }),
    },
    materialsApi: { list: vi.fn().mockResolvedValue({ data: [] }) },
    chaptersApi: { list: vi.fn().mockResolvedValue({ data: [] }) }
}));

const STORE_OBJ = { currentProject: { id: 'proj-1', name: 'Test' }, setMaterials: vi.fn(), setChapters: vi.fn() };

vi.mock('../../store/useAppStore', () => ({
    __esModule: true,
    default: vi.fn((sel) => sel ? sel(STORE_OBJ) : STORE_OBJ),
}));

import useWorkshopState from '../../pages/workshop/useWorkshopState';

describe('useWorkshopState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(() => useWorkshopState());
        expect(result.current.activeTab).toBe('import');
        expect(result.current.loading).toBe(false);
        expect(result.current.result).toBeNull();
        expect(result.current.importState).toBeDefined();
        expect(result.current.fusionState).toBeDefined();
        expect(result.current.templateState).toBeDefined();
    });

    test('switchTab changes tab and clears result', () => {
        const { result } = renderHook(() => useWorkshopState());
        act(() => { result.current.switchTab('fusion'); });
        expect(result.current.activeTab).toBe('fusion');
    });

    test('setImportState updates state', () => {
        const { result } = renderHook(() => useWorkshopState());
        act(() => { result.current.setImportState(prev => ({ ...prev, settingText: 'test text' })); });
        expect(result.current.importState.settingText).toBe('test text');
    });

    test('addFusionNovel adds slot', () => {
        const { result } = renderHook(() => useWorkshopState());
        act(() => { result.current.addFusionNovel(); });
        expect(result.current.fusionState.novels).toHaveLength(3);
    });

    test('removeFusionNovel removes slot', () => {
        const { result } = renderHook(() => useWorkshopState());
        act(() => { result.current.removeFusionNovel(0); });
        expect(result.current.fusionState.novels).toHaveLength(1);
    });

    test('updateFusionNovel updates text', () => {
        const { result } = renderHook(() => useWorkshopState());
        act(() => { result.current.updateFusionNovel(0, 'Novel text here'); });
        expect(result.current.fusionState.novels[0]).toBe('Novel text here');
    });

    test('handleImportText alerts without project', async () => {
        const useAppStore = (await import('../../store/useAppStore')).default;
        const noProjectStore = { currentProject: null, setMaterials: vi.fn(), setChapters: vi.fn() };
        useAppStore.mockImplementationOnce((sel) => sel ? sel(noProjectStore) : noProjectStore);
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const { result } = renderHook(() => useWorkshopState());
        await act(async () => { await result.current.handleImportText(); });
        expect(alertSpy).toHaveBeenCalled();
        alertSpy.mockRestore();
    });

    test('handleFuseText alerts with < 2 novels', async () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const { result } = renderHook(() => useWorkshopState());
        await act(async () => { await result.current.handleFuseText(); });
        expect(alertSpy).toHaveBeenCalledWith('请至少输入2本小说文本');
        alertSpy.mockRestore();
    });

    test('handleFuseFiles alerts with < 2 files', async () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const { result } = renderHook(() => useWorkshopState());
        await act(async () => { await result.current.handleFuseFiles(); });
        expect(alertSpy).toHaveBeenCalledWith('请至少上传2个小说文件');
        alertSpy.mockRestore();
    });

    test('setTemplateState updates state', () => {
        const { result } = renderHook(() => useWorkshopState());
        act(() => { result.current.setTemplateState(prev => ({ ...prev, overwrite: true })); });
        expect(result.current.templateState.overwrite).toBe(true);
    });
});
