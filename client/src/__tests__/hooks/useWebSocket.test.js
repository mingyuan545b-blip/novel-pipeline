import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocketStatus, useConnectWebSocket } from '../../hooks/useWebSocket';

vi.mock('../../services/wsClient', () => ({
    default: {
        status: 'disconnected',
        _listeners: [],
        onStatusChange(cb) {
            this._listeners.push(cb);
            return () => { this._listeners = this._listeners.filter(l => l !== cb); };
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        on: vi.fn(() => vi.fn()),
        clearAll: vi.fn()
    }
}));

import wsManager from '../../services/wsClient';

describe('useWebSocketStatus', () => {
    beforeEach(() => {
        wsManager.status = 'disconnected';
        wsManager._listeners = [];
    });

    test('returns initial status', () => {
        const { result } = renderHook(() => useWebSocketStatus());
        expect(result.current).toBe('disconnected');
    });

    test('updates on status change', () => {
        const { result } = renderHook(() => useWebSocketStatus());
        act(() => {
            wsManager._listeners.forEach(cb => cb('connected'));
        });
        expect(result.current).toBe('connected');
    });
});

describe('useConnectWebSocket', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('provides connect and disconnect functions', () => {
        const { result } = renderHook(() => useConnectWebSocket());
        expect(typeof result.current.connect).toBe('function');
        expect(typeof result.current.disconnect).toBe('function');
    });

    test('connect calls wsManager.connect', () => {
        const { result } = renderHook(() => useConnectWebSocket());
        act(() => { result.current.connect('test-token'); });
        expect(wsManager.connect).toHaveBeenCalledWith('test-token');
    });

    test('disconnect calls wsManager.disconnect', () => {
        const { result } = renderHook(() => useConnectWebSocket());
        act(() => { result.current.disconnect(); });
        expect(wsManager.disconnect).toHaveBeenCalled();
    });
});
