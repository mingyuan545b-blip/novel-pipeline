import logger from '../shared/logger';

const WS_RECONNECT_BASE_DELAY = 1000;
const WS_RECONNECT_MAX_DELAY = 30000;
const WS_PING_INTERVAL = 25000;

function scheduleReconnect(attempts, connectFn) {
    const delay = Math.min(
        WS_RECONNECT_BASE_DELAY * Math.pow(2, attempts),
        WS_RECONNECT_MAX_DELAY
    ) * (0.5 + Math.random() * 0.5);
    return setTimeout(connectFn, delay);
}

async function fetchTicket(token) {
    const effectiveToken = token || localStorage.getItem('auth_token') || '';
    if (!effectiveToken) return null;
    try {
        const response = await fetch('/api/ws/ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${effectiveToken}` }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.ticket || null;
    } catch (e) {
        logger.warn('WS', 'Ticket fetch error:', e.message);
        return null;
    }
}

function buildWsUrl(ticket) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    let wsUrl = `${protocol}//${host}/api/ws`;
    if (ticket) wsUrl += `?ticket=${encodeURIComponent(ticket)}`;
    return wsUrl;
}

export { WS_RECONNECT_BASE_DELAY, WS_RECONNECT_MAX_DELAY, WS_PING_INTERVAL, scheduleReconnect, fetchTicket, buildWsUrl };
