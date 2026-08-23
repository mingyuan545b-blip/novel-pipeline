import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useUpdateSettings } from '../../hooks/queries/useSettings';

vi.mock('../../services/api', () => ({
    settingsApi: {
        get: vi.fn(() => Promise.resolve({ data: { hasKey: true } })),
        save: vi.fn((d) => Promise.resolve({ data: d })),
    },
    promptConfigApi: {
        listConstraintPresets: vi.fn(() => Promise.resolve({ data: [] })),
    },
    styleTemplateApi: {
        listTemplates: vi.fn(() => Promise.resolve({ data: [] })),
    }
}));

describe('useUpdateSettings', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('saves settings', async () => {
        const { result } = renderHook(() => useUpdateSettings(), { wrapper: createWrapper() });
        act(() => { result.current.mutate({ provider: 'aliyun' }); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.provider).toBe('aliyun');
    });
});
