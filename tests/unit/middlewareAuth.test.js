/**
 * auth middleware 单元测试
 * 覆盖：timingSafeEqual, issueHttpToken, _verifyHmac, validateHttpToken,
 *      touchHttpToken, shouldRenewToken, createAuthMiddleware, getAuthStatus
 */
const crypto = require('crypto');
const { createAuthMiddleware, getAuthStatus, issueHttpToken, validateHttpToken } = require('../../server/middleware/auth');

// auth.js 内部维护 _httpTokens Map，通过 issueHttpToken/validateHttpToken 间接操作
const AUTH_SECRET = 'test-secret-key-for-unit-test-only';

describe('auth.getAuthStatus', () => {
    test('有 secret 时 enabled=true', () => {
        const status = getAuthStatus('abc');
        expect(status.enabled).toBe(true);
        expect(status.hint).toBe('configured');
    });

    test('无 secret 时 enabled=false', () => {
        const status = getAuthStatus('');
        expect(status.enabled).toBe(false);
        expect(status.hint).toBe('not configured');
    });

    test('null/undefined secret 时 enabled=false', () => {
        expect(getAuthStatus(null).enabled).toBe(false);
        expect(getAuthStatus(undefined).enabled).toBe(false);
    });
});

describe('auth.issueHttpToken', () => {
    test('生成 htk_ 前缀的 token', () => {
        const token = issueHttpToken(AUTH_SECRET);
        expect(token).toMatch(/^htk_\d+_[0-9a-f]+_[0-9a-f]+$/);
    });

    test('不同调用生成不同 token', () => {
        const t1 = issueHttpToken(AUTH_SECRET);
        const t2 = issueHttpToken(AUTH_SECRET);
        expect(t1).not.toBe(t2);
    });
});

describe('auth.validateHttpToken', () => {
    test('有效 token 通过验证', () => {
        const token = issueHttpToken(AUTH_SECRET);
        expect(validateHttpToken(token, AUTH_SECRET)).toBe(true);
    });

    test('无效前缀 token 拒绝', () => {
        expect(validateHttpToken('invalid_token', AUTH_SECRET)).toBe(false);
        expect(validateHttpToken('', AUTH_SECRET)).toBe(false);
        expect(validateHttpToken(null, AUTH_SECRET)).toBe(false);
    });

    test('篡改的 token 拒绝', () => {
        const token = issueHttpToken(AUTH_SECRET);
        const tampered = token.slice(0, -2) + 'xx';
        expect(validateHttpToken(tampered, AUTH_SECRET)).toBe(false);
    });

    test('错误 secret 拒绝', () => {
        const token = issueHttpToken(AUTH_SECRET);
        expect(validateHttpToken(token, 'wrong-secret')).toBe(false);
    });

    test('格式错误的 token 拒绝', () => {
        expect(validateHttpToken('htk_abc', AUTH_SECRET)).toBe(false);
        expect(validateHttpToken('htk_', AUTH_SECRET)).toBe(false);
    });
});

describe('auth.createAuthMiddleware - 基础逻辑', () => {
    function mockReqRes(path = '/api/data', headers = {}, query = {}) {
        const req = { path, headers, query };
        const res = {
            apiError: jest.fn(),
            setHeader: jest.fn()
        };
        const next = jest.fn();
        return { req, res, next };
    }

    test('enabled=false 时直接 next', () => {
        const middleware = createAuthMiddleware({ enabled: false, secret: 'x' });
        const { req, res, next } = mockReqRes();
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('无 secret 时直接 next', () => {
        const middleware = createAuthMiddleware({ secret: '' });
        const { req, res, next } = mockReqRes();
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('publicPaths 中的路径直接 next', () => {
        const middleware = createAuthMiddleware({ secret: 'x' });
        const { req, res, next } = mockReqRes('/api/health');
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('/api/health 前缀路径直接 next', () => {
        const middleware = createAuthMiddleware({ secret: 'x' });
        const { req, res, next } = mockReqRes('/api/health/detail');
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('/api/license/ 前缀路径直接 next', () => {
        const middleware = createAuthMiddleware({ secret: 'x' });
        const { req, res, next } = mockReqRes('/api/license/status');
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});

describe('auth.createAuthMiddleware - 认证逻辑', () => {
    function mockReqRes(path = '/api/data', headers = {}, query = {}) {
        const req = { path, headers, query };
        const res = {
            apiError: jest.fn(),
            setHeader: jest.fn()
        };
        const next = jest.fn();
        return { req, res, next };
    }

    test('无 token 时返回 AUTH_MISSING', () => {
        const middleware = createAuthMiddleware({ secret: AUTH_SECRET });
        const { req, res, next } = mockReqRes();
        middleware(req, res, next);
        expect(res.apiError).toHaveBeenCalledWith(401, 'Authentication required', 'AUTH_MISSING');
        expect(next).not.toHaveBeenCalled();
    });

    test('Bearer token 等于 secret 时通过', () => {
        const middleware = createAuthMiddleware({ secret: AUTH_SECRET });
        const { req, res, next } = mockReqRes('/api/data', { authorization: `Bearer ${AUTH_SECRET}` });
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('query.token 等于 secret 时通过', () => {
        const middleware = createAuthMiddleware({ secret: AUTH_SECRET });
        const { req, res, next } = mockReqRes('/api/data', {}, { token: AUTH_SECRET });
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('有效 http token 通过', () => {
        const token = issueHttpToken(AUTH_SECRET);
        const middleware = createAuthMiddleware({ secret: AUTH_SECRET });
        const { req, res, next } = mockReqRes('/api/data', { authorization: `Bearer ${token}` });
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('无效 token 返回 AUTH_INVALID', () => {
        const middleware = createAuthMiddleware({ secret: AUTH_SECRET });
        const { req, res, next } = mockReqRes('/api/data', { authorization: 'Bearer invalid_token' });
        middleware(req, res, next);
        expect(res.apiError).toHaveBeenCalledWith(403, 'Invalid authentication token', 'AUTH_INVALID');
        expect(next).not.toHaveBeenCalled();
    });

    test('Bearer 前缀但空 token 返回 AUTH_MISSING', () => {
        const middleware = createAuthMiddleware({ secret: AUTH_SECRET });
        const { req, res, next } = mockReqRes('/api/data', { authorization: 'Bearer ' });
        middleware(req, res, next);
        // Bearer 后为空字符串，bearerToken=null，token='' → AUTH_MISSING
        expect(res.apiError).toHaveBeenCalledWith(401, 'Authentication required', 'AUTH_MISSING');
    });
});

describe('auth.createAuthMiddleware - token 续期', () => {
    function mockReqRes(token) {
        const req = { path: '/api/data', headers: { authorization: `Bearer ${token}` }, query: {} };
        const res = { apiError: jest.fn(), setHeader: jest.fn() };
        const next = jest.fn();
        return { req, res, next };
    }

    test('新 token 不触发续期', () => {
        const token = issueHttpToken(AUTH_SECRET);
        const middleware = createAuthMiddleware({ secret: AUTH_SECRET });
        const { req, res, next } = mockReqRes(token);
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.setHeader).not.toHaveBeenCalled();
    });

    test('自定义 publicPaths 生效', () => {
        const middleware = createAuthMiddleware({
            secret: AUTH_SECRET,
            publicPaths: ['/api/custom-public']
        });
        const req = { path: '/api/custom-public', headers: {}, query: {} };
        const res = { apiError: jest.fn(), setHeader: jest.fn() };
        const next = jest.fn();
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });
});
