const { createAuthMiddleware, getAuthStatus } = require('../../server/middleware/auth');

describe('auth middleware', () => {
    function createMockReq(options = {}) {
        return {
            path: options.path || '/api/projects',
            headers: options.headers || {},
            query: options.query || {}
        };
    }

    function createMockRes() {
        const res = {
            statusCode: 200,
            body: null,
            status(code) { res.statusCode = code; return res; },
            json(data) { res.body = data; return res; },
            apiError(status, error, code, details = null) {
                res.statusCode = status;
                res.body = { success: false, error, code, traceId: 'test-trace', timestamp: new Date().toISOString() };
                if (details) res.body.details = details;
                return res;
            }
        };
        return res;
    }

    test('skips auth when REQUEST_SECRET is not set', () => {
        const original = process.env.REQUEST_SECRET;
        delete process.env.REQUEST_SECRET;
        const middleware = createAuthMiddleware({ enabled: false });
        const req = createMockReq();
        const res = createMockRes();
        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
        process.env.REQUEST_SECRET = original;
    });

    test('blocks request without token when auth is enabled', () => {
        const middleware = createAuthMiddleware({ enabled: true, secret: 'my-secret' });
        const req = createMockReq();
        const res = createMockRes();
        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(false);
        expect(res.statusCode).toBe(401);
        expect(res.body.code).toBe('AUTH_MISSING');
    });

    test('blocks request with wrong token', () => {
        const middleware = createAuthMiddleware({ enabled: true, secret: 'my-secret' });
        const req = createMockReq({ headers: { authorization: 'Bearer wrong-token' } });
        const res = createMockRes();
        middleware(req, res, () => {});
        expect(res.statusCode).toBe(403);
        expect(res.body.code).toBe('AUTH_INVALID');
    });

    test('allows request with correct Bearer token', () => {
        const middleware = createAuthMiddleware({ enabled: true, secret: 'my-secret' });
        const req = createMockReq({ headers: { authorization: 'Bearer my-secret' } });
        const res = createMockRes();
        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
    });

    test('allows request with correct query token', () => {
        const middleware = createAuthMiddleware({ enabled: true, secret: 'my-secret' });
        const req = createMockReq({ query: { token: 'my-secret' } });
        const res = createMockRes();
        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
    });

    test('allows public paths without token', () => {
        const middleware = createAuthMiddleware({
            enabled: true,
            secret: 'my-secret',
            publicPaths: ['/api/health', '/api/version']
        });
        const req = createMockReq({ path: '/api/health' });
        const res = createMockRes();
        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
    });

    test('allows license paths without token', () => {
        const middleware = createAuthMiddleware({ enabled: true, secret: 'my-secret' });
        const req = createMockReq({ path: '/api/license/status' });
        const res = createMockRes();
        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
    });

    test('getAuthStatus returns enabled=false when no secret', () => {
        const original = process.env.REQUEST_SECRET;
        delete process.env.REQUEST_SECRET;
        const status = getAuthStatus();
        expect(status.enabled).toBe(false);
        process.env.REQUEST_SECRET = original;
    });
});
