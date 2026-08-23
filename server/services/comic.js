/**
 * comic.js — 漫画模块聚合入口
 * 从3个子模块导入，保持API兼容
 */
const configModule = require('./comic/comicConfig');
const workflowModule = require('./comic/comicWorkflowManager');
const storyboardModule = require('./comic/comicStoryboardManager');

module.exports = {
    ...configModule,
    ...workflowModule,
    ...storyboardModule
};
