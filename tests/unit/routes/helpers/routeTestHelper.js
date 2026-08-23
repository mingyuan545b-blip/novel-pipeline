'use strict';

/**
 * 路由测试辅助工具（S5 基建）
 *
 * 提供路由匹配、参数提取、mock res 构造、路由执行等纯函数。
 * 各测试文件需自行 jest.mock('express') 并通过 express.Router()._routes 暴露路由。
 *
 * 文件位置：tests/unit/routes/helpers/routeTestHelper.js
 */

/**
 * 匹配路由路径（支持 :param 占位符）
 */
function matchPath(pattern, actual) {
    const p = pattern.split('/').filter(Boolean);
    const a = actual.split('/').filter(Boolean);
    if (p.length !== a.length) return false;
    return p.every((pp, i) => pp.startsWith(':') || pp === a[i]);
}

/**
 * 从路径中提取参数
 */
function extractParams(pattern, actual) {
    const params = {};
    const p = pattern.split('/').filter(Boolean);
    const a = actual.split('/').filter(Boolean);
    p.forEach((pp, i) => { if (pp.startsWith(':')) params[pp.slice(1)] = a[i]; });
    return params;
}

/**
 * 构造 mock res 对象（支持 status/json/send/end/setHeader/apiOk/apiError）
 */
function createMockRes() {
    return {
        _statusCode: 200, _body: null, _ended: false, _headers: {},
        status(code) { this._statusCode = code; return this; },
        json(data) { this._body = data; this._ended = true; return this; },
        send(data) { this._body = data; this._ended = true; return this; },
        end() { this._ended = true; return this; },
        setHeader(k, v) { this._headers[k] = v; return this; },
        apiOk(data, msg, status) {
            this._statusCode = status || 200;
            this._body = { success: true, data, message: msg || null };
            this._ended = true;
            return this;
        },
        apiError(sc, msg, code, extra) {
            this._statusCode = sc;
            this._body = { success: false, error: { code, message: msg, ...extra } };
            this._ended = true;
            return this;
        }
    };
}

/**
 * 执行路由处理器
 * @param {Object} routes - express.Router()._routes 返回的路由表
 * @param {string} method - HTTP 方法 (GET/POST/PUT/DELETE)
 * @param {string} path - 请求路径
 * @param {Object} req - 额外的 req 属性（query/body/params 等）
 */
async function executeRoute(routes, method, path, req = {}) {
    const list = routes[method.toLowerCase()];
    if (!list) throw new Error(`Unsupported method: ${method}`);
    const route = list.find(r => matchPath(r.path, path));
    if (!route) throw new Error(`Route not found: ${method} ${path}`);
    const params = extractParams(route.path, path);
    const fullReq = {
        method, path,
        query: req.query || {},
        params: { ...params, ...(req.params || {}) },
        body: req.body || {},
        ...req
    };
    const res = createMockRes();
    for (const mw of route.mw) {
        let nextCalled = false;
        const next = () => { nextCalled = true; };
        const result = mw(fullReq, res, next);
        // async 中间件返回 Promise，需 await 让 handler 完成 res 操作
        if (result && typeof result.then === 'function') {
            await result;
        }
        if (res._ended) break;
        if (nextCalled) continue;
        await new Promise(resolve => setImmediate(resolve));
    }
    return { req: fullReq, res };
}

module.exports = { matchPath, extractParams, createMockRes, executeRoute };
