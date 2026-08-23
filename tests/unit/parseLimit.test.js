'use strict';

/**
 * parseLimit 单元测试（方向 G3：统一 limit 解析）
 *
 * 覆盖：
 * 1. 默认值返回
 * 2. 合法值返回
 * 3. 上限截断
 * 4. 非法值兜底
 * 5. 自定义 default/max
 *
 * 文件位置：tests/unit/parseLimit.test.js
 */

const { parseLimit, LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX } = require('../../server/middleware/validators');

describe('parseLimit - G3 统一 limit 解析', () => {
    describe('默认值', () => {
        test('未传参应返回默认值 50', () => {
            expect(parseLimit(undefined)).toBe(LIST_LIMIT_DEFAULT);
            expect(parseLimit(null)).toBe(LIST_LIMIT_DEFAULT);
        });

        test('空字符串应返回默认值', () => {
            expect(parseLimit('')).toBe(LIST_LIMIT_DEFAULT);
        });
    });

    describe('合法值', () => {
        test('正整数应原样返回', () => {
            expect(parseLimit('10')).toBe(10);
            expect(parseLimit('50')).toBe(50);
            expect(parseLimit('100')).toBe(100);
        });

        test('数字类型也应支持', () => {
            expect(parseLimit(10)).toBe(10);
            expect(parseLimit(50)).toBe(50);
        });
    });

    describe('上限截断', () => {
        test('超过 200 应截断到 200', () => {
            expect(parseLimit('201')).toBe(LIST_LIMIT_MAX);
            expect(parseLimit('500')).toBe(LIST_LIMIT_MAX);
            expect(parseLimit('99999')).toBe(LIST_LIMIT_MAX);
        });

        test('恰好等于 200 应原样返回', () => {
            expect(parseLimit('200')).toBe(LIST_LIMIT_MAX);
        });
    });

    describe('非法值兜底', () => {
        test('负数应返回默认值', () => {
            expect(parseLimit('-1')).toBe(LIST_LIMIT_DEFAULT);
            expect(parseLimit('-100')).toBe(LIST_LIMIT_DEFAULT);
        });

        test('0 应返回默认值', () => {
            expect(parseLimit('0')).toBe(LIST_LIMIT_DEFAULT);
        });

        test('非数字字符串应返回默认值', () => {
            expect(parseLimit('abc')).toBe(LIST_LIMIT_DEFAULT);
            expect(parseLimit('null')).toBe(LIST_LIMIT_DEFAULT);
            expect(parseLimit('1abc')).toBe(LIST_LIMIT_DEFAULT);
        });

        test('NaN/Infinity 应返回默认值', () => {
            expect(parseLimit(NaN)).toBe(LIST_LIMIT_DEFAULT);
            expect(parseLimit(Infinity)).toBe(LIST_LIMIT_DEFAULT);
        });
    });

    describe('自定义 default/max', () => {
        test('应支持自定义默认值', () => {
            expect(parseLimit(undefined, 24, 200)).toBe(24);
            expect(parseLimit(null, 100, 500)).toBe(100);
        });

        test('应支持自定义上限', () => {
            expect(parseLimit('500', 50, 100)).toBe(100);
            expect(parseLimit('1000', 24, 500)).toBe(500);
        });

        test('snapshots 场景（default=24, max=200）', () => {
            expect(parseLimit(undefined, 24, 200)).toBe(24);
            expect(parseLimit('10', 24, 200)).toBe(10);
            expect(parseLimit('500', 24, 200)).toBe(200);
        });
    });

    describe('常量值', () => {
        test('LIST_LIMIT_DEFAULT 应为 50', () => {
            expect(LIST_LIMIT_DEFAULT).toBe(50);
        });

        test('LIST_LIMIT_MAX 应为 200', () => {
            expect(LIST_LIMIT_MAX).toBe(200);
        });
    });
});
