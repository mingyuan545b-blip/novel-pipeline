const crypto = require('crypto');

const TICKET_TTL_MS = 30000;
const TICKET_PREFIX = 'wst_';

const wsTickets = new Map();

function generateTicket(secret) {
    const randomPart = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const hmac = crypto.createHmac('sha256', secret).update(`${randomPart}:${timestamp}`).digest('hex').substring(0, 16);
    return `${TICKET_PREFIX}${timestamp}_${randomPart}_${hmac}`;
}

function validateTicket(ticket, secret) {
    if (!ticket || !ticket.startsWith(TICKET_PREFIX)) return false;
    const stored = wsTickets.get(ticket);
    if (!stored) return false;
    if (Date.now() - stored.createdAt > TICKET_TTL_MS) { wsTickets.delete(ticket); return false; }
    const parts = ticket.substring(TICKET_PREFIX.length).split('_');
    if (parts.length < 3) return false;
    const timestamp = parseInt(parts[0], 10);
    const randomPart = parts[1];
    const expectedHmac = crypto.createHmac('sha256', secret).update(`${randomPart}:${timestamp}`).digest('hex').substring(0, 16);
    const actualHmac = parts.slice(2).join('_');
    if (typeof expectedHmac !== 'string' || typeof actualHmac !== 'string') return false;
    if (expectedHmac.length !== actualHmac.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(actualHmac))) return false;
    wsTickets.delete(ticket);
    return true;
}

function issueTicket(secret) {
    const ticket = generateTicket(secret);
    wsTickets.set(ticket, { createdAt: Date.now() });
    if (wsTickets.size > 1000) {
        const now = Date.now();
        for (const [key, val] of wsTickets) { if (now - val.createdAt > TICKET_TTL_MS) wsTickets.delete(key); }
    }
    return ticket;
}

function getTicketCount() { return wsTickets.size; }
function clearTickets() { wsTickets.clear(); }

module.exports = { generateTicket, validateTicket, issueTicket, getTicketCount, clearTickets, TICKET_PREFIX, TICKET_TTL_MS };
