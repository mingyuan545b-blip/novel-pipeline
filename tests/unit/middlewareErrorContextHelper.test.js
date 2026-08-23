/**
 * errorContextHelper 单元测试
 * 覆盖：extractRequestContext, truncate, truncateBody, truncateQuery
 */
jest.mock('../../server/middleware/sensitiveFilter', () => ({
    filterSensitive: jest.fn(obj => obj) // 默认透传，便于测试
}));

const { filterSensitive } = require('../../server/middleware/sensitiveFilter');
const {
    extractRequestContext,
    truncate,
    truncateBody,
    truncateQuery
} = require('../../server/middleware/errorContextHelper');

describe('errorContextHelper.truncate', () => {
    test('非字符串原样返回', () => {
        expect(truncate(123, 10)).toBe(123);
        expect(truncate(null, 10)).toBeNull();
        expect(truncate(undefined, 10)).toBeUndefined();
    });

    test('长度<=maxLength 原样返回', () => {
        expect(truncate('hello', 10)).toBe('hello');
    });

    test('长度>maxLength 截断并加 ...[truncated]', () => {
        const result = truncate('abcdefghij', 5);
        expect(result).toBe('abcde...[truncated]');
    });
});

describe('errorContextHelper.truncateBody', () => {
    beforeEach(() => jest.clearAllMocks());

    test('null/undefined 返回 null', () => {
        expect(truncateBody(null)).toBeNull();
        expect(truncateBody(undefined)).toBeNull();
    });

    test('字符串超长截断', () => {
        const long = 'x'.repeat(3000);
        const result = truncateBody(long);
        expect(result.length).toBeLessThan(long.length);
        expect(result).toContain('...[truncated]');
    });

    test('字符串短于阈值原样返回', () => {
        expect(truncateBody('short')).toBe('short');
    });

    test('对象 JSON 长度<=阈值时调用 filterSensitive', () => {
        filterSensitive.mockReturnValue({ a: 1 });
        const result = truncateBody({ a: 1 });
        expect(filterSensitive).toHaveBeenCalledWith({ a: 1 });
        expect(result).toEqual({ a: 1 });
    });

    test('对象 JSON 长度>阈值时截断为字符串', () => {
        const big = { data: 'x'.repeat(3000) };
        const result = truncateBody(big);
        expect(typeof result).toBe('string');
        expect(result).toContain('...[truncated]');
    });

    test('不可序列化对象返回 [unserializable]', () => {
        const obj = {};
        obj.self = obj; // 循环引用
        const result = truncateBody(obj);
        expect(result).toBe('[unserializable]');
    });
});

describe('errorContextHelper.truncateQuery', () => {
    beforeEach(() => jest.clearAllMocks());

    test('null/非对象返回 null', () => {
        expect(truncateQuery(null)).toBeNull();
        expect(truncateQuery('string')).toBeNull();
        expect(truncateQuery(undefined)).toBeNull();
    });

    test('正常对象返回 JSON 字符串（经 filterSensitive）', () => {
        filterSensitive.mockReturnValue({ page: 1 });
        const result = truncateQuery({ page: 1 });
        expect(filterSensitive).toHaveBeenCalledWith({ page: 1 });
        expect(result).toBe(JSON.stringify({ page: 1 }));
    });

    test('超长 query 截断', () => {
        const big = { q: 'x'.repeat(600) };
        filterSensitive.mockReturnValue(big);
        const result = truncateQuery(big);
        expect(result.length).toBeLessThanOrEqual(500 + '...[truncated]'.length);
        expect(result).toContain('...[truncated]');
    });

    test('不可序列化返回 [unserializable]', () => {
        const obj = {};
        obj.self = obj;
        filterSensitive.mockReturnValue(obj);
        const result = truncateQuery(obj);
        expect(result).toBe('[unserializable]');
    });
});

describe('errorContextHelper.extractRequestContext', () => {
    beforeEach(() => jest.clearAllMocks());

    test('req=null 返回 null', () => {
        expect(extractRequestContext(null)).toBeNull();
    });

    test('完整 req 对象提取所有字段', () => {
        filterSensitive.mockImplementation(obj => obj);
        const req = {
            method: 'POST',
            path: '/api/test',
            originalUrl: '/api/test?page=1',
            query: { page: 1 },
            body: { name: 'test' },
            headers: {
                'content-type': 'application/json',
                'user-agent': 'jest',
                'x-custom': 'should-be-filtered'
            },
            ip: '127.0.0.1'
        };

        const result = extractRequestContext(req);

        expect(result.method).toBe('POST');
        expect(result.path).toBe('/api/test');
        expect(result.url).toBe('/api/test?page=1');
        expect(result.ip).toBe('127.0.0.1');
        expect(result.headers).toEqual({
            'content-type': 'application/json',
            'user-agent': 'jest'
        });
    });

    test('req 缺失字段时使用默认值', () => {
        filterSensitive.mockImplementation(obj => obj);
        const req = { method: 'GET' };

        const result = extractRequestContext(req);

        expect(result.method).toBe('GET');
        expect(result.path).toBe('UNKNOWN');
        expect(result.url).toBe('');
        expect(result.ip).toBe('');
    });

    test('path 缺失时回退到 url', () => {
        filterSensitive.mockImplementation(obj => obj);
        const req = { method: 'GET', url: '/api/fallback' };

        const result = extractRequestContext(req);

        expect(result.path).toBe('/api/fallback');
    });

    test('ip 缺失时回退到 socket.remoteAddress', () => {
        filterSensitive.mockImplementation(obj => obj);
        const req = { method: 'GET', socket: { remoteAddress: '192.168.1.1' } };

        const result = extractRequestContext(req);

        expect(result.ip).toBe('192.168.1.1');
    });

    test('headers=null 返回空对象', () => {
        const req = { method: 'GET', headers: null };
        const result = extractRequestContext(req);
        expect(result.headers).toEqual({});
    });
});
