/**
 * foreshadowArchiveLoader.js — 已归档伏笔加载器
 * 供需要全量伏笔状态（含已回收）的Agent使用：final-editor/first-review/second-review/fast-review
 *
 * 设计原因（修复Phase 3引新bug）：
 * 调度器默认只加载未archived素材（向后兼容），但审核员/定稿人需要看全量伏笔状态
 * 此模块通过DataContext.getArchivedForeshadows()获取archived伏笔，供调用方合并
 *
 * 数据入口：DataContext（遵守PROJECT_STANDARDS第9条）
 */
'use strict';

/**
 * 合并调度器返回的伏笔（未archived）+ DataContext查询的archived伏笔
 * @param {Array} scheduledForeshadowItems - 调度器返回的foreshadowing列表
 * @param {DataContext} ctx - DataContext实例（统一数据入口）
 * @returns {Promise<Array>} 合并后的全量伏笔列表
 */
async function mergeWithArchivedForeshadows(scheduledForeshadowItems, ctx) {
    if (!ctx || typeof ctx.getArchivedForeshadows !== 'function') {
        // 防御性编程：ctx未传或不支持委托时，只返回未archived伏笔
        return [...(scheduledForeshadowItems || [])];
    }
    try {
        const archivedItems = await ctx.getArchivedForeshadows();
        return [...(scheduledForeshadowItems || []), ...archivedItems];
    } catch (e) {
        // DataContext查询失败时返回空数组，调用方只显示未archived伏笔
        return [...(scheduledForeshadowItems || [])];
    }
}

module.exports = {
    mergeWithArchivedForeshadows,
};
