/**
 * middlewareValidators.test.js — validators.js handleValidation 分支测试
 * 覆盖：handleValidation 错误分支（验证失败时 res.apiError 调用）
 * parseLimit 已在 parseLimit.test.js 覆盖，此处不重复
 */
jest.mock('../../server/shared/errorCodes', () => ({
    ERROR_CODES: {
        VALIDATION_ERROR: { statusCode: 400, code: 'VALIDATION_ERROR' }
    }
}));

// 用 jest.mock 替换 express-validator，控制 validationResult 行为
const mockValidationResult = jest.fn();
// 链式调用 mock：所有验证器方法返回 self 以支持链式调用
const chainable = () => {
    const chain = {};
    ['isString', 'trim', 'isLength', 'isInt', 'isBoolean', 'isIn', 'isObject', 'optional', 'withMessage'].forEach(m => {
        chain[m] = jest.fn().mockReturnValue(chain);
    });
    return chain;
};
jest.mock('express-validator', () => ({
    body: jest.fn(() => chainable()),
    param: jest.fn(() => chainable()),
    query: jest.fn(() => chainable()),
    validationResult: mockValidationResult
}));

const { handleValidation, projectIdParam, chapterIdParam, listQueryParams } = require('../../server/middleware/validators');

function mockReq() { return { query: {}, params: {}, body: {} }; }
function mockRes() {
    const res = { statusCode: 200, body: null };
    res.apiError = jest.fn((statusCode, message, code, details) => {
        res.statusCode = statusCode;
        res.body = { statusCode, message, code, details };
    });
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('validators.handleValidation', () => {
    afterEach(() => {
        mockValidationResult.mockReset();
    });

    test('无错误时调用 next()', () => {
        mockValidationResult.mockReturnValue({
            isEmpty: () => true,
            array: () => []
        });
        const req = mockReq();
        const res = mockRes();
        const next = jest.fn();

        handleValidation(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.apiError).not.toHaveBeenCalled();
    });

    test('有错误时调用 res.apiError', () => {
        mockValidationResult.mockReturnValue({
            isEmpty: () => false,
            array: () => [{ param: 'name', msg: '必填', value: '' }]
        });

        const req = mockReq();
        const res = mockRes();
        const next = jest.fn();

        handleValidation(req, res, next);

        expect(res.apiError).toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(next).not.toHaveBeenCalled();
    });
});

describe('validators - 参数验证器导出', () => {
    test('projectIdParam 是数组且含 handleValidation', () => {
        expect(Array.isArray(projectIdParam)).toBe(true);
        expect(projectIdParam[projectIdParam.length - 1]).toBe(handleValidation);
    });

    test('chapterIdParam 是数组且含 handleValidation', () => {
        expect(Array.isArray(chapterIdParam)).toBe(true);
        expect(chapterIdParam[chapterIdParam.length - 1]).toBe(handleValidation);
    });

    test('listQueryParams 是数组且含 handleValidation', () => {
        expect(Array.isArray(listQueryParams)).toBe(true);
        expect(listQueryParams[listQueryParams.length - 1]).toBe(handleValidation);
    });
});
