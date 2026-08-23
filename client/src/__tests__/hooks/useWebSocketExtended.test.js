import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectEvents, useWSEvent } from '../../hooks/useWebSocket';

vi.mock('../../services/wsClient', () => ({
    default: {
        status: 'disconnected',
        _statusListeners: [],
        _subscriptions: {},
        onStatusChange(cb) {
            this._statusListeners.push(cb);
            return () => { this._statusListeners = this._statusListeners.filter(l => l !== cb); };
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        subscribe: vi.fn(function(pid, cb) {
            if (!this._subscriptions[pid]) this._subscriptions[pid] = [];
            this._subscriptions[pid].push(cb);
        }),
        unsubscribe: vi.fn(function(pid, cb) {
            if (this._subscriptions[pid]) {
                this._subscriptions[pid] = this._subscriptions[pid].filter(l => l !== cb);
            }
        }),
        on: vi.fn(() => vi.fn()),
        clearAll: vi.fn()
    }
}));

import wsManager from '../../services/wsClient';

describe('useProjectEvents', () => {
    beforeEach(() => {
        wsManager._subscriptions = {};
        vi.clearAllMocks();
    });

    test('does not subscribe when projectId is null', () => {
        renderHook(() => useProjectEvents(null));
        expect(wsManager.subscribe).not.toHaveBeenCalled();
    });

    test('subscribes to project events', () => {
        renderHook(() => useProjectEvents('p1'));
        expect(wsManager.subscribe).toHaveBeenCalledWith('p1', expect.any(Function));
    });

    test('unsubscribes on unmount', () => {
        const { unmount } = renderHook(() => useProjectEvents('p1'));
        unmount();
        expect(wsManager.unsubscribe).toHaveBeenCalledWith('p1', expect.any(Function));
    });

    test('receives events', () => {
        const { result } = renderHook(() => useProjectEvents('p1'));
        act(() => {
            const subs = wsManager._subscriptions['p1'];
            if (subs && subs.length > 0) {
                subs[0]({ event: 'pipeline:step', data: 'writer' });
            }
        });
        expect(result.current).toEqual({ event: 'pipeline:step', data: 'writer' });
    });
});

describe('useWSEvent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('subscribes to specific event', () => {
        const callback = vi.fn();
        renderHook(() => useWSEvent('pipeline:step', callback));
        expect(wsManager.on).toHaveBeenCalledWith('pipeline:step', expect.any(Function));
    });
});
