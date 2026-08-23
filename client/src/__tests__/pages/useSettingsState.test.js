import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useAppStore from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
    settingsApi: {
        get: vi.fn(() => Promise.resolve({ data: { hasKey: true, provider: 'aliyun-coding' } })),
        save: vi.fn((d) => Promise.resolve({ data: d })),
    },
    default: {
        get: vi.fn(() => Promise.resolve({ data: { data: { keys: [] } } })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

vi.mock('../../pages/settings/settingsConstants', () => ({
    API_BASE: '',
    getProvider: vi.fn(() => ({ name: 'TestProvider' })),
}));

import useSettingsState from '../../pages/settings/useSettingsState';

describe('useSettingsState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        act(() => {
            useAppStore.setState({
                settings: { hasKey: true, provider: 'aliyun-coding' },
            });
        });
    });

    test('returns initial state', () => {
        const { result } = renderHook(() => useSettingsState(), { wrapper: createWrapper() });
        expect(result.current.saving).toBe(false);
        expect(result.current.testing).toBe(false);
    });

    test('saves settings', async () => {
        const { result } = renderHook(() => useSettingsState(), { wrapper: createWrapper() });
        await act(async () => {
            await result.current.saveSettings();
        });
    });

    test('updates form', () => {
        const { result } = renderHook(() => useSettingsState(), { wrapper: createWrapper() });
        act(() => {
            result.current.setForm(prev => ({ ...prev, provider: 'deepseek' }));
        });
        expect(result.current.form.provider).toBe('deepseek');
    });
});
