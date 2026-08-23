/**
 * API服务层 - 聚合导出入口
 *
 * 所有API模块已按领域拆分到 services/api/ 目录下：
 * - httpClient.js    — axios实例 + 请求取消管理
 * - authInterceptor.js — 认证拦截器 + token刷新
 * - projectApi.js    — 项目相关API
 * - chapterApi.js    — 章节相关API
 * - pipelineApi.js   — 流水线相关API
 * - materialApi.js   — 素材相关API
 * - publishApi.js    — 发布相关API
 * - comicApi.js      — 漫画相关API
 * - otherApi.js      — 其他API
 * - index.js         — 聚合导出
 *
 * 对外接口完全保持不变，所有命名导出和默认导出均可正常使用
 */
export * from './api/index.js';
export { default } from './api/index.js';
