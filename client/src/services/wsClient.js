import { WS_PING_INTERVAL, scheduleReconnect, fetchTicket, buildWsUrl } from './wsHelpers';
import logger from '../shared/logger';

class WebSocketManager {
    constructor() {
        this._ws = null;
        this._status = 'disconnected';
        this._listeners = new Map();
        this._projectCallbacks = new Map();
        this._reconnectTimer = null;
        this._reconnectAttempts = 0;
        this._pingTimer = null;
        this._token = null;
        this._url = null;
        this._statusListeners = new Set();
        this._intentionalClose = false;
    }

    get status() { return this._status; }

    async connect(token) {
        if (this._ws && (this._ws.readyState === WebSocket.CONNECTING || this._ws.readyState === WebSocket.OPEN)) return;
        this._token = token;
        this._intentionalClose = false;
        let wsUrl = buildWsUrl(null);
        try {
            const ticket = await fetchTicket(token);
            if (this._intentionalClose) return;
            wsUrl = buildWsUrl(ticket);
        } catch (e) { logger.warn('WS', 'Failed to fetch ticket, connecting without:', e.message); }
        this._url = wsUrl;
        this._setStatus('connecting');
        try { this._ws = new WebSocket(wsUrl); } catch (e) { logger.warn('WS', 'Failed to create WebSocket:', e.message); this._scheduleReconnect(); return; }
        this._ws.onopen = () => { this._setStatus('connected'); this._reconnectAttempts = 0; this._startPing(); this._resubscribe(); };
        this._ws.onmessage = (event) => { try { this._dispatch(JSON.parse(event.data)); } catch (e) { logger.warn('WS', 'Invalid message:', e.message); } };
        this._ws.onclose = () => { this._stopPing(); this._setStatus('disconnected'); if (!this._intentionalClose) this._scheduleReconnect(); };
        this._ws.onerror = () => { logger.warn('WS', 'Connection error'); };
    }

    disconnect() {
        this._intentionalClose = true;
        this._clearReconnect();
        this._stopPing();
        if (this._ws) { try { this._ws.close(1000, 'Client disconnect'); } catch { /* cleanup */ } this._ws = null; }
        this._setStatus('disconnected');
    }

    subscribe(projectId, callback) {
        if (!projectId) return;
        if (!this._projectCallbacks.has(projectId)) this._projectCallbacks.set(projectId, new Set());
        this._projectCallbacks.get(projectId).add(callback);
        if (this._ws?.readyState === WebSocket.OPEN) this._send({ type: 'subscribe', projectId });
    }

    unsubscribe(projectId, callback) {
        if (!projectId) return;
        const callbacks = this._projectCallbacks.get(projectId);
        if (!callbacks) return;
        if (callback) { callbacks.delete(callback); if (callbacks.size === 0) { this._projectCallbacks.delete(projectId); this._sendUnsubscribe(projectId); } }
        else { this._projectCallbacks.delete(projectId); this._sendUnsubscribe(projectId); }
    }

    on(event, callback) {
        if (!this._listeners.has(event)) this._listeners.set(event, new Set());
        this._listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) { this._listeners.get(event)?.delete(callback); }

    onStatusChange(callback) { this._statusListeners.add(callback); callback(this._status); return () => this._statusListeners.delete(callback); }

    _setStatus(status) {
        if (this._status === status) return;
        this._status = status;
        this._statusListeners.forEach(cb => { try { cb(status); } catch (e) { logger.warn('WS', 'Status listener error:', e.message); } });
    }

    _dispatch(msg) {
        if (!msg.event) return;
        if (msg.projectId && this._projectCallbacks.has(msg.projectId)) {
            this._projectCallbacks.get(msg.projectId).forEach(cb => { try { cb(msg); } catch (e) { logger.warn('WS', 'Project callback error:', e.message); } });
        }
        this._listeners.get(msg.event)?.forEach(cb => { try { cb(msg.data, msg); } catch (e) { logger.warn('WS', 'Event listener error:', e.message); } });
        this._listeners.get('*')?.forEach(cb => { try { cb(msg); } catch (e) { logger.warn('WS', 'Wildcard listener error:', e.message); } });
    }

    _send(msg) { if (this._ws?.readyState === WebSocket.OPEN) try { this._ws.send(JSON.stringify(msg)); } catch (e) { logger.warn('WS', 'Send failed:', e.message); } }
    _sendUnsubscribe(projectId) { if (this._ws?.readyState === WebSocket.OPEN) this._send({ type: 'unsubscribe', projectId }); }
    _resubscribe() { this._projectCallbacks.forEach((_, projectId) => { this._send({ type: 'subscribe', projectId }); }); }
    _scheduleReconnect() { this._clearReconnect(); this._reconnectAttempts++; this._reconnectTimer = scheduleReconnect(this._reconnectAttempts - 1, () => this.connect(this._token)); }
    _clearReconnect() { if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; } }
    _startPing() { this._stopPing(); this._pingTimer = setInterval(() => this._send({ type: 'ping' }), WS_PING_INTERVAL); }
    _stopPing() { if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; } }
    clearAll() { this._listeners.clear(); this._projectCallbacks.clear(); this._statusListeners.clear(); }
}

const wsManager = new WebSocketManager();
export default wsManager;
