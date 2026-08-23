import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createWrapper } from '../helpers/testUtils';
import { useVersionInfo, VERSION_KEYS } from '../../hooks/useVersion';

vi.mock('../../services/api', () => ({
    versionApi: {
        getInfo: vi.fn(() => Promise.resolve({ data: { version: '1.0.0' } })),
    }
}));

describe('VERSION_KEYS', () => {
    test('generates correct key structures', () => {
        expect(VERSION_KEYS.all).toEqual(['version']);
        expect(VERSION_KEYS.info()).toEqual(['version', 'info']);
    });
});

describe('useVersionInfo', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('fetches version info', async () => {
        const { result } = renderHook(() => useVersionInfo(), { wrapper: createWrapper() });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data.version).toBe('1.0.0');
    });
});
