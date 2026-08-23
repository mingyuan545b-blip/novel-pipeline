/**
 * eslint-rules/index.js — 本地ESLint插件入口
 * 注册PROJECT_STANDARDS相关的自定义规则
 */
'use strict';

module.exports = {
    rules: {
        'no-store-direct-call': require('./no-store-direct-call'),
    },
};
