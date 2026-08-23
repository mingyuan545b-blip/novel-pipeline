'use strict';

/**
 * 日志存储聚合入口
 * 对外保持 require('shared/logStore') 路径不变
 * 文件位置：server/shared/logStore/index.js
 */

const { ERROR_CODES } = require('../errorCodes');
const { LogStore } = require('./logStoreClass');
const { sinkState } = require('./sinkState');

// 单例（全应用共享）
const logStore = new LogStore();

/**
 * 注入聚合器实例（应用启动期调用一次）
 * @param {{ingest: Function, clear: Function}} aggregator
 */
function attachAggregator(aggregator) {
    sinkState.aggregator = aggregator;
}

/**
 * 注入持久化实例（应用启动期调用一次）
 * @param {{pushLog: Function}} persister
 */
function attachPersister(persister) {
    sinkState.persister = persister;
}

module.exports = {
    LogStore,
    logStore,
    attachAggregator,
    attachPersister,
    ERROR_CODES
};
