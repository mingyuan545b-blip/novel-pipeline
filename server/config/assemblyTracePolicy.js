'use strict';

/**
 * assemblyTracePolicy.js — 上下文装配实况记录策略
 *
 * 记录每章每个Agent"实际装载了什么"，用于上下文装配图展示与数据流通核查。
 * 为控制存储增长与写入开销，只记录关键Agent，并只保留最近若干章。
 */
const ASSEMBLY_TRACE_POLICY = Object.freeze({
    /** 需要记录装配实况的Agent（其余Agent不进装配图，避免O(n²)写入与噪声） */
    agents: Object.freeze(['writer', 'reviser', 'polisher', 'first-review', 'second-review', 'intent-planner']),
    /** 每项目保留的最近装配章节数（按章号滚动淘汰） */
    maxChapters: 200,
    /** 每隔多少章执行一次淘汰扫描（降低写入开销） */
    pruneEveryChapters: 10,
    /** 单条装配记录中每类素材保留的条数上限（只用于展示，不影响注入） */
    maxItemsPerType: 20,
});

module.exports = { ASSEMBLY_TRACE_POLICY };
