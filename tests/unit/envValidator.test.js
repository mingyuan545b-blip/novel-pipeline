'use strict';

/**
 * G5 测试：envValidator 环境变量 schema 校验
 *
 * 覆盖：
 *   - parseValue int/enum/string 类型解析
 *   - parseValue 范围校验（min/max）
 *   - parseValue 必填校验
 *   - validateEnv 正常场景（全合法）
 *   - validateEnv PORT 超范围
 *   - validateEnv NODE_ENV 非法值
 *   - validateEnv 互斥组校验（PG_* 部分设置）
 *   - validateEnv warnIfEmpty 警告
 *   - validateEnv config 返回默认值
 *
 * 文件位置：tests/unit/envValidator.test.js
 */

const { parseValue, validateEnv, ENV_SCHEMA, PORT_RANGE } = require('../../server/config/envValidator');

describe('G5: parseValue 类型解析', () => {
    test('int 类型应返回数值', () => {
        const r = parseValue('PORT', '3001', ENV_SCHEMA.PORT);
        expect(r.value).toBe(3001);
    });

    test('int 非数字应返回 error', () => {
        const r = parseValue('PORT', 'abc', ENV_SCHEMA.PORT);
        expect(r.error).toBeDefined();
        expect(r.error).toContain('整数');
    });

    test('int 小数应返回 error', () => {
        const r = parseValue('PORT', '3001.5', ENV_SCHEMA.PORT);
        expect(r.error).toBeDefined();
    });

    test('int 低于 min 应返回 error', () => {
        const r = parseValue('PORT', '0', ENV_SCHEMA.PORT);
        expect(r.error).toContain('不能小于 1');
    });

    test('int 高于 max 应返回 error', () => {
        const r = parseValue('PORT', '70000', ENV_SCHEMA.PORT);
        expect(r.error).toContain('不能大于 65535');
    });

    test('enum 合法值应通过', () => {
        const r = parseValue('NODE_ENV', 'production', ENV_SCHEMA.NODE_ENV);
        expect(r.value).toBe('production');
    });

    test('enum 非法值应返回 error', () => {
        const r = parseValue('NODE_ENV', 'staging', ENV_SCHEMA.NODE_ENV);
        expect(r.error).toContain('development/production/test');
    });

    test('string 类型应原样返回', () => {
        const r = parseValue('REQUEST_SECRET', 'my-secret', ENV_SCHEMA.REQUEST_SECRET);
        expect(r.value).toBe('my-secret');
    });

    test('空值且非必填应返回 default', () => {
        const r = parseValue('PORT', undefined, ENV_SCHEMA.PORT);
        expect(r.value).toBe(3001);
    });

    test('空字符串且非必填应返回 default', () => {
        const r = parseValue('PORT', '', ENV_SCHEMA.PORT);
        expect(r.value).toBe(3001);
    });
});

describe('G5: validateEnv 整体校验', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // 清理测试相关变量
        delete process.env.PORT;
        delete process.env.NODE_ENV;
        delete process.env.LOG_LEVEL;
        delete process.env.REQUEST_SECRET;
        delete process.env.ENCRYPTION_SECRET;
        delete process.env.CORS_ORIGINS;
        delete process.env.ALIYUN_CODING_API_KEY;
        delete process.env.ALIYUN_CODING_MODEL;
        delete process.env.PG_HOST;
        delete process.env.PG_PORT;
        delete process.env.PG_USER;
        delete process.env.PG_PASSWORD;
        delete process.env.PG_DATABASE;
    });

    afterEach(() => {
        // 恢复原始 env
        for (const k of Object.keys(process.env)) {
            if (!(k in originalEnv)) delete process.env[k];
        }
        Object.assign(process.env, originalEnv);
    });

    test('全空场景应通过（使用默认值）', () => {
        const r = validateEnv();
        expect(r.passed).toBe(true);
        expect(r.errors).toEqual([]);
        expect(r.config.PORT).toBe(3001);
        expect(r.config.NODE_ENV).toBe('development');
    });

    test('全空场景应产生 warnIfEmpty 警告', () => {
        const r = validateEnv();
        // REQUEST_SECRET, ENCRYPTION_SECRET, ALIYUN_CODING_API_KEY 都应警告
        expect(r.warnings.length).toBeGreaterThanOrEqual(3);
        expect(r.warnings.some(w => w.includes('REQUEST_SECRET'))).toBe(true);
        expect(r.warnings.some(w => w.includes('ENCRYPTION_SECRET'))).toBe(true);
    });

    test('PORT 超范围应失败', () => {
        process.env.PORT = '99999';
        const r = validateEnv();
        expect(r.passed).toBe(false);
        expect(r.errors.some(e => e.includes('PORT'))).toBe(true);
    });

    test('PORT=0 应失败', () => {
        process.env.PORT = '0';
        const r = validateEnv();
        expect(r.passed).toBe(false);
    });

    test('NODE_ENV 非法值应失败', () => {
        process.env.NODE_ENV = 'staging';
        const r = validateEnv();
        expect(r.passed).toBe(false);
        expect(r.errors.some(e => e.includes('NODE_ENV'))).toBe(true);
    });

    test('LOG_LEVEL 非法值应失败', () => {
        process.env.LOG_LEVEL = 'trace';
        const r = validateEnv();
        expect(r.passed).toBe(false);
    });

    test('PG_* 部分设置应失败（互斥校验）', () => {
        process.env.PG_HOST = 'localhost';
        process.env.PG_PORT = '5432';
        // PG_USER/PG_PASSWORD/PG_DATABASE 未设置
        const r = validateEnv();
        expect(r.passed).toBe(false);
        expect(r.errors.some(e => e.includes('PostgreSQL'))).toBe(true);
    });

    test('PG_* 全部设置应通过', () => {
        process.env.PG_HOST = 'localhost';
        process.env.PG_PORT = '5432';
        process.env.PG_USER = 'postgres';
        process.env.PG_PASSWORD = 'secret';
        process.env.PG_DATABASE = 'novel';
        const r = validateEnv();
        expect(r.passed).toBe(true);
        expect(r.errors.some(e => e.includes('PostgreSQL'))).toBe(false);
    });

    test('PG_* 全部留空应通过', () => {
        const r = validateEnv();
        expect(r.errors.some(e => e.includes('PostgreSQL'))).toBe(false);
    });

    test('所有变量合法时应通过且无警告', () => {
        process.env.PORT = '4000';
        process.env.NODE_ENV = 'production';
        process.env.LOG_LEVEL = 'warn';
        process.env.REQUEST_SECRET = 'secret';
        process.env.ENCRYPTION_SECRET = 'enc-key';
        process.env.ALIYUN_CODING_API_KEY = 'api-key';
        process.env.ALIYUN_CODING_MODEL = 'qwen-plus';
        const r = validateEnv();
        expect(r.passed).toBe(true);
        expect(r.warnings).toEqual([]);
        expect(r.config.PORT).toBe(4000);
    });

    test('config 应反映解析后的值', () => {
        process.env.PORT = '8080';
        process.env.NODE_ENV = 'test';
        const r = validateEnv();
        expect(r.config.PORT).toBe(8080);
        expect(r.config.NODE_ENV).toBe('test');
    });
});

describe('G5: 常量导出', () => {
    test('PORT_RANGE 应为 1-65535', () => {
        expect(PORT_RANGE.MIN).toBe(1);
        expect(PORT_RANGE.MAX).toBe(65535);
    });

    test('ENV_SCHEMA 应包含核心字段', () => {
        const required = ['PORT', 'NODE_ENV', 'LOG_LEVEL', 'REQUEST_SECRET', 'ENCRYPTION_SECRET'];
        for (const k of required) {
            expect(ENV_SCHEMA[k]).toBeDefined();
        }
    });
});
