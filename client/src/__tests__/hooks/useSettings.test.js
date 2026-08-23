import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useSettings, SETTINGS_KEYS } from '../../hooks/queries/useSettings';

vi.mock('../../services/api', () => ({
    settingsApi: {
        get: vi.fn(() => Promise.resolve({ data: { hasKey: true, provider: 'aliyun' } })),
        save: vi.fn((d) => Promise.resolve({ data: d })),
    },
    promptConfigApi: {
        listConstraintPresets: vi.fn(() => Promise.resolve({ data: [] })),
    },
    styleTemplateApi: {
        listTemplates: vi.fn(() => Promise.resolve({ data: [] })),
    }
}));

describe('SETTINGS_KEYS', () => {
    test('generates correct key structures', () => {
        expect(SETTINGS_KEYS.all).toEqual(['settings']);
        expect(SETTINGS_KEYS.detail()).toEqual(['settings', 'detail']);
        expect(SETTINGS_KEYS.constraintPresets()).toEqual(['settings', 'constraints']);
    });
});

describe('useSettings', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('fetches settings', async () => {
        const { result } = renderHook(() => useSettings(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.hasKey).toBe(true);
    });
});
