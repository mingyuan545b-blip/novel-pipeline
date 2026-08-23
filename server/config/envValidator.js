/**
 * envValidator.js — G5: 环境变量 schema 校验统一
 *
 * 集中定义所有环境变量的类型/范围/默认值/必填规则，
 * 启动时调用 validateEnv() 校验，errors 阻止启动，warnings 记录日志。
 *
 * 设计原则：
 *   - 不引入 envalid 等新依赖，纯 JS 实现
 *   - schema 集中定义，禁止散落在各文件的 process.env.XXX 直读
 *   - 互斥校验：PG_* 变量组要么全设置要么全不设置
 *   - PORT 范围校验：1-65535
 *
 * 文件位置：server/config/envValidator.js
 */
'use strict';

const { SERVER_DEFAULTS } = require('./systemConfig');

// 环境变量 schema 定义
const ENV_SCHEMA = Object.freeze({
    PORT: {
        type: 'int', default: SERVER_DEFAULTS.DEFAULT_PORT,
        min: 1, max: 65535,
        description: '服务端口'
    },
    NODE_ENV: {
        type: 'enum', default: 'development',
        values: ['development', 'production', 'test'],
        description: '运行环境'
    },
    LOG_LEVEL: {
        type: 'enum', default: 'info',
        values: ['debug', 'info', 'warn', 'error'],
        description: '日志级别'
    },
    REQUEST_SECRET: {
        type: 'string', default: '',
        required: false, warnIfEmpty: true,
        description: '请求鉴权密钥（空则禁用认证，仅开发期允许）'
    },
    ENCRYPTION_SECRET: {
        type: 'string', default: '',
        required: false, warnIfEmpty: true,
        description: 'API Key 加密密钥（空则明文存储，仅开发期允许）'
    },
    CORS_ORIGINS: {
        type: 'string', default: '',
        required: false,
        description: 'CORS 来源（逗号分隔，空则使用默认 localhost）'
    },
    ALIYUN_CODING_API_KEY: {
        type: 'string', default: '',
        required: false, warnIfEmpty: true,
        description: '阿里云百炼 API Key'
    },
    ALIYUN_CODING_MODEL: {
        type: 'string', default: '',
        required: false,
        description: '阿里云百炼模型名'
    }
});

// 互斥变量组：组内变量要么全设置要么全不设置
const MUTUAL_EXCLUSIVE_GROUPS = Object.freeze([
    {
        name: 'PG_DATABASE',
        keys: ['PG_HOST', 'PG_PORT', 'PG_USER', 'PG_PASSWORD', 'PG_DATABASE'],
        description: 'PostgreSQL 连接参数需全部设置或全部留空'
    }
]);

const PORT_RANGE = { MIN: 1, MAX: 65535 };

/**
 * 解析单个环境变量
 */
function parseValue(key, raw, rule) {
    if (raw === undefined || raw === '') {
        if (rule.required) return { error: `${key} 必填但未设置` };
        return { value: rule.default };
    }
    switch (rule.type) {
        case 'int': {
            const n = Number(raw);
            if (!Number.isFinite(n) || Math.floor(n) !== n) {
                return { error: `${key} 必须为整数，实际: ${raw}` };
            }
            if (rule.min !== undefined && n < rule.min) {
                return { error: `${key} 不能小于 ${rule.min}，实际: ${n}` };
            }
            if (rule.max !== undefined && n > rule.max) {
                return { error: `${key} 不能大于 ${rule.max}，实际: ${n}` };
            }
            return { value: n };
        }
        case 'enum':
            if (!rule.values.includes(raw)) {
                return { error: `${key} 必须为 ${rule.values.join('/')} 之一，实际: ${raw}` };
            }
            return { value: raw };
        case 'string':
        default:
            return { value: raw };
    }
}

/**
 * 校验互斥变量组
 */
function checkMutualExclusive(errors) {
    for (const group of MUTUAL_EXCLUSIVE_GROUPS) {
        const set = group.keys.filter(k => process.env[k] && process.env[k].trim() !== '');
        if (set.length > 0 && set.length < group.keys.length) {
            const missing = group.keys.filter(k => !set.includes(k));
            errors.push(`${group.description}：已设置 ${set.join(',')}，缺失 ${missing.join(',')}`);
        }
    }
}

/**
 * 校验所有环境变量
 * @returns {{ passed: boolean, errors: string[], warnings: string[], config: object }}
 */
function validateEnv() {
    const errors = [];
    const warnings = [];
    const config = {};

    for (const [key, rule] of Object.entries(ENV_SCHEMA)) {
        const raw = process.env[key];
        const parsed = parseValue(key, raw, rule);
        if (parsed.error) {
            errors.push(parsed.error);
            config[key] = rule.default;
        } else {
            config[key] = parsed.value;
            if (rule.warnIfEmpty && (!parsed.value || parsed.value.trim() === '')) {
                warnings.push(`${key} 未设置 — ${rule.description}`);
            }
        }
    }

    checkMutualExclusive(errors);

    return {
        passed: errors.length === 0,
        errors,
        warnings,
        config
    };
}

module.exports = {
    ENV_SCHEMA,
    MUTUAL_EXCLUSIVE_GROUPS,
    PORT_RANGE,
    validateEnv,
    parseValue
};
