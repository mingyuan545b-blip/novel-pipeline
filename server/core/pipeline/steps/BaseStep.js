/**
 * BaseStep - Pipeline步骤基类
 * 解决的核心问题：
 * 1. 步骤输出未持久化 → persist()统一保存
 * 2. 限流重试跳到下一步 → handleError()统一重试当前步骤
 * 3. 硬编码字数/重试参数 → getRetryConfig()/resolveWordConfig()从常量读取
 *
 * 子类只需实现 execute(params) → StepResult
 */
const store = require('../../../store');
const logger = require('../../../shared/logger');
const { StepResult } = require('./StepResult');
const { classifyError } = require('../errorRecovery');
const { LLM_DEFAULTS } = require('../../../config/systemConfig');
const { NOVEL_DEFAULTS } = require('../../../config/genreDefaults');

class BaseStep {
    /** @param {string} name - 步骤名称 (e.g. 'writer', 'fast-review') */
    constructor(name) {
        if (!name) throw new Error('BaseStep: name is required');
        this.name = name;
    }

    // ─── 子类必须实现 ───

    /**
     * 执行步骤的核心逻辑
     * @param {object} params - { projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput, round, modeConfig, budget }
     * @returns {Promise<StepResult>}
     */
    async execute(/* params */) {
        throw new Error(`${this.name}: execute() must be implemented by subclass`);
    }

    // ─── 基类提供的基础设施 ───

    /**
     * 持久化chapter到store
     * 解决：handler设置输出字段后不保存导致前端读取为空
     * @param {object} chapter - 修改后的chapter对象
     * @param {string} [chapterId] - 覆盖chapter.id
     */
    async persist(chapter, chapterId) {
        if (!chapter) {
            logger.warn(this.name, 'persist() called with null chapter');
            return;
        }
        const id = chapterId || chapter.id;
        if (!id) {
            logger.error(this.name, 'persist() called with chapter missing id');
            return;
        }
        chapter.updatedAt = new Date().toISOString();
        await store.setItem('chapters', id, chapter);
    }

    /**
     * 统一错误处理 - 分类错误并决定是否重试
     * 解决：限流时continue跳到下一步而非重试当前步
     * @param {Error} error
     * @returns {{ shouldRetry: boolean, isOverloaded: boolean, isTimeout: boolean, isContextErr: boolean, errorDetail: string, waitMs: number }}
     */
    classifyAndHandle(error) {
        const { isOverloaded, isContextErr, isTimeout, errorDetail } = classifyError(error, this.name);
        const shouldRetry = isOverloaded || isTimeout;
        let waitMs = 0;
        if (isOverloaded) waitMs = LLM_DEFAULTS.overloadedWaitMs;
        else if (isTimeout) waitMs = LLM_DEFAULTS.timeoutWaitMs;
        else if (isContextErr) waitMs = LLM_DEFAULTS.contextErrorCooldownMs;

        return { shouldRetry, isOverloaded, isTimeout, isContextErr, errorDetail, waitMs };
    }

    /**
     * 等待重试冷却
     * @param {number} waitMs
     */
    async waitForRetry(waitMs) {
        if (waitMs > 0) {
            logger.info(this.name, `等待${waitMs / 1000}秒后重试`);
            await new Promise(r => setTimeout(r, waitMs));
        }
    }

    /**
     * 获取重试配置
     * @returns {{ maxRetries: number, overloadedWaitMs: number, timeoutWaitMs: number }}
     */
    getRetryConfig() {
        return {
            maxRetries: LLM_DEFAULTS.consecutiveOverloadThreshold || 3,
            overloadedWaitMs: LLM_DEFAULTS.overloadedWaitMs,
            timeoutWaitMs: LLM_DEFAULTS.timeoutWaitMs
        };
    }

    /**
     * 解析字数配置 - 从项目/题材/默认值三级读取
     * @param {object} project - 项目对象
     * @param {object} [modeConfig] - 题材配置
     * @returns {{ maxChapterWords: number, rejectMinWords: number }}
     */
    resolveWordConfig(project, modeConfig) {
        const wordConfig = project?.wordConfig || {};
        return {
            maxChapterWords: wordConfig.maxWords || modeConfig?.word?.maxChapter || NOVEL_DEFAULTS.maxChapterWords,
            rejectMinWords: wordConfig.rejectMin || modeConfig?.word?.rejectMin || NOVEL_DEFAULTS.rejectMinWords
        };
    }

    /**
     * 带重试的执行包装器
     * @param {object} params - 传给execute()的参数
     * @param {number} [maxRetries] - 最大重试次数
     * @returns {Promise<StepResult>}
     */
    async runWithRetry(params, maxRetries) {
        const retryCfg = this.getRetryConfig();
        const maxAttempts = maxRetries ?? retryCfg.maxRetries;
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await this.execute(params);
                // 执行成功后自动持久化
                if (result.chapter) {
                    logger.info(this.name, `persist: contentLen=${(result.chapter.content||'').length}, wordCount=${result.chapter.wordCount}, status=${result.chapter.status}`);
                    await this.persist(result.chapter, params.chapterId);
                } else {
                    logger.warn(this.name, 'execute() returned no chapter to persist');
                }
                return result;
            } catch (error) {
                lastError = error;
                const { shouldRetry, waitMs, errorDetail } = this.classifyAndHandle(error);
                logger.warn(this.name, `第${attempt}次执行失败: ${errorDetail}`);

                if (!shouldRetry || attempt >= maxAttempts) break;
                await this.waitForRetry(waitMs);
            }
        }

        // 所有重试失败
        return StepResult.fail(this.name, {
            feedback: { summary: `${this.name}执行失败: ${lastError?.message}`, issues: [], suggestions: [] }
        });
    }
}

module.exports = { BaseStep };
