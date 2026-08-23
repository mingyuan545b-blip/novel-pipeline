/**
 * responseFormatter 单元测试
 * 覆盖：success, error, paginated, created, noContent
 */
jest.mock('../../server/shared/traceContext', () => ({
    getTraceId: jest.fn()
}));

const { getTraceId } = require('../../server/shared/traceContext');
const { success, error, paginated, created, noContent } = require('../../server/middleware/responseFormatter');

describe('responseFormatter.success', () => {
    beforeEach(() => jest.clearAllMocks());

    test('默认 message=ok', () => {
        const result = success({ id: 1 });
        expect(result.success).toBe(true);
        expect(result.message).toBe('ok');
        expect(result.data).toEqual({ id: 1 });
        expect(result.timestamp).toBeDefined();
    });

    test('自定义 message', () => {
        const result = success(null, 'created');
        expect(result.message).toBe('created');
        expect(result.data).toBeNull();
    });
});

describe('responseFormatter.error', () => {
    beforeEach(() => jest.clearAllMocks());

    test('默认 code=INTERNAL_ERROR', () => {
        getTraceId.mockReturnValue(null);
        const result = error('something went wrong');
        expect(result.success).toBe(false);
        expect(result.error).toBe('something went wrong');
        expect(result.code).toBe('INTERNAL_ERROR');
        expect(result.timestamp).toBeDefined();
        expect(result.traceId).toBeUndefined();
    });

    test('有 traceId 时包含 traceId', () => {
        getTraceId.mockReturnValue('trace-123');
        const result = error('bad request', 'VALIDATION_ERROR');
        expect(result.traceId).toBe('trace-123');
        expect(result.code).toBe('VALIDATION_ERROR');
    });

    test('有 details 时包含 details', () => {
        getTraceId.mockReturnValue('t-1');
        const result = error('err', 'CODE', { field: 'name' });
        expect(result.details).toEqual({ field: 'name' });
    });

    test('details=null 时不包含 details 字段', () => {
        getTraceId.mockReturnValue(null);
        const result = error('err');
        expect(result.details).toBeUndefined();
    });
});

describe('responseFormatter.paginated', () => {
    test('返回分页结构', () => {
        const result = paginated([1, 2, 3], 30, 2, 10);
        expect(result.success).toBe(true);
        expect(result.data).toEqual([1, 2, 3]);
        expect(result.pagination).toEqual({
            total: 30, page: 2, pageSize: 10, totalPages: 3
        });
        expect(result.timestamp).toBeDefined();
    });

    test('total=0 时 totalPages=0', () => {
        const result = paginated([], 0, 1, 10);
        expect(result.pagination.totalPages).toBe(0);
    });
});

describe('responseFormatter.created', () => {
    test('默认 message=created', () => {
        const result = created({ id: 5 });
        expect(result.success).toBe(true);
        expect(result.message).toBe('created');
        expect(result.data).toEqual({ id: 5 });
        expect(result.timestamp).toBeDefined();
    });

    test('自定义 message', () => {
        const result = created(null, 'imported');
        expect(result.message).toBe('imported');
    });
});

describe('responseFormatter.noContent', () => {
    test('返回删除成功结构', () => {
        const result = noContent();
        expect(result.success).toBe(true);
        expect(result.message).toBe('deleted');
        expect(result.timestamp).toBeDefined();
    });
});
