import { useState, useEffect, useCallback, useRef } from 'react';
import wsManager from '../services/wsClient';

export function useWebSocketStatus() {
    const [status, setStatus] = useState(wsManager.status);

    useEffect(() => {
        return wsManager.onStatusChange((newStatus) => {
            setStatus(newStatus);
        });
    }, []);

    return status;
}

export function useProjectEvents(projectId) {
    const [lastEvent, setLastEvent] = useState(null);
    const callbackRef = useRef(null);

    useEffect(() => {
        callbackRef.current = (msg) => {
            setLastEvent(msg);
        };
    });

    useEffect(() => {
        if (!projectId) return;

        const callback = (msg) => {
            callbackRef.current(msg);
        };

        wsManager.subscribe(projectId, callback);

        return () => {
            wsManager.unsubscribe(projectId, callback);
        };
    }, [projectId]);

    return lastEvent;
}

export function useWSEvent(event, callback) {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    });

    useEffect(() => {
        const handler = (data, msg) => {
            callbackRef.current(data, msg);
        };

        const unsub = wsManager.on(event, handler);
        return unsub;
    }, [event]);
}

export function useConnectWebSocket() {
    const connect = useCallback((token) => {
        wsManager.connect(token);
    }, []);

    const disconnect = useCallback(() => {
        wsManager.disconnect();
    }, []);

    return { connect, disconnect };
}
