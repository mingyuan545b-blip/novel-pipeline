import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import useAppStore from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
    // hook 用的是具名导出 api（axios 实例）；原 mock 只给了 default，导致保存路径实际未被覆盖
    api: {
        get: vi.fn(() => Promise.resolve({ data: { hasKey: true, provider: 'deepseek' } })),
        post: vi.fn(() => Promise.resolve({ data: {} })),
        put: vi.fn(() => Promise.resolve({ data: {} })),
        delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
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

    test('saves settings（真的 POST 到 /settings 且回填 state）', async () => {
        const mod = await import('../../services/api');
        mod.api.post.mockClear();
        mod.api.get.mockResolvedValue({ data: { hasKey: true, provider: 'deepseek' } });

        const { result } = renderHook(() => useSettingsState(), { wrapper: createWrapper() });
        await act(async () => {
            await result.current.saveSettings();
        });

        expect(mod.api.post).toHaveBeenCalledWith('/settings', expect.any(Object));
        expect(result.current.saving).toBe(false);
        expect(result.current.saveMsg).toMatchObject({ type: 'success' });
    });

    test('updates form', () => {
        const { result } = renderHook(() => useSettingsState(), { wrapper: createWrapper() });
        act(() => {
            result.current.setForm(prev => ({ ...prev, provider: 'deepseek' }));
        });
        expect(result.current.form.provider).toBe('deepseek');
    });
});
