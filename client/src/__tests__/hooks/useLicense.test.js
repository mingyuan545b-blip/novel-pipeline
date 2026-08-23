import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useLicenseStatus, useActivateLicense, LICENSE_KEYS } from '../../hooks/useLicense';

vi.mock('../../services/api', () => ({
    licenseApi: {
        getStatus: vi.fn(() => Promise.resolve({ data: { level: 'free', licensed: false } })),
        activate: vi.fn((_key) => Promise.resolve({ data: { level: 'pro', licensed: true } })),
    }
}));

describe('LICENSE_KEYS', () => {
    test('generates correct key structures', () => {
        expect(LICENSE_KEYS.all).toEqual(['license']);
        expect(LICENSE_KEYS.status()).toEqual(['license', 'status']);
    });
});

describe('useLicenseStatus', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('fetches license status', async () => {
        const { result } = renderHook(() => useLicenseStatus(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.level).toBe('free');
    });
});

describe('useActivateLicense', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('activates license', async () => {
        const { result } = renderHook(() => useActivateLicense(), { wrapper: createWrapper() });
        act(() => { result.current.mutate('TEST-KEY'); });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.level).toBe('pro');
    });
});
