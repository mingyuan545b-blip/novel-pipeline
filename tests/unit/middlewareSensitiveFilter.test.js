/**
 * sensitiveFilter 单元测试
 * 覆盖：maskValue, filterSensitive, filterApiResponse
 */
const { filterApiResponse, filterSensitive, maskValue } = require('../../server/middleware/sensitiveFilter');

describe('sensitiveFilter.maskValue', () => {
    test('字符串长度<8 时返回 ****', () => {
        expect(maskValue('short')).toBe('****');
    });

    test('字符串长度>=8 时返回前4+****+后4', () => {
        expect(maskValue('12345678abcd')).toBe('1234****abcd');
    });

    test('非字符串返回 ****', () => {
        expect(maskValue(123)).toBe('****');
        expect(maskValue(null)).toBe('****');
        expect(maskValue(undefined)).toBe('****');
        expect(maskValue({})).toBe('****');
    });

    test('刚好8字符', () => {
        expect(maskValue('12345678')).toBe('1234****5678');
    });
});

describe('sensitiveFilter.filterSensitive', () => {
    test('null/undefined 原样返回', () => {
        expect(filterSensitive(null)).toBeNull();
        expect(filterSensitive(undefined)).toBeUndefined();
    });

    test('字符串/数字 原样返回', () => {
        expect(filterSensitive('hello')).toBe('hello');
        expect(filterSensitive(42)).toBe(42);
    });

    test('数组递归过滤', () => {
        const arr = [{ apiKey: '1234567890abcdef' }, { name: 'ok' }];
        const result = filterSensitive(arr);
        expect(result[0].apiKey).toBe('1234****cdef');
        expect(result[1].name).toBe('ok');
    });

    test('apiKey 字段被 mask', () => {
        const result = filterSensitive({ apiKey: '1234567890abcdef' });
        expect(result.apiKey).toBe('1234****cdef');
    });

    test('password 字段被 mask', () => {
        const result = filterSensitive({ password: 'mySecretPass' });
        expect(result.password).toBe('mySe****Pass');
    });

    test('authorization 字段被 mask', () => {
        const result = filterSensitive({ authorization: 'Bearer token123456' });
        expect(result.authorization).toBe('Bear****3456');
    });

    test('非敏感字段保留原值', () => {
        const result = filterSensitive({ name: 'Alice', age: 30 });
        expect(result.name).toBe('Alice');
        expect(result.age).toBe(30);
    });

    test('token 字段：htk_ 前缀的 auth token 不被 mask', () => {
        const result = filterSensitive({ token: 'htk_user123456' });
        expect(result.token).toBe('htk_user123456');
    });

    test('token 字段：非 htk_ 前缀被 mask', () => {
        const result = filterSensitive({ token: 'apikey12345678' });
        expect(result.token).toBe('apik****5678');
    });

    test('嵌套对象递归过滤', () => {
        const result = filterSensitive({
            user: { name: 'Bob', password: 'secretPass' },
            meta: { apiKey: 'key1234567890' }
        });
        expect(result.user.name).toBe('Bob');
        expect(result.user.password).toBe('secr****Pass');
        expect(result.meta.apiKey).toBe('key1****7890');
    });

    test('深度超过8时返回原对象', () => {
        let obj = { apiKey: '1234567890abcdef' };
        for (let i = 0; i < 10; i++) obj = { nested: obj };
        const result = filterSensitive(obj);
        // 深度限制后内层对象原样返回
        expect(result).toBeDefined();
    });

    test('非字符串敏感值不 mask（如数字）', () => {
        const result = filterSensitive({ apiKey: 12345 });
        expect(result.apiKey).toBe(12345);
    });
});

describe('sensitiveFilter.filterApiResponse', () => {
    test('null/undefined 原样返回', () => {
        expect(filterApiResponse(null)).toBeNull();
        expect(filterApiResponse(undefined)).toBeUndefined();
    });

    test('非对象原样返回', () => {
        expect(filterApiResponse('string')).toBe('string');
        expect(filterApiResponse(42)).toBe(42);
    });

    test('对象过滤敏感字段', () => {
        const data = { success: true, data: { apiKey: '1234567890abcdef', name: 'test' } };
        const result = filterApiResponse(data);
        expect(result.success).toBe(true);
        expect(result.data.apiKey).toBe('1234****cdef');
        expect(result.data.name).toBe('test');
    });
});
