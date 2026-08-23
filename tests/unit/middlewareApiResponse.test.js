/**
 * apiResponse 单元测试
 * 覆盖：apiResponse 中间件（res.json 包装、apiOk、apiList、apiError）
 */
jest.mock('../../server/middleware/sensitiveFilter', () => ({
    filterApiResponse: jest.fn(body => body)
}));

jest.mock('../../server/shared/traceContext', () => ({
    getTraceId: jest.fn()
}));

jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

jest.mock('../../server/middleware/errorContextHelper', () => ({
    extractRequestContext: jest.fn(() => ({}))
}));

const { filterApiResponse } = require('../../server/middleware/sensitiveFilter');
const { getTraceId } = require('../../server/shared/traceContext');
const logger = require('../../server/shared/logger');
const { apiResponse } = require('../../server/middleware/apiResponse');

function setupRes() {
    const jsonMock = jest.fn().mockReturnThis();
    const statusMock = jest.fn().mockReturnThis();
    const res = { status: statusMock, json: jsonMock };
    return { res, jsonMock, statusMock };
}

describe('apiResponse - res.json 包装', () => {
    beforeEach(() => jest.clearAllMocks());

    test('对象 body 经过 filterApiResponse 过滤', () => {
        const { res, jsonMock } = setupRes();
        apiResponse({}, res, jest.fn());
        res.json({ success: true, data: { name: 'x' } });
        expect(filterApiResponse).toHaveBeenCalled();
        expect(jsonMock).toHaveBeenCalled();
    });

    test('非对象 body 原样传递（不调用 filterApiResponse）', () => {
        const { res, jsonMock } = setupRes();
        apiResponse({}, res, jest.fn());
        res.json('plain string');
        expect(filterApiResponse).not.toHaveBeenCalled();
        expect(jsonMock).toHaveBeenCalledWith('plain string');
    });

    test('null body 原样传递', () => {
        const { res } = setupRes();
        apiResponse({}, res, jest.fn());
        res.json(null);
        expect(filterApiResponse).not.toHaveBeenCalled();
    });

    test('next 被调用', () => {
        const { res } = setupRes();
        const next = jest.fn();
        apiResponse({}, res, next);
        expect(next).toHaveBeenCalled();
    });
});

describe('apiResponse - res.apiOk', () => {
    beforeEach(() => jest.clearAllMocks());

    test('默认 status=200', () => {
        const { res, jsonMock, statusMock } = setupRes();
        apiResponse({}, res, jest.fn());
        res.apiOk({ id: 1 });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            success: true, data: { id: 1 }
        }));
    });

    test('自定义 status=201', () => {
        const { res, statusMock } = setupRes();
        apiResponse({}, res, jest.fn());
        res.apiOk({ id: 1 }, null, 201);
        expect(statusMock).toHaveBeenCalledWith(201);
    });

    test('有 meta 时包含 meta', () => {
        const { res, jsonMock } = setupRes();
        apiResponse({}, res, jest.fn());
        res.apiOk([1, 2], { total: 2 });
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            meta: { total: 2 }
        }));
    });

    test('无 meta 时不包含 meta 字段', () => {
        const { res, jsonMock } = setupRes();
        apiResponse({}, res, jest.fn());
        res.apiOk({ id: 1 });
        const call = jsonMock.mock.calls[0][0];
        expect(call.meta).toBeUndefined();
    });
});

describe('apiResponse - res.apiList', () => {
    beforeEach(() => jest.clearAllMocks());

    test('数组 items 自动生成 meta.total', () => {
        const { res, jsonMock } = setupRes();
        apiResponse({}, res, jest.fn());
        res.apiList([1, 2, 3]);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            success: true, data: [1, 2, 3], meta: { total: 3 }
        }));
    });

    test('有 meta 时不自动生成 total', () => {
        const { res, jsonMock } = setupRes();
        apiResponse({}, res, jest.fn());
        res.apiList([1, 2], { page: 1 });
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            meta: { page: 1 }
        }));
    });

    test('非数组 items 无自动 total', () => {
        const { res, jsonMock } = setupRes();
        apiResponse({}, res, jest.fn());
        res.apiList({ a: 1 });
        const call = jsonMock.mock.calls[0][0];
        expect(call.meta).toBeUndefined();
    });
});

describe('apiResponse - res.apiError', () => {
    beforeEach(() => jest.clearAllMocks());

    test('5xx 错误调用 logger.error', () => {
        getTraceId.mockReturnValue('trace-1');
        const { res, jsonMock, statusMock } = setupRes();
        apiResponse({ method: 'GET', path: '/api/x' }, res, jest.fn());
        res.apiError(500, 'server error', 'INTERNAL_ERROR');
        expect(logger.error).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            success: false, error: 'server error', code: 'INTERNAL_ERROR', traceId: 'trace-1'
        }));
    });

    test('4xx 错误调用 logger.warn', () => {
        getTraceId.mockReturnValue('trace-1');
        const { res, statusMock } = setupRes();
        apiResponse({ method: 'POST', path: '/api/y' }, res, jest.fn());
        res.apiError(400, 'bad request', 'VALIDATION_ERROR');
        expect(logger.warn).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(400);
    });

    test('无 code 时使用 HTTP_{status} 作为 code', () => {
        getTraceId.mockReturnValue('t-1');
        const { res, jsonMock } = setupRes();
        apiResponse({ method: 'GET', path: '/api/x' }, res, jest.fn());
        res.apiError(404, 'not found');
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            code: 'HTTP_404'
        }));
    });

    test('有 details 时包含 details', () => {
        getTraceId.mockReturnValue('t-1');
        const { res, jsonMock } = setupRes();
        apiResponse({ method: 'GET', path: '/api/x' }, res, jest.fn());
        res.apiError(400, 'err', 'CODE', { field: 'name' });
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            details: { field: 'name' }
        }));
    });

    test('details=null 时不包含 details 字段', () => {
        getTraceId.mockReturnValue('t-1');
        const { res, jsonMock } = setupRes();
        apiResponse({ method: 'GET', path: '/api/x' }, res, jest.fn());
        res.apiError(400, 'err', 'CODE');
        const call = jsonMock.mock.calls[0][0];
        expect(call.details).toBeUndefined();
    });

    test('3xx 状态码不记录日志', () => {
        getTraceId.mockReturnValue('t-1');
        const { res } = setupRes();
        apiResponse({ method: 'GET', path: '/api/x' }, res, jest.fn());
        res.apiError(302, 'redirect');
        expect(logger.error).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
    });
});
