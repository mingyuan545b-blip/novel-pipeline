'use strict';

/**
 * inputSanitizer 单元测试
 *
 * 验证：
 * 1. XSS 危险模式被实际移除（修复死代码漏洞）
 * 2. 超长字符串被截断
 * 3. 嵌套对象递归净化
 * 4. 非字符串类型不受影响
 *
 * 文件位置：tests/unit/inputSanitizer.test.js
 */

const {
    sanitizeString,
    sanitizeObject,
    inputSanitizer,
    DANGEROUS_PATTERNS,
    MAX_STRING_LENGTH
} = require('../../server/middleware/inputSanitizer');

describe('inputSanitizer', () => {
    describe('sanitizeString - XSS 清洗', () => {
        test('应移除 <script> 标签', () => {
            const input = '<script>alert("xss")</script>正常文本';
            const result = sanitizeString(input);
            expect(result).toBe('正常文本');
            expect(result).not.toMatch(/<script/i);
        });

        test('应移除 javascript: 协议', () => {
            const input = 'href="javascript:alert(1)"';
            const result = sanitizeString(input);
            // javascript: 被移除，保留 alert(1)
            expect(result).toBe('href="alert(1)"');
            expect(result).not.toMatch(/javascript\s*:/i);
        });

        test('应移除 onXxx= 事件处理器', () => {
            const input = '<img src=x onerror=alert(1)>';
            const result = sanitizeString(input);
            // onerror= 被移除，保留 alert(1)
            expect(result).not.toMatch(/\bonerror\s*=/i);
            expect(result).toBe('<img src=x alert(1)>');
        });

        test('应同时处理多种 XSS 模式', () => {
            const input = '<script>evil()</script><img onerror=alert(1) src=x>link';
            const result = sanitizeString(input);
            expect(result).not.toMatch(/<script/i);
            expect(result).not.toMatch(/\bonerror\s*=/i);
            expect(result).toContain('link');
        });

        test('大小写不敏感匹配', () => {
            const input = '<SCRIPT>alert(1)</SCRIPT>OnErRoR=alert(2)';
            const result = sanitizeString(input);
            expect(result).not.toMatch(/<script/i);
            expect(result).not.toMatch(/\bonerror\s*=/i);
        });

        test('正常文本不应被修改', () => {
            const input = '这是一段正常文本 with English and 123';
            expect(sanitizeString(input)).toBe(input);
        });
    });

    describe('sanitizeString - 长度截断', () => {
        test('超长字符串应被截断到 MAX_STRING_LENGTH', () => {
            const longStr = 'a'.repeat(MAX_STRING_LENGTH + 100);
            const result = sanitizeString(longStr);
            expect(result.length).toBe(MAX_STRING_LENGTH);
        });

        test('恰好等于上限的字符串不应被截断', () => {
            const exactStr = 'a'.repeat(MAX_STRING_LENGTH);
            expect(sanitizeString(exactStr).length).toBe(MAX_STRING_LENGTH);
        });
    });

    describe('sanitizeString - 类型处理', () => {
        test('非字符串类型应原样返回', () => {
            expect(sanitizeString(123)).toBe(123);
            expect(sanitizeString(null)).toBeNull();
            expect(sanitizeString(undefined)).toBeUndefined();
            expect(sanitizeString(true)).toBe(true);
        });
    });

    describe('sanitizeObject - 递归净化', () => {
        test('应递归净化嵌套对象的字符串值', () => {
            const input = {
                level1: {
                    level2: '<script>evil()</script>safe',
                    normal: 'text'
                },
                arr: ['<img onerror=alert(1)>', 'normal']
            };
            const result = sanitizeObject(input);
            expect(result.level1.level2).toBe('safe');
            expect(result.level1.normal).toBe('text');
            // onerror= 被移除，保留 alert(1)
            expect(result.arr[0]).toBe('<img alert(1)>');
            expect(result.arr[1]).toBe('normal');
        });

        test('应处理数组的嵌套', () => {
            const input = [{ nested: 'javascript:alert(1)' }, { nested: 'ok' }];
            const result = sanitizeObject(input);
            // javascript: 被移除，保留 alert(1)
            expect(result[0].nested).toBe('alert(1)');
            expect(result[1].nested).toBe('ok');
        });

        test('深度超过上限应原样返回', () => {
            const deep = { a: { b: { c: { d: '<script>evil()</script>' } } } };
            const result = sanitizeObject(deep, 11);
            // 深度超限，不再递归
            expect(result).toBe(deep);
        });

        test('null/undefined 应原样返回', () => {
            expect(sanitizeObject(null)).toBeNull();
            expect(sanitizeObject(undefined)).toBeUndefined();
        });

        test('非对象类型应原样返回', () => {
            expect(sanitizeObject(123)).toBe(123);
            expect(sanitizeObject('string')).toBe('string');
        });
    });

    describe('inputSanitizer 中间件', () => {
        function createMockReq(body, query) {
            return { body: body || {}, query: query || {} };
        }

        test('应净化 req.body', () => {
            const req = createMockReq({ html: '<script>alert(1)</script>' });
            const next = jest.fn();
            inputSanitizer(req, {}, next);
            // script 标签整体被移除
            expect(req.body.html).toBe('');
            expect(next).toHaveBeenCalled();
        });

        test('应净化 req.query', () => {
            const req = createMockReq({}, { redirect: 'javascript:alert(1)' });
            const next = jest.fn();
            inputSanitizer(req, {}, next);
            expect(req.query.redirect).toBe('alert(1)');
            expect(next).toHaveBeenCalled();
        });

        test('body 为空时不应报错', () => {
            const req = { body: null, query: {} };
            const next = jest.fn();
            expect(() => inputSanitizer(req, {}, next)).not.toThrow();
            expect(next).toHaveBeenCalled();
        });

        test('应调用 next() 传递控制权', () => {
            const req = createMockReq();
            const next = jest.fn();
            inputSanitizer(req, {}, next);
            expect(next).toHaveBeenCalledTimes(1);
        });
    });

    describe('DANGEROUS_PATTERNS 常量', () => {
        test('应导出 3 个 XSS 模式', () => {
            expect(DANGEROUS_PATTERNS).toHaveLength(3);
            expect(DANGEROUS_PATTERNS.every(p => p instanceof RegExp)).toBe(true);
        });
    });
});
