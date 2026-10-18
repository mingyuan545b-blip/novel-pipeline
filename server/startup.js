/**
 * startup — 服务器启动逻辑
 *
 * 模块注册、健康监控、僵尸清理
 */
const logger = require('./shared/logger');

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
        // F7 补真（docs/worklog/2026-10-17-假成果审查-问题统计.md）：
        // 原 hook 调用 worldScope.getWorldScopeForPrompt —— 该函数 git 全历史从未存在，是幻觉调用。
        // 真实可用的是 buildWorldScopePrompt(projectId, readerId, readerFaction)（worldScopeCrud 导出）。
        // readerId/readerFaction 在 writer 阶段无上下文，传 null → 仅注入 public 可见域（安全下限）。
        onWriterPrompt: async (projectId, chapterNumber, agentContext) => {
            const hint = await worldScope.buildWorldScopePrompt(projectId, null, null);
            if (hint) agentContext.content += `\n\n${hint}`;
        },
        onPostApproval: async (projectId, chapterNumber, chapterContent, config) => {
            await worldScope.extractAndSave(projectId, chapterNumber, chapterContent, config);
        },
        // 原 onReaderCheck 依赖 worldScope.detectCrossWorldViolation（be0d66c 已删除，且无数据通路可将
        // readerOutput 映射为 (writerScope, readerScope) 两参）。**宣布下线**：不再注册 reader 钩子，
        // 避免"看似存在实则 no-op"的假成果。世界域数据仍经 extractAndSave 落库，由实体中心读侧展示。
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
