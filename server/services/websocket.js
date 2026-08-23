const { WebSocketServer } = require('ws');
const logger = require('../shared/logger');
const { validateTicket, issueTicket, generateTicket, getTicketCount, clearTickets } = require('./wsTicketAuth');

const MAX_CONNECTIONS = 50;
const HEARTBEAT_INTERVAL = 30000;
const MAX_BUFFERED_AMOUNT = 1024 * 1024;

let wss = null;
const clients = new Map();
let heartbeatTimer = null;

function initWebSocket(server) {
    wss = new WebSocketServer({ server, path: '/api/ws' });

    wss.on('connection', (ws, req) => {
        if (wss.clients.size > MAX_CONNECTIONS) { ws.close(1013, 'Max connections reached'); logger.warn('ws', 'Connection rejected: max connections reached', { maxConnections: MAX_CONNECTIONS }); return; }
        const REQUEST_SECRET = process.env.REQUEST_SECRET || '';
        if (REQUEST_SECRET) {
            const ticket = extractTicket(req);
            if (!validateTicket(ticket, REQUEST_SECRET)) { ws.close(4001, 'Unauthorized'); logger.warn('ws', 'Connection rejected: invalid or expired ticket'); return; }
        }
        ws._isAlive = true; ws._projectId = null; ws._connectedAt = Date.now();
        ws.on('pong', () => { ws._isAlive = true; });
        ws.on('message', (raw) => { try { handleMessage(ws, JSON.parse(raw)); } catch (e) { logger.warn('ws', 'Invalid message', { error: e.message }); } });
        ws.on('close', () => { removeClient(ws); });
        ws.on('error', (err) => { logger.warn('ws', 'WebSocket error', { error: err.message }); removeClient(ws); });
        send(ws, 'connected', { message: 'WebSocket connected' });
        logger.info('ws', 'Client connected', { totalConnections: wss.clients.size });
    });

    heartbeatTimer = setInterval(() => {
        wss.clients.forEach((ws) => { if (!ws._isAlive) { logger.warn('ws', 'Client heartbeat timeout, closing'); return ws.terminate(); } ws._isAlive = false; ws.ping(); });
    }, HEARTBEAT_INTERVAL);

    logger.info('ws', 'WebSocket server initialized', { path: '/api/ws', maxConnections: MAX_CONNECTIONS });
}

function handleMessage(ws, msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
        case 'subscribe': { const projectId = msg.projectId; if (!projectId) return; removeClient(ws); ws._projectId = projectId; if (!clients.has(projectId)) clients.set(projectId, new Set()); clients.get(projectId).add(ws); send(ws, 'subscribed', { projectId }); logger.info('ws', 'Client subscribed to project', { projectId }); break; }
        case 'unsubscribe': { removeClient(ws); ws._projectId = null; send(ws, 'unsubscribed', {}); break; }
        case 'ping': { send(ws, 'pong', {}); break; }
        default: logger.warn('ws', 'Unknown message type', { type: msg.type });
    }
}

function removeClient(ws) {
    const projectId = ws._projectId;
    if (projectId && clients.has(projectId)) { clients.get(projectId).delete(ws); if (clients.get(projectId).size === 0) clients.delete(projectId); }
}

function send(ws, event, data) {
    if (ws.readyState !== 1) return;
    if (ws.bufferedAmount > MAX_BUFFERED_AMOUNT) { logger.warn('ws', 'Dropping message, client buffer overloaded', { bufferedAmount: ws.bufferedAmount }); return; }
    try { ws.send(JSON.stringify({ event, data })); } catch (e) { logger.warn('ws', 'Send failed', { error: e.message }); }
}

function broadcastToProject(projectId, event, data) {
    const projectClients = clients.get(projectId);
    if (!projectClients || projectClients.size === 0) return;
    const payload = JSON.stringify({ event, projectId, data });
    projectClients.forEach((ws) => { if (ws.readyState === 1 && ws.bufferedAmount <= MAX_BUFFERED_AMOUNT) { try { ws.send(payload); } catch (e) { logger.warn('ws', 'Broadcast send failed', { error: e.message }); } } });
}

function broadcastAll(event, data) {
    if (!wss) return;
    const payload = JSON.stringify({ event, data });
    wss.clients.forEach((ws) => { if (ws.readyState === 1 && ws.bufferedAmount <= MAX_BUFFERED_AMOUNT) { try { ws.send(payload); } catch (e) { logger.warn('ws', 'BroadcastAll send failed', { error: e.message }); } } });
}

function extractTicket(req) { const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); return url.searchParams.get('ticket') || ''; }

function getStats() {
    return { totalConnections: wss ? wss.clients.size : 0, projectSubscriptions: clients.size, pendingTickets: getTicketCount(), projects: Array.from(clients.entries()).map(([pid, set]) => ({ projectId: pid, connections: set.size })) };
}

function shutdown() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (wss) { wss.clients.forEach((ws) => { try { ws.close(1001, 'Server shutting down'); } catch (_) { logger.warn('ws', 'Close error during shutdown'); } }); wss.close(); wss = null; }
    clients.clear(); clearTickets();
}

module.exports = { initWebSocket, broadcastToProject, broadcastAll, getStats, shutdown, issueTicket, validateTicket, generateTicket, handleMessage, removeClient, send };
