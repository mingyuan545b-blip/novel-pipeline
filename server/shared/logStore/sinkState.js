'use strict';

/**
 * 日志存储共享状态
 *
 * 持有 aggregator/persister sink 引用，供 LogStore 类和 attach 函数共享访问。
 * 提取为独立模块以避免循环依赖，同时保持 LogStore 类的 sink 访问能力。
 * 文件位置：server/shared/logStore/sinkState.js
 */

/** @type {{aggregator: Object|null, persister: Object|null}} */
const sinkState = {
    aggregator: null,
    persister: null
};

module.exports = { sinkState };
