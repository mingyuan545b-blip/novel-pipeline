import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';

vi.mock('../../services/api', () => ({
    integrityApi: {
        check: vi.fn(() => Promise.resolve({ data: { issues: [] } })),
        fix: vi.fn(() => Promise.resolve({ data: { fixed: 0 } })),
    },
    flavorsApi: {
        getProjectPrompt: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

import { useMaterialsIntegrityState } from '../../pages/materials/useMaterialsIntegrityState';

describe('useMaterialsIntegrityState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', () => {
        const { result } = renderHook(
            () => useMaterialsIntegrityState({ id: 'p1' }, vi.fn()),
            { wrapper: createWrapper() }
        );
        expect(result.current.showPromptPanel).toBe(false);
        expect(result.current.showIntegrityPanel).toBe(false);
    });

    test('sets show prompt panel', () => {
        const { result } = renderHook(
            () => useMaterialsIntegrityState({ id: 'p1' }, vi.fn()),
            { wrapper: createWrapper() }
        );
        act(() => { result.current.setShowPromptPanel(true); });
        expect(result.current.showPromptPanel).toBe(true);
    });
});
