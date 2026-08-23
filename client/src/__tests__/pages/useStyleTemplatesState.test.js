/**
 * useStyleTemplatesState hook tests
 */
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/api', () => ({
    styleTemplateApi: {
        listTemplates: vi.fn().mockResolvedValue({ data: [] }),
        createTemplate: vi.fn().mockResolvedValue({ data: {} }),
        updateTemplate: vi.fn().mockResolvedValue({ data: {} }),
        deleteTemplate: vi.fn().mockResolvedValue({ data: {} }),
        analyze: vi.fn().mockResolvedValue({ data: {} }),
        importDirect: vi.fn().mockResolvedValue({ data: {} }),
        learnFromChapter: vi.fn().mockResolvedValue({ data: {} }),
        applyToProject: vi.fn().mockResolvedValue({ data: {} }),
    },
    projectsApi: { list: vi.fn().mockResolvedValue({ data: [] }) }
}));

vi.mock('../../store/useAppStore', () => ({
    __esModule: true,
    default: vi.fn((sel) => sel ? sel({ currentProject: { id: 'proj-1', styleTemplateId: 'tpl-1' }, setProjects: vi.fn() }) : { currentProject: { id: 'proj-1', styleTemplateId: 'tpl-1' }, setProjects: vi.fn() }),
}));

import useStyleTemplatesState, { RULE_LABELS, SOURCE_LABELS } from '../../pages/style-templates/useStyleTemplatesState';

describe('useStyleTemplatesState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('exports RULE_LABELS and SOURCE_LABELS', () => {
        expect(RULE_LABELS.sentenceStyle).toBe('句式风格');
        expect(SOURCE_LABELS.manual).toContain('手动创建');
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => useStyleTemplatesState());
        expect(result.current.templates).toEqual([]);
        expect(result.current.selectedTemplate).toBeNull();
        expect(result.current.showForm).toBe(false);
        expect(result.current.loading).toBe(false);
        expect(result.current.form.name).toBe('');
    });

    test('openCreate sets showForm and resets form', () => {
        const { result } = renderHook(() => useStyleTemplatesState());
        act(() => { result.current.openCreate(); });
        expect(result.current.showForm).toBe(true);
        expect(result.current.selectedTemplate).toBeNull();
    });

    test('openEdit sets form from template', () => {
        const { result } = renderHook(() => useStyleTemplatesState());
        act(() => {
            result.current.openEdit({
                id: 'tpl-1', name: 'Test', description: 'desc', tags: ['tag1'],
                rules: { sentenceStyle: 'short', forbidden: ['bad'] }, example: 'ex'
            });
        });
        expect(result.current.showForm).toBe(true);
        expect(result.current.form.name).toBe('Test');
        expect(result.current.form.rules.sentenceStyle).toBe('short');
    });

    test('closeForm hides form', () => {
        const { result } = renderHook(() => useStyleTemplatesState());
        act(() => { result.current.openCreate(); });
        act(() => { result.current.closeForm(); });
        expect(result.current.showForm).toBe(false);
    });

    test('addForbidden adds to form', () => {
        const { result } = renderHook(() => useStyleTemplatesState());
        act(() => { result.current.openCreate(); });
        act(() => { result.current.setNewForbidden('no-swear'); });
        act(() => { result.current.addForbidden(); });
        expect(result.current.form.rules.forbidden).toContain('no-swear');
    });

    test('addTag adds to form', () => {
        const { result } = renderHook(() => useStyleTemplatesState());
        act(() => { result.current.openCreate(); });
        act(() => { result.current.setNewTag('fantasy'); });
        act(() => { result.current.addTag(); });
        expect(result.current.form.tags).toContain('fantasy');
    });

    test('removeForbidden removes item', () => {
        const { result } = renderHook(() => useStyleTemplatesState());
        act(() => { result.current.openCreate(); });
        act(() => { result.current.setNewForbidden('bad1'); result.current.addForbidden(); });
        act(() => { result.current.removeForbidden(0); });
        expect(result.current.form.rules.forbidden).toHaveLength(0);
    });

    test('removeTag removes item', () => {
        const { result } = renderHook(() => useStyleTemplatesState());
        act(() => { result.current.openCreate(); });
        act(() => { result.current.setNewTag('tag1'); result.current.addTag(); });
        act(() => { result.current.removeTag(0); });
        expect(result.current.form.tags).toHaveLength(0);
    });

    test('handleSave skips without name', async () => {
        const { styleTemplateApi } = await import('../../services/api');
        const { result } = renderHook(() => useStyleTemplatesState());
        await act(async () => { await result.current.handleSave(); });
        expect(styleTemplateApi.createTemplate).not.toHaveBeenCalled();
    });

    test('handleDelete cancels when user declines', async () => {
        vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
        const { result } = renderHook(() => useStyleTemplatesState());
        await act(async () => { await result.current.handleDelete('tpl-1'); });
        const { styleTemplateApi } = await import('../../services/api');
        expect(styleTemplateApi.deleteTemplate).not.toHaveBeenCalled();
        window.confirm.mockRestore();
    });

    test('handleAnalyze alerts when text too short', async () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        const { result } = renderHook(() => useStyleTemplatesState());
        act(() => { result.current.setAnalyzeText('short'); });
        await act(async () => { await result.current.handleAnalyze(); });
        expect(alertSpy).toHaveBeenCalled();
        alertSpy.mockRestore();
    });
});
