'use strict';

/**
 * Express 路由测试 Mock 工具（S5）
 *
 * 提供轻量级 mock 框架，模拟 express Router + res.apiOk/res.apiError
 * 避免 supertest 的重量级 HTTP 启动开销
 *
 * 用法：
 *   const { createMockRouter, createMockRes } = require('./mockExpress');
 *   const router = createMockRouter();
 *   require('../../server/routes/chapters')(router);
 *   const res = createMockRes();
 *   await router.handle('GET', '/', req, res);
 *
 * 文件位置：tests/unit/routes/mockExpress.js
 */

/**
 * 创建 mock Express Router
 * 支持 get/post/put/delete/use，记录路由注册
 */
function createMockRouter() {
    const routes = [];
    const handlers = {
        get: [],
        post: [],
        put: [],
        delete: [],
        patch: []
    };

    const router = {
        routes,
        get(path, ...middleware) { handlers.get.push({ path, middleware }); routes.push({ method: 'GET', path, middleware }); },
        post(path, ...middleware) { handlers.post.push({ path, middleware }); routes.push({ method: 'POST', path, middleware }); },
        put(path, ...middleware) { handlers.put.push({ path, middleware }); routes.push({ method: 'PUT', path, middleware }); },
        delete(path, ...middleware) { handlers.delete.push({ path, middleware }); routes.push({ method: 'DELETE', path, middleware }); },
        patch(path, ...middleware) { handlers.patch.push({ path, middleware }); routes.push({ method: 'PATCH', path, middleware }); },
        use(...args) { routes.push({ method: 'USE', path: args[0], middleware: args.slice(1) }); },

        /**
         * 模拟请求处理
         * @param {string} method - HTTP 方法
         * @param {string} path - 请求路径
         * @param {object} req - 请求对象（query/params/body）
         * @param {object} res - 响应对象（createMockRes 创建）
         */
        async handle(method, path, req, res) {
            const methodLower = method.toLowerCase();
            const handlerList = handlers[methodLower] || [];
            // 找第一个匹配 path 的路由（简化匹配，不支持通配符）
            const matched = handlerList.find(r => matchPath(r.path, path));
            if (!matched) {
                res.status(404).json({ error: 'Not found' });
                return;
            }
            // 提取路径参数
            const params = extractParams(matched.path, path);
            const fullReq = {
                method: method.toUpperCase(),
                path,
                query: req.query || {},
                params: { ...params, ...(req.params || {}) },
                body: req.body || {},
                headers: req.headers || {},
                ...req
            };
            // 依次执行中间件链
            for (const mw of matched.middleware) {
                let called = false;
                await new Promise((resolve) => {
                    mw(fullReq, res, () => { called = true; resolve(); });
                    // 如果中间件没有调用 next()，且 res 已结束，继续
                    if (!called && res._ended) resolve();
                });
                if (res._ended) return;
            }
        }
    };

    return router;
}

/**
 * 简单路径匹配（支持 :param）
 */
function matchPath(pattern, actual) {
    const patternParts = pattern.split('/').filter(Boolean);
    const actualParts = actual.split('/').filter(Boolean);
    if (patternParts.length !== actualParts.length) return false;
    return patternParts.every((p, i) => p.startsWith(':') || p === actualParts[i]);
}

/**
 * 从路径中提取参数
 */
function extractParams(pattern, actual) {
    const params = {};
    const patternParts = pattern.split('/').filter(Boolean);
    const actualParts = actual.split('/').filter(Boolean);
    patternParts.forEach((p, i) => {
        if (p.startsWith(':')) {
            params[p.slice(1)] = actualParts[i];
        }
    });
    return params;
}

/**
 * 创建 mock Express Response
 */
function createMockRes() {
    const res = {
        _statusCode: 200,
        _body: null,
        _ended: false,
        _headers: {},
        status(code) { this._statusCode = code; return this; },
        json(data) { this._body = data; this._ended = true; return this; },
        send(data) { this._body = data; this._ended = true; return this; },
        end() { this._ended = true; return this; },
        setHeader(key, value) { this._headers[key] = value; return this; },
        // 业务封装
        apiOk(data, message, status) {
            this._statusCode = status || 200;
            this._body = { success: true, data, message: message || null };
            this._ended = true;
            return this;
        },
        apiError(statusCode, message, code, extra) {
            this._statusCode = statusCode;
            this._body = { success: false, error: { code, message, ...extra } };
            this._ended = true;
            return this;
        }
    };
    return res;
}

module.exports = { createMockRouter, createMockRes, matchPath, extractParams };
