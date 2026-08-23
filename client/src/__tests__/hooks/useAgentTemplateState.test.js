import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../hooks/queries', () => ({
    useAgentTemplates: vi.fn(() => ({ data: [{ id: 't1', system: 'test prompt' }] })),
    useUpdateAgentTemplate: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

import { useAgentTemplateState } from '../../pages/agents/useAgentTemplateState';

describe('useAgentTemplateState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('should initialize with null template', () => {
        const { result } = renderHook(() => useAgentTemplateState());
        expect(result.current.selectedTemplate).toBeNull();
        expect(result.current.templateEditSystem).toBe('');
        expect(result.current.templateSaving).toBe(false);
        expect(result.current.templateHasChanges).toBe(false);
    });

    it('should select template and populate edit fields', () => {
        const { result } = renderHook(() => useAgentTemplateState());
        act(() => {
            result.current.selectTemplate({ id: 't1', system: 'test prompt' });
        });
        expect(result.current.selectedTemplate).toEqual({ id: 't1', system: 'test prompt' });
        expect(result.current.templateEditSystem).toBe('test prompt');
        expect(result.current.templateHasChanges).toBe(false);
    });

    it('should detect changes after editing', () => {
        const { result } = renderHook(() => useAgentTemplateState());
        act(() => {
            result.current.selectTemplate({ id: 't1', system: 'original' });
        });
        expect(result.current.templateHasChanges).toBe(false);
        act(() => {
            result.current.setTemplateEditSystem('modified');
        });
        expect(result.current.templateHasChanges).toBe(true);
    });

    it('should handle template with no system', () => {
        const { result } = renderHook(() => useAgentTemplateState());
        act(() => {
            result.current.selectTemplate({ id: 't2' });
        });
        expect(result.current.templateEditSystem).toBe('');
    });

    it('should provide templates list', () => {
        const { result } = renderHook(() => useAgentTemplateState());
        expect(result.current.templates).toEqual([{ id: 't1', system: 'test prompt' }]);
    });
});
