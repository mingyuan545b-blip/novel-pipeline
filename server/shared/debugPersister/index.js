'use strict';

/**
 * 调试日志持久化聚合入口
 * 对外保持 require('shared/debugPersister') 路径不变
 * 文件位置：server/shared/debugPersister/index.js
 */

const { DebugPersister } = require('./debugPersisterClass');
const {
    FLUSH_INTERVAL_MS,
    FLUSH_BATCH_SIZE,
    RETENTION_DAYS,
    BUFFER_FORCE_FALLBACK_THRESHOLD,
    CONSECUTIVE_FAILURES_THRESHOLD
} = require('./constants');

// 单例
const debugPersister = new DebugPersister();

module.exports = {
    DebugPersister,
    debugPersister,
    FLUSH_INTERVAL_MS,
    FLUSH_BATCH_SIZE,
    RETENTION_DAYS,
    BUFFER_FORCE_FALLBACK_THRESHOLD,
    CONSECUTIVE_FAILURES_THRESHOLD
};
