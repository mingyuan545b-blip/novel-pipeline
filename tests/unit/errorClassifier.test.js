'use strict';

/**
 * errorClassifier 错误分类器单元测试（Q2）
 *
 * 测试策略：
 * - 覆盖所有分类函数：classifyLLMError / isLLMOverloaded / isLLMTimeout / isCodeBug / isNetworkError / isContextOverflow
 * - 每个模式常量至少 2 个用例（含中文/英文/边界）
 * - 验证 status/code 优先级、instanceof 判定、未知错误透传
 *
 * 文件位置：tests/unit/errorClassifier.test.js
 */

const {
    classifyLLMError,
    isLLMOverloaded,
    isLLMTimeout,
    isCodeBug,
    isNetworkError,
    isContextOverflow,
    OVERLOAD_PATTERNS,
    TIMEOUT_PATTERNS,
    CONTEXT_OVERFLOW_PATTERNS,
    CODE_BUG_PATTERNS,
    NETWORK_PATTERNS
} = require('../../server/shared/errorClassifier');
const {
    LLMOverloadedError,
    LLMTimeoutError,
    ContextOverflowError
} = require('../../server/shared/errors');

describe('errorClassifier (Q2)', () => {
    describe('模式常量完整性', () => {
        test('OVERLOAD_PATTERNS 是非空数组', () => {
            expect(Array.isArray(OVERLOAD_PATTERNS)).toBe(true);
            expect(OVERLOAD_PATTERNS.length).toBeGreaterThan(0);
        });
        test('TIMEOUT_PATTERNS 是非空数组', () => {
            expect(Array.isArray(TIMEOUT_PATTERNS)).toBe(true);
            expect(TIMEOUT_PATTERNS.length).toBeGreaterThan(0);
        });
        test('CONTEXT_OVERFLOW_PATTERNS 是非空数组', () => {
            expect(Array.isArray(CONTEXT_OVERFLOW_PATTERNS)).toBe(true);
            expect(CONTEXT_OVERFLOW_PATTERNS.length).toBeGreaterThan(0);
        });
        test('CODE_BUG_PATTERNS 是非空数组', () => {
            expect(Array.isArray(CODE_BUG_PATTERNS)).toBe(true);
            expect(CODE_BUG_PATTERNS.length).toBeGreaterThan(0);
        });
        test('NETWORK_PATTERNS 是非空数组', () => {
            expect(Array.isArray(NETWORK_PATTERNS)).toBe(true);
            expect(NETWORK_PATTERNS.length).toBeGreaterThan(0);
        });
    });

    describe('classifyLLMError', () => {
        test('529 状态码 → LLMOverloadedError', () => {
            const e = new Error('Service unavailable');
            e.status = 529;
            const classified = classifyLLMError(e);
            expect(classified).toBeInstanceOf(LLMOverloadedError);
            expect(classified.message).toBe('Service unavailable');
        });

        test('2064 状态码 → LLMOverloadedError', () => {
            const e = new Error('Quota exceeded');
            e.statusCode = 2064;
            const classified = classifyLLMError(e);
            expect(classified).toBeInstanceOf(LLMOverloadedError);
        });

        test('status 与 statusCode 同时存在时优先 status', () => {
            const e = new Error('x');
            e.status = 529;
            e.statusCode = 200;
            const classified = classifyLLMError(e);
            expect(classified).toBeInstanceOf(LLMOverloadedError);
        });

        test('overloaded 模式匹配 → LLMOverloadedError', () => {
            const e = new Error('The service is overloaded');
            expect(classifyLLMError(e)).toBeInstanceOf(LLMOverloadedError);
        });

        test('rate limit 模式匹配 → LLMOverloadedError', () => {
            const e = new Error('Rate limit exceeded');
            expect(classifyLLMError(e)).toBeInstanceOf(LLMOverloadedError);
        });

        test('中文"负载较高"匹配 → LLMOverloadedError', () => {
            const e = new Error('服务负载较高，请稍后重试');
            expect(classifyLLMError(e)).toBeInstanceOf(LLMOverloadedError);
        });

        test('quota 模式匹配 → LLMOverloadedError', () => {
            const e = new Error('quota exceeded');
            expect(classifyLLMError(e)).toBeInstanceOf(LLMOverloadedError);
        });

        test('timeout 模式匹配 → LLMTimeoutError', () => {
            const e = new Error('Request timeout');
            expect(classifyLLMError(e)).toBeInstanceOf(LLMTimeoutError);
        });

        test('etimedout 模式匹配 → LLMTimeoutError', () => {
            const e = new Error('ETIMEDOUT connection');
            expect(classifyLLMError(e)).toBeInstanceOf(LLMTimeoutError);
        });

        test('中文"超时"匹配 → LLMTimeoutError', () => {
            const e = new Error('请求超时');
            expect(classifyLLMError(e)).toBeInstanceOf(LLMTimeoutError);
        });

        test('aborted 模式匹配 → LLMTimeoutError', () => {
            const e = new Error('Request aborted');
            expect(classifyLLMError(e)).toBeInstanceOf(LLMTimeoutError);
        });

        test('context_length_exceeded 模式匹配 → ContextOverflowError', () => {
            const e = new Error('context_length_exceeded');
            const classified = classifyLLMError(e);
            expect(classified).toBeInstanceOf(ContextOverflowError);
        });

        test('isContextOverflow 标志 → ContextOverflowError', () => {
            const e = new Error('custom message');
            e.isContextOverflow = true;
            e.estimatedTokens = 5000;
            e.budget = 4096;
            const classified = classifyLLMError(e);
            expect(classified).toBeInstanceOf(ContextOverflowError);
            expect(classified.estimatedTokens).toBe(5000);
            expect(classified.budget).toBe(4096);
        });

        test('未知错误透传原 error 对象', () => {
            const e = new Error('some random error');
            expect(classifyLLMError(e)).toBe(e);
        });

        test('空 message 不抛错', () => {
            const e = new Error('');
            expect(() => classifyLLMError(e)).not.toThrow();
        });

        test('null message 不抛错', () => {
            const e = new Error();
            e.message = null;
            expect(() => classifyLLMError(e)).not.toThrow();
        });

        test('优先级：overload > timeout > contextOverflow', () => {
            // 同时包含 overload 和 timeout 模式，应优先 overload
            const e = new Error('overloaded timeout');
            expect(classifyLLMError(e)).toBeInstanceOf(LLMOverloadedError);
        });
    });

    describe('isLLMOverloaded', () => {
        test('LLMOverloadedError 实例返回 true', () => {
            const e = new LLMOverloadedError('x');
            expect(isLLMOverloaded(e)).toBe(true);
        });

        test('529 状态码返回 true', () => {
            const e = new Error('x');
            e.status = 529;
            expect(isLLMOverloaded(e)).toBe(true);
        });

        test('2064 statusCode 返回 true', () => {
            const e = new Error('x');
            e.statusCode = 2064;
            expect(isLLMOverloaded(e)).toBe(true);
        });

        test('overloaded 模式匹配返回 true', () => {
            expect(isLLMOverloaded(new Error('Service overloaded'))).toBe(true);
        });

        test('throttling 模式匹配返回 true', () => {
            expect(isLLMOverloaded(new Error('throttling request'))).toBe(true);
        });

        test('普通错误返回 false', () => {
            expect(isLLMOverloaded(new Error('normal error'))).toBe(false);
        });
    });

    describe('isLLMTimeout', () => {
        test('LLMTimeoutError 实例返回 true', () => {
            expect(isLLMTimeout(new LLMTimeoutError('x'))).toBe(true);
        });

        test('timeout 模式匹配返回 true', () => {
            expect(isLLMTimeout(new Error('request timeout'))).toBe(true);
        });

        test('timed out 模式匹配返回 true', () => {
            expect(isLLMTimeout(new Error('request timed out'))).toBe(true);
        });

        test('普通错误返回 false', () => {
            expect(isLLMTimeout(new Error('normal error'))).toBe(false);
        });
    });

    describe('isCodeBug', () => {
        test('is not defined 匹配', () => {
            expect(isCodeBug(new Error('foo is not defined'))).toBe(true);
        });

        test('referenceerror 匹配（大小写不敏感）', () => {
            expect(isCodeBug(new Error('ReferenceError: x'))).toBe(true);
        });

        test('typeerror 匹配', () => {
            expect(isCodeBug(new Error('TypeError: cannot read'))).toBe(true);
        });

        test('cannot read 匹配', () => {
            expect(isCodeBug(new Error("cannot read property 'x' of undefined"))).toBe(true);
        });

        test('普通错误返回 false', () => {
            expect(isCodeBug(new Error('normal error'))).toBe(false);
        });
    });

    describe('isNetworkError', () => {
        test('econnreset 匹配', () => {
            expect(isNetworkError(new Error('ECONNRESET'))).toBe(true);
        });

        test('econnrefused 匹配', () => {
            expect(isNetworkError(new Error('ECONNREFUSED 127.0.0.1:3001'))).toBe(true);
        });

        test('fetch failed 匹配', () => {
            expect(isNetworkError(new Error('fetch failed'))).toBe(true);
        });

        test('network 匹配', () => {
            expect(isNetworkError(new Error('network error'))).toBe(true);
        });

        test('socket hang up 匹配', () => {
            expect(isNetworkError(new Error('socket hang up'))).toBe(true);
        });

        test('enotfound 匹配', () => {
            expect(isNetworkError(new Error('ENOTFOUND example.com'))).toBe(true);
        });

        test('普通错误返回 false', () => {
            expect(isNetworkError(new Error('normal error'))).toBe(false);
        });
    });

    describe('isContextOverflow', () => {
        test('ContextOverflowError 实例返回 true', () => {
            expect(isContextOverflow(new ContextOverflowError('x', 100, 50))).toBe(true);
        });

        test('isContextOverflow 标志返回 true', () => {
            const e = new Error('x');
            e.isContextOverflow = true;
            expect(isContextOverflow(e)).toBe(true);
        });

        test('context_length 模式匹配', () => {
            expect(isContextOverflow(new Error('context_length exceeded'))).toBe(true);
        });

        test('context_overflow 模式匹配', () => {
            expect(isContextOverflow(new Error('context_overflow'))).toBe(true);
        });

        test('普通错误返回 false', () => {
            expect(isContextOverflow(new Error('normal error'))).toBe(false);
        });
    });

    describe('大小写不敏感', () => {
        test('OVERLOAD 大写匹配', () => {
            expect(isLLMOverloaded(new Error('SERVICE OVERLOADED'))).toBe(true);
        });

        test('TIMEOUT 大写匹配', () => {
            expect(isLLMTimeout(new Error('REQUEST TIMEOUT'))).toBe(true);
        });

        test('NETWORK 大写匹配', () => {
            expect(isNetworkError(new Error('NETWORK DOWN'))).toBe(true);
        });
    });

    describe('边界条件', () => {
        test('error.message 为 undefined 时不抛错', () => {
            const e = new Error();
            e.message = undefined;
            expect(() => isLLMOverloaded(e)).not.toThrow();
            expect(() => isLLMTimeout(e)).not.toThrow();
            expect(() => isCodeBug(e)).not.toThrow();
            expect(() => isNetworkError(e)).not.toThrow();
            expect(() => isContextOverflow(e)).not.toThrow();
        });

        test('classifyLLMError 接收非 Error 对象不抛错', () => {
            expect(() => classifyLLMError({ message: 'overloaded' })).not.toThrow();
        });
    });
});
