/**
 * startup — 服务器启动逻辑
 *
 * 模块注册、健康监控、僵尸清理
 */
const logger = require('shared/logger');

function registerModules() {
    const { registerModule } = require('./services/pipelineModuleRegistry');

    const chronicle = require('./services/characterChronicle');
    registerModule('chronicle', {
        onWriterPrompt: async (projectId, chapterNumber, agentContext, config) => {
            const hint = await chronicle.getRecentChronicleForPrompt(projectId, chapterNumber, config);
            if (hint) agentContext.content += `\n\n${hint}`;
        },
        onPostApproval: async (projectId, chapterNumber, chapterContent, config) => {
            await chronicle.extractAndSave(projectId, chapterNumber, chapterContent, config);
        },
        onReaderCheck: async (projectId, chapterNumber, readerOutput, config) => {
            await chronicle.detectStanceShift(projectId, chapterNumber, readerOutput);
        }
    }, 'chronicleLevel', 'off');

    const worldScope = require('./services/worldScopeModule');
    registerModule('worldScope', {
        onWriterPrompt: async (projectId, chapterNumber, agentContext, config) => {
            const hint = await worldScope.getWorldScopeForPrompt(projectId, chapterNumber, config);
            if (hint) agentContext.content += `\n\n${hint}`;
        },
        onPostApproval: async (projectId, chapterNumber, chapterContent, config) => {
            await worldScope.extractAndSave(projectId, chapterNumber, chapterContent, config);
        },
        onReaderCheck: async (projectId, chapterNumber, readerOutput, config) => {
            if (config === 'full') {
                await worldScope.detectCrossWorldViolation(projectId, chapterNumber, readerOutput);
            }
        }
    }, 'worldScopeLevel', 'off');

    // 陷阱#42-#44: 约束反馈模块——在章节通过后自动收集约束执行情况，形成反馈闭环
    // 详见 SOP: docs/sop/08-约束执行规范.md 第三节
    const constraintFeedback = require('./services/pipeline/modules/constraintFeedbackModule');
    constraintFeedback.registerConstraintFeedbackModule();

    logger.info('startup', '[NOVEL-PIPELINE] Pipeline modules registered: chronicle, worldScope, constraint-feedback');
}

function startHealthMonitor() {
    const healthMonitor = require('./services/healthMonitor');
    healthMonitor.startHealthMonitor();
}

async function cleanupZombiePipelines() {
    try {
        const { cleanupStalePipelineStates } = require('./services/pipeline/infinitePipeline');
        const zombieCount = await cleanupStalePipelineStates();
        if (zombieCount > 0) logger.info('startup', `[NOVEL-PIPELINE] 🧹 Cleaned up ${zombieCount} zombie pipeline state(s) from previous crash`);
    } catch (e) {
        logger.warn('startup', '[NOVEL-PIPELINE] Zombie pipeline cleanup check failed:', e.message);
    }
}

module.exports = { registerModules, startHealthMonitor, cleanupZombiePipelines };
