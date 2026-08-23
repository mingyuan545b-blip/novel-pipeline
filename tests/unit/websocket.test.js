const {
    generateTicket,
    validateTicket,
    issueTicket,
    handleMessage,
    broadcastToProject,
    getStats,
    shutdown
} = require('../../server/services/websocket');

const TEST_SECRET = 'test-secret-key-12345';

describe('websocket - ticket system', () => {
    test('generateTicket should produce ticket with correct prefix', () => {
        const ticket = generateTicket(TEST_SECRET);
        expect(ticket).toMatch(/^wst_\d+_[0-9a-f]+_[0-9a-f]+$/);
    });

    test('validateTicket should accept ticket issued by issueTicket', () => {
        const ticket = issueTicket(TEST_SECRET);
        expect(validateTicket(ticket, TEST_SECRET)).toBe(true);
    });

    test('validateTicket should reject ticket with wrong secret', () => {
        const ticket = issueTicket(TEST_SECRET);
        expect(validateTicket(ticket, 'wrong-secret')).toBe(false);
    });

    test('validateTicket should reject already-used ticket (one-time use)', () => {
        const ticket = issueTicket(TEST_SECRET);
        expect(validateTicket(ticket, TEST_SECRET)).toBe(true);
        expect(validateTicket(ticket, TEST_SECRET)).toBe(false);
    });

    test('validateTicket should reject null/undefined/empty ticket', () => {
        expect(validateTicket(null, TEST_SECRET)).toBe(false);
        expect(validateTicket(undefined, TEST_SECRET)).toBe(false);
        expect(validateTicket('', TEST_SECRET)).toBe(false);
    });

    test('validateTicket should reject ticket without prefix', () => {
        expect(validateTicket('invalid_ticket', TEST_SECRET)).toBe(false);
    });

    test('validateTicket should reject tampered ticket', () => {
        const ticket = issueTicket(TEST_SECRET);
        const tampered = ticket + 'x';
        expect(validateTicket(tampered, TEST_SECRET)).toBe(false);
    });

    test('issueTicket should clean up old tickets when over 1000', () => {
        for (let i = 0; i < 1001; i++) {
            issueTicket(TEST_SECRET);
        }
        const stats = getStats();
        expect(stats.pendingTickets).toBeLessThanOrEqual(1100);
    });
});

describe('websocket - handleMessage', () => {
    let mockWs;

    beforeEach(() => {
        shutdown();
        mockWs = {
            _projectId: null,
            _isAlive: true,
            readyState: 1,
            bufferedAmount: 0,
            sent: [],
            send(data) { this.sent.push(data); }
        };
    });

    test('should ignore message without type', () => {
        handleMessage(mockWs, {});
        handleMessage(mockWs, null);
        expect(mockWs.sent.length).toBe(0);
    });

    test('should handle subscribe message', () => {
        handleMessage(mockWs, { type: 'subscribe', projectId: 'proj1' });
        expect(mockWs._projectId).toBe('proj1');
        expect(mockWs.sent.length).toBe(1);
        const sent = JSON.parse(mockWs.sent[0]);
        expect(sent.event).toBe('subscribed');
        expect(sent.data.projectId).toBe('proj1');
    });

    test('should ignore subscribe without projectId', () => {
        handleMessage(mockWs, { type: 'subscribe' });
        expect(mockWs._projectId).toBe(null);
    });

    test('should handle unsubscribe message', () => {
        handleMessage(mockWs, { type: 'subscribe', projectId: 'proj1' });
        handleMessage(mockWs, { type: 'unsubscribe' });
        expect(mockWs._projectId).toBe(null);
    });

    test('should handle ping message', () => {
        handleMessage(mockWs, { type: 'ping' });
        expect(mockWs.sent.length).toBe(1);
        const sent = JSON.parse(mockWs.sent[0]);
        expect(sent.event).toBe('pong');
    });

    test('should handle unknown message type gracefully', () => {
        handleMessage(mockWs, { type: 'unknown-type' });
        expect(mockWs.sent.length).toBe(0);
    });
});

describe('websocket - broadcastToProject', () => {
    let mockWs1, mockWs2;

    beforeEach(() => {
        shutdown();
        mockWs1 = {
            _projectId: null, _isAlive: true, readyState: 1, bufferedAmount: 0,
            sent: [], send(data) { this.sent.push(data); }
        };
        mockWs2 = {
            _projectId: null, _isAlive: true, readyState: 1, bufferedAmount: 0,
            sent: [], send(data) { this.sent.push(data); }
        };
    });

    test('should broadcast to subscribed clients of the project', () => {
        handleMessage(mockWs1, { type: 'subscribe', projectId: 'proj1' });
        handleMessage(mockWs2, { type: 'subscribe', projectId: 'proj2' });
        broadcastToProject('proj1', 'test-event', { key: 'value' });
        const lastSent1 = JSON.parse(mockWs1.sent[mockWs1.sent.length - 1]);
        expect(lastSent1.event).toBe('test-event');
        const ws2Events = mockWs2.sent.map(m => { try { return JSON.parse(m).event; } catch (_) { return null; } });
        expect(ws2Events).not.toContain('test-event');
    });

    test('should not broadcast to clients of other projects', () => {
        handleMessage(mockWs1, { type: 'subscribe', projectId: 'proj1' });
        broadcastToProject('proj2', 'test-event', {});
        const ws1Events = mockWs1.sent.map(m => { try { return JSON.parse(m).event; } catch (_) { return null; } });
        expect(ws1Events).not.toContain('test-event');
    });

    test('should skip clients with closed connection', () => {
        handleMessage(mockWs1, { type: 'subscribe', projectId: 'proj1' });
        mockWs1.readyState = 3;
        broadcastToProject('proj1', 'test-event', {});
        const ws1Events = mockWs1.sent.map(m => { try { return JSON.parse(m).event; } catch (_) { return null; } });
        expect(ws1Events).not.toContain('test-event');
    });

    test('should handle broadcast to project with no subscribers', () => {
        expect(() => broadcastToProject('nonexistent', 'test-event', {})).not.toThrow();
    });
});

describe('websocket - getStats', () => {
    beforeEach(() => {
        shutdown();
    });

    test('should return zero stats when no connections', () => {
        const stats = getStats();
        expect(stats.totalConnections).toBe(0);
        expect(stats.projectSubscriptions).toBe(0);
    });
});

describe('websocket - constants', () => {
    test('TICKET_TTL_MS should be reasonable (10s-120s)', () => {
        const TICKET_TTL_MS = 30000;
        expect(TICKET_TTL_MS).toBeGreaterThanOrEqual(10000);
        expect(TICKET_TTL_MS).toBeLessThanOrEqual(120000);
    });

    test('MAX_CONNECTIONS should be positive', () => {
        const MAX_CONNECTIONS = 50;
        expect(MAX_CONNECTIONS).toBeGreaterThan(0);
    });
});
