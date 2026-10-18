/**
 * PipelineModuleRegistry — Pipeline可插拔模块注册表
 *
 * 设计原则：
 * 1. 模块可开关，关闭时零开销（无LLM调用、无store写入）
 * 2. 开关存储在project.settings中，项目级别控制
 * 3. 所有钩子try-catch包裹，模块报错不影响主流程
 * 4. 新模块只需registerModule()即可接入，无需修改Pipeline核心代码
 *
 * 已注册模块：
 * - chronicle: 角色编年史（立场/语录/事迹追踪）
 */
const store = require('../store');
const logger = require('../shared/logger');

const MODULE_CONFIG_KEY = 'pipelineModules';

const _modules = new Map();

/**
 * 注册模块
 * @param {string} moduleId - 模块唯一ID (e.g. 'chronicle')
 * @param {object} hooks - 模块钩子集合
 * @param {Function} [hooks.onWriterPrompt] - (projectId, chapterNumber, agentContext) => void
 * @param {Function} [hooks.onPostApproval] - (projectId, chapterNumber, chapterContent) => void
 * @param {Function} [hooks.onReaderCheck] - (projectId, chapterNumber, readerOutput) => void
 * @param {string} configKey - project.settings中的开关字段名
 * @param {string} offValue - 关闭时的值
 */
function registerModule(moduleId, hooks, configKey, offValue = 'off') {
    if (_modules.has(moduleId)) {
        logger.warn('moduleRegistry', `Module "${moduleId}" already registered, overwriting`);
    }
    _modules.set(moduleId, { id: moduleId, hooks: hooks || {}, configKey, offValue });
    logger.info('moduleRegistry', `Registered module: ${moduleId} (configKey=${configKey}, offValue=${offValue})`);
}

/**
 * 获取模块在当前项目中的配置值
 * @param {string} projectId
 * @param {string} moduleId
 * @returns {Promise<string>} 模块配置值 (e.g. 'off', 'basic', 'full')
 */
async function getModuleConfig(projectId, moduleId) {
    const mod = _modules.get(moduleId);
    if (!mod) return mod?.offValue || 'off';
    try {
        const project = await store.getItem('projects', projectId);
        const settings = project?.settings || {};
        return settings[mod.configKey] || mod.offValue;
    } catch (err) {
        logger.warn('moduleRegistry', `Failed to read config for ${moduleId}: ${err.message}`);
        return mod.offValue;
    }
}

/**
 * 检查模块是否启用
 * @param {string} projectId
 * @param {string} moduleId
 * @returns {Promise<boolean>}
 */
async function isModuleEnabled(projectId, moduleId) {
    const config = await getModuleConfig(projectId, moduleId);
    const mod = _modules.get(moduleId);
    return config !== (mod?.offValue || 'off');
}

/**
 * 调度onWriterPrompt钩子
 * @param {string} projectId
 * @param {number} chapterNumber
 * @param {object} agentContext - writer的agentContext对象
 */
async function onWriterPrompt(projectId, chapterNumber, agentContext) {
    for (const [moduleId, mod] of _modules) {
        if (!mod.hooks.onWriterPrompt) continue;
        try {
            const enabled = await isModuleEnabled(projectId, moduleId);
            if (!enabled) continue;
            const config = await getModuleConfig(projectId, moduleId);
            await mod.hooks.onWriterPrompt(projectId, chapterNumber, agentContext, config);
        } catch (err) {
            logger.warn('moduleRegistry', `onWriterPrompt hook failed for ${moduleId}: ${err.message}`);
        }
    }
}

/**
 * 调度onPostApproval钩子（章节审核通过后）
 * @param {string} projectId
 * @param {number} chapterNumber
 * @param {string} chapterContent
 */
async function onPostApproval(projectId, chapterNumber, chapterContent) {
    for (const [moduleId, mod] of _modules) {
        if (!mod.hooks.onPostApproval) continue;
        try {
            const enabled = await isModuleEnabled(projectId, moduleId);
            if (!enabled) continue;
            const config = await getModuleConfig(projectId, moduleId);
            await mod.hooks.onPostApproval(projectId, chapterNumber, chapterContent, config);
        } catch (err) {
            logger.warn('moduleRegistry', `onPostApproval hook failed for ${moduleId}: ${err.message}`);
        }
    }
}

/**
 * 调度onReaderCheck钩子
 * @param {string} projectId
 * @param {number} chapterNumber
 * @param {string} readerOutput
 */
async function onReaderCheck(projectId, chapterNumber, readerOutput) {
    for (const [moduleId, mod] of _modules) {
        if (!mod.hooks.onReaderCheck) continue;
        try {
            const enabled = await isModuleEnabled(projectId, moduleId);
            if (!enabled) continue;
            const config = await getModuleConfig(projectId, moduleId);
            await mod.hooks.onReaderCheck(projectId, chapterNumber, readerOutput, config);
        } catch (err) {
            logger.warn('moduleRegistry', `onReaderCheck hook failed for ${moduleId}: ${err.message}`);
        }
    }
}

/**
 * 获取所有已注册模块的ID
 * @returns {string[]}
 */
function getRegisteredModules() {
    return [..._modules.keys()];
}

/**
 * 获取所有已注册模块的元数据（只读副本）。
 * 供门禁脚本使用：校验 offValue 语义、configKey 是否进入项目创建默认值。
 * 背景见 docs/worklog/2026-10-17-假成果审查-问题统计.md F2（offValue 写反致模块永久禁用）。
 * @returns {Array<{id: string, configKey: string, offValue: string}>}
 */
function getRegisteredModuleMeta() {
    return [..._modules.values()].map(m => ({ id: m.id, configKey: m.configKey, offValue: m.offValue }));
}

module.exports = {
    registerModule,
    getModuleConfig,
    isModuleEnabled,
    onWriterPrompt,
    onPostApproval,
    onReaderCheck,
    getRegisteredModules,
    getRegisteredModuleMeta
};
