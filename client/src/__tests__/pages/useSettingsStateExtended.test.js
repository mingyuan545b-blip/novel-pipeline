import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const STORE_OBJ = {
    settings: { provider: 'aliyunCoding', model: 'qwen3.6-plus', groupId: '', hasKey: true },
    setSettings: vi.fn(),
    theme: 'dark', setTheme: vi.fn(),
    membership: { level: 'free', licensed: false },
    bgImage: '', setBgImage: vi.fn(),
    bgOpacity: 1, setBgOpacity: vi.fn(),
    bgBlur: 0, setBgBlur: vi.fn(),
};

vi.mock('../../store/useAppStore', () => ({
    default: vi.fn((sel) => sel ? sel(STORE_OBJ) : STORE_OBJ)
}));

vi.mock('../../pages/settings/settingsConstants', () => ({
    getProvider: vi.fn().mockReturnValue({ name: '阿里云Coding', key: 'aliyunCoding' }),
    PROVIDERS: [{ name: '阿里云Coding', key: 'aliyunCoding' }],
}));

globalThis.fetch = vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue({}), ok: true });

describe('useSettingsState', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('returns initial state', async () => {
        const { default: useSettingsState } = await import('../../pages/settings/useSettingsState');
        const { result } = renderHook(() => useSettingsState());
        expect(result.current.form.provider).toBe('aliyunCoding');
        expect(result.current.form.model).toBe('qwen3.6-plus');
        expect(result.current.testing).toBe(false);
        expect(result.current.saving).toBe(false);
        expect(result.current.showAddKey).toBe(false);
    });

    test('setForm updates', async () => {
        const { default: useSettingsState } = await import('../../pages/settings/useSettingsState');
        const { result } = renderHook(() => useSettingsState());
        act(() => { result.current.setForm(prev => ({ ...prev, apiKey: 'test-key' })); });
        expect(result.current.form.apiKey).toBe('test-key');
    });

    test('setShowAddKey toggles', async () => {
        const { default: useSettingsState } = await import('../../pages/settings/useSettingsState');
        const { result } = renderHook(() => useSettingsState());
        act(() => { result.current.setShowAddKey(true); });
        expect(result.current.showAddKey).toBe(true);
    });

    test('setNewKey updates', async () => {
        const { default: useSettingsState } = await import('../../pages/settings/useSettingsState');
        const { result } = renderHook(() => useSettingsState());
        act(() => { result.current.setNewKey(prev => ({ ...prev, name: 'My Key' })); });
        expect(result.current.newKey.name).toBe('My Key');
    });

    test('currentProvider is resolved', async () => {
        const { default: useSettingsState } = await import('../../pages/settings/useSettingsState');
        const { result } = renderHook(() => useSettingsState());
        expect(result.current.currentProvider).toEqual({ name: '阿里云Coding', key: 'aliyunCoding' });
    });

    test('theme is dark', async () => {
        const { default: useSettingsState } = await import('../../pages/settings/useSettingsState');
        const { result } = renderHook(() => useSettingsState());
        expect(result.current.theme).toBe('dark');
    });

    test('membership defaults', async () => {
        const { default: useSettingsState } = await import('../../pages/settings/useSettingsState');
        const { result } = renderHook(() => useSettingsState());
        expect(result.current.membership.level).toBe('free');
    });

    test('addApiKey alerts without apiKey', async () => {
        const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        const { default: useSettingsState } = await import('../../pages/settings/useSettingsState');
        const { result } = renderHook(() => useSettingsState());
        await result.current.addApiKey();
        expect(alertSpy).toHaveBeenCalledWith('请输入API Key');
        alertSpy.mockRestore();
    });
});
