/**
 * useServerVersionGuard hook tests
 * Simplified — only tests hook renders without crash
 * Full async behavior tested via E2E
 */
import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';

// Mock the entire API module to avoid vitest module resolution issues
vi.mock('../../services/api', () => ({
    healthApi: { check: vi.fn().mockResolvedValue({ data: { startedAt: '2026-01-01' } }) }
}));

import useServerVersionGuard from '../../hooks/useServerVersionGuard';

describe('useServerVersionGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    test('renders without error', () => {
        const { result } = renderHook(() => useServerVersionGuard());
        expect(result.current).toBeUndefined();
    });

    test('hook is a function', () => {
        expect(typeof useServerVersionGuard).toBe('function');
    });
});
