/**
 * lazyRoute.js — Express路由延迟加载工具
 * 非关键路由首次请求时才加载，减少启动时间
 */
const path = require('path');
const logger = require('../shared/logger');

const LOADED = new Set();
// 路由模块相对于server根目录解析
const SERVER_ROOT = path.join(__dirname, '..');

/**
 * 创建延迟加载的路由中间件
 * @param {string} modulePath - 相对于server目录的路由模块路径（如'./routes/materials'）
 * @returns {Function} Express中间件
 */
function lazyRoute(modulePath) {
    let router = null;
    const resolvedPath = path.resolve(SERVER_ROOT, modulePath);
    return (req, res, next) => {
        if (!router) {
            try {
                router = require(resolvedPath);
                LOADED.add(modulePath);
                logger.info('lazyRoute', `Lazy-loaded: ${modulePath}`);
            } catch (err) {
                logger.error('lazyRoute', `Failed to load: ${modulePath}`, err.message);
                return next(err);
            }
        }
        return router(req, res, next);
    };
}

/**
 * 获取已延迟加载的路由列表
 */
function getLoadedRoutes() {
    return [...LOADED];
}

module.exports = { lazyRoute, getLoadedRoutes };
