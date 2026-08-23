/**
 * errorHandler 单元测试
 * 覆盖：buildErrorBody, errorHandler, asyncHandler
 */
jest.mock('../../server/shared/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

jest.mock('../../server/shared/errors', () => ({
    AppError: class AppError extends Error {
        constructor(message, code, statusCode, field) {
            super(message);
            this.code = code;
            this.statusCode = statusCode;
            this.field = field;
        }
    }
}));

jest.mock('../../server/shared/traceContext', () => ({
    getTraceId: jest.fn()
}));

jest.mock('../../server/middleware/errorContextHelper', () => ({
    extractRequestContext: jest.fn()
}));

const { getTraceId } = require('../../server/shared/traceContext');
const { extractRequestContext } = require('../../server/middleware/errorContextHelper');
const logger = require('../../server/shared/logger');
const { AppError } = require('../../server/shared/errors');
const { errorHandler, asyncHandler, buildErrorBody } = require('../../server/middleware/errorHandler');

describe('errorHandler.buildErrorBody', () => {
    beforeEach(() => jest.clearAllMocks());

    test('默认 code=INTERNAL_ERROR', () => {
        getTraceId.mockReturnValue('trace-1');
        const body = buildErrorBody('err msg');
        expect(body.success).toBe(false);
        expect(body.error).toBe('err msg');
        expect(body.code).toBe('INTERNAL_ERROR');
        expect(body.traceId).toBe('trace-1');
        expect(body.timestamp).toBeDefined();
        expect(body.details).toBeUndefined();
    });

    test('自定义 code 和 details', () => {
        getTraceId.mockReturnValue(null);
        const body = buildErrorBody('err', 'VALIDATION_ERROR', { field: 'name' });
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.details).toEqual({ field: 'name' });
    });
});

describe('errorHandler.errorHandler', () => {
    beforeEach(() => jest.clearAllMocks());

    function mockRes() {
        return {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    }

    test('AppError：使用 err.statusCode 和 err.code', () => {
        getTraceId.mockReturnValue('t-1');
        extractRequestContext.mockReturnValue({ method: 'GET' });
        const err = new AppError('Not found', 'NOT_FOUND', 404);
        const req = { method: 'GET', path: '/api/x' };
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(logger.warn).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'Not found',
            code: 'NOT_FOUND'
        }));
    });

    test('AppError 带 field 时作为 details', () => {
        getTraceId.mockReturnValue('t-1');
        extractRequestContext.mockReturnValue({});
        const err = new AppError('Invalid', 'VALIDATION_ERROR', 400, 'email');
        const req = { method: 'POST', path: '/api/x' };
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            details: 'email'
        }));
    });

    test('err.type=entity.parse.failed 返回 400 PARSE_ERROR', () => {
        getTraceId.mockReturnValue('t-1');
        extractRequestContext.mockReturnValue({});
        const err = { type: 'entity.parse.failed', message: 'json err' };
        const req = { method: 'POST', path: '/api/x' };
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'PARSE_ERROR'
        }));
    });

    test('err.type=entity.too.large 返回 413 PAYLOAD_TOO_LARGE', () => {
        getTraceId.mockReturnValue('t-1');
        extractRequestContext.mockReturnValue({});
        const err = { type: 'entity.too.large', message: 'too big' };
        const req = { method: 'POST', path: '/api/x' };
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(413);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'PAYLOAD_TOO_LARGE'
        }));
    });

    test('未知错误返回 500 INTERNAL_ERROR', () => {
        getTraceId.mockReturnValue('t-1');
        extractRequestContext.mockReturnValue({});
        const err = new Error('boom');
        const req = { method: 'GET', path: '/api/x' };
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(logger.error).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'INTERNAL_ERROR'
        }));
    });

    test('NODE_ENV=production 时 500 错误隐藏 message', () => {
        getTraceId.mockReturnValue('t-1');
        extractRequestContext.mockReturnValue({});
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const err = new Error('internal stack trace');
        const req = { method: 'GET', path: '/api/x' };
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'Internal server error'
        }));
        process.env.NODE_ENV = origEnv;
    });

    test('非 production 环境显示原始 message', () => {
        getTraceId.mockReturnValue('t-1');
        extractRequestContext.mockReturnValue({});
        const err = new Error('debug message');
        const req = { method: 'GET', path: '/api/x' };
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'debug message'
        }));
    });
});

describe('errorHandler.asyncHandler', () => {
    test('async 函数 resolve 时正常调用', async () => {
        const fn = jest.fn().mockResolvedValue('ok');
        const wrapped = asyncHandler(fn);
        const req = {}; const res = {}; const next = jest.fn();

        await wrapped(req, res, next);

        expect(fn).toHaveBeenCalledWith(req, res, next);
        expect(next).not.toHaveBeenCalled();
    });

    test('async 函数 reject 时调用 next(err)', async () => {
        const err = new Error('async fail');
        const fn = jest.fn().mockRejectedValue(err);
        const wrapped = asyncHandler(fn);
        const req = {}; const res = {}; const next = jest.fn();

        await wrapped(req, res, next);

        expect(next).toHaveBeenCalledWith(err);
    });

    test('同步函数正常返回时不调用 next', async () => {
        const fn = jest.fn(() => 'sync result');
        const wrapped = asyncHandler(fn);
        const req = {}; const res = {}; const next = jest.fn();

        await wrapped(req, res, next);

        expect(fn).toHaveBeenCalledWith(req, res, next);
        expect(next).not.toHaveBeenCalled();
    });
});
