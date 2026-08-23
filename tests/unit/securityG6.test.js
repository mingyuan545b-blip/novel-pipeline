'use strict';

/**
 * G6 测试：安全性补全（CSP 头 + debug 独立 rate limit）
 *
 * 覆盖：
 *   - securityHeaders 应设置 Content-Security-Policy 头
 *   - API 路径用严格 CSP（default-src 'none'）
 *   - SPA 路径用宽松 CSP（允许同源资源加载）
 *   - debugRateLimit 应导出 debugLimiter 中间件
 *   - debugRateLimit 配置常量正确（30 req/min）
 *
 * 文件位置：tests/unit/securityG6.test.js
 */

const { securityHeaders, BASE_HEADERS, CSP_API_POLICY, CSP_SPA_POLICY } = require('../../server/middleware/securityHeaders');
const { debugLimiter, DEBUG_RATE_LIMIT_WINDOW_MS, DEBUG_RATE_LIMIT_MAX } = require('../../server/middleware/debugRateLimit');

describe('G6: securityHeaders CSP 头', () => {
    test('BASE_HEADERS 应包含基础安全头（不含 CSP，CSP 动态设置）', () => {
        expect(BASE_HEADERS).toHaveProperty('X-Content-Type-Options');
        expect(BASE_HEADERS).toHaveProperty('X-Frame-Options');
        expect(BASE_HEADERS).toHaveProperty('Cache-Control');
    });

    test('CSP_API_POLICY 应为 default-src none + frame-ancestors none', () => {
        expect(CSP_API_POLICY).toContain("default-src 'none'");
        expect(CSP_API_POLICY).toContain("frame-ancestors 'none'");
    });

    test('CSP_SPA_POLICY 应允许同源资源加载', () => {
        expect(CSP_SPA_POLICY).toContain("default-src 'self'");
        expect(CSP_SPA_POLICY).toContain("script-src 'self'");
        expect(CSP_SPA_POLICY).toContain("style-src 'self'");
        expect(CSP_SPA_POLICY).toContain("connect-src 'self'");
    });

    test('securityHeaders 对 API 路径应设置严格 CSP', () => {
        const res = {
            headers: {},
            getHeader(k) { return this.headers[k]; },
            setHeader(k, v) { this.headers[k] = v; },
            removeHeader(k) { delete this.headers[k]; }
        };
        const next = jest.fn();
        securityHeaders({ path: '/api/projects' }, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.headers['Content-Security-Policy']).toBe(CSP_API_POLICY);
    });

    test('securityHeaders 对 SPA 路径应设置宽松 CSP', () => {
        const res = {
            headers: {},
            getHeader(k) { return this.headers[k]; },
            setHeader(k, v) { this.headers[k] = v; },
            removeHeader(k) { delete this.headers[k]; }
        };
        securityHeaders({ path: '/' }, res, jest.fn());
        expect(res.headers['Content-Security-Policy']).toBe(CSP_SPA_POLICY);
    });

    test('securityHeaders 对静态资源路径应设置宽松 CSP', () => {
        const res = {
            headers: {},
            getHeader(k) { return this.headers[k]; },
            setHeader(k, v) { this.headers[k] = v; },
            removeHeader(k) { delete this.headers[k]; }
        };
        securityHeaders({ path: '/assets/index.js' }, res, jest.fn());
        expect(res.headers['Content-Security-Policy']).toBe(CSP_SPA_POLICY);
    });

    test('securityHeaders 不应覆盖已设置的 CSP 头', () => {
        const existingCsp = "default-src 'self'";
        const res = {
            headers: { 'Content-Security-Policy': existingCsp },
            getHeader(k) { return this.headers[k]; },
            setHeader(k, v) { this.headers[k] = v; },
            removeHeader(k) { delete this.headers[k]; }
        };
        securityHeaders({ path: '/api/test' }, res, jest.fn());
        // 已存在的 CSP 头不应被覆盖
        expect(res.headers['Content-Security-Policy']).toBe(existingCsp);
    });

    test('securityHeaders 应保留所有原有安全头', () => {
        const required = [
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection',
            'Referrer-Policy',
            'Permissions-Policy',
            'Cache-Control'
        ];
        for (const h of required) {
            expect(BASE_HEADERS[h]).toBeDefined();
        }
    });
});

describe('G6: debugRateLimit 配置', () => {
    test('debugLimiter 应为函数（express 中间件）', () => {
        expect(typeof debugLimiter).toBe('function');
    });

    test('DEBUG_RATE_LIMIT_WINDOW_MS 应为 60 秒', () => {
        expect(DEBUG_RATE_LIMIT_WINDOW_MS).toBe(60 * 1000);
    });

    test('DEBUG_RATE_LIMIT_MAX 应为 30（比 global 200 更严格）', () => {
        expect(DEBUG_RATE_LIMIT_MAX).toBe(30);
        expect(DEBUG_RATE_LIMIT_MAX).toBeLessThan(200);
    });
});
