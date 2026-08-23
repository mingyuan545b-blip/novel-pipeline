const logger = require('../shared/logger');
const store = require('../store');
const { getDataContext } = require('./dataContext');

const DEFAULT_CONFIG = {
    threshold: parseInt(process.env.CB_THRESHOLD, 10) || 3,
    cooldownMs: parseInt(process.env.CB_COOLDOWN_MS, 10) || 10 * 60 * 1000,
    temperatureBoost: 0.15,
    enablePolisher: true,
    historyMax: 50,
    historyTrimTo: 30
};

const EMPTY_CB = {
    consecutiveFailures: 0,
    lastFailureStep: '',
    tripped: false,
    tripChapter: 0,
    tripTimestamp: 0,
    history: []
};

async function _migrateFromProject(projectId) {
    const _rcbCtx = await getDataContext(projectId);
    const project = await _rcbCtx.getProject();
    if (!project || !project._circuitBreaker) return null;
    const oldCb = project._circuitBreaker;
    delete project._circuitBreaker;
    await store.setItem('projects', projectId, project);
    logger.info('reviewCircuitBreaker', `[CIRCUIT-BREAKER] Migrated state from project ${projectId} to independent storage`);
    return oldCb;
}

class ReviewCircuitBreaker {
    constructor(projectId, config = {}) {
        this.projectId = projectId;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    async _getStore() {
        let cb = await store.getItem('circuit-breakers', this.projectId);
        if (cb) return cb;
        const migrated = await _migrateFromProject(this.projectId);
        if (migrated) {
            await store.setItem('circuit-breakers', this.projectId, { id: this.projectId, projectId: this.projectId, ...migrated, updatedAt: new Date().toISOString() });
            return await store.getItem('circuit-breakers', this.projectId);
        }
        // S1 修复 BUG: 原 ...EMPTY_CB 是浅拷贝，history 数组在所有实例间共享引用
        // 必须显式创建新数组，避免状态泄漏
        const fresh = { id: this.projectId, projectId: this.projectId, ...EMPTY_CB, history: [], updatedAt: new Date().toISOString() };
        await store.setItem('circuit-breakers', this.projectId, fresh);
        return fresh;
    }

    async _save(cb) {
        cb.updatedAt = new Date().toISOString();
        await store.setItem('circuit-breakers', this.projectId, cb);
    }

    async recordFailure(step, chapterNumber) {
        const cb = await this._getStore();
        if (!cb) return;
        cb.consecutiveFailures++;
        cb.lastFailureStep = step;
        if (!cb.history) cb.history = [];
        cb.history.push({ step, chapterNumber, result: 'fail', timestamp: new Date().toISOString() });
        if (cb.history.length > this.config.historyMax) cb.history = cb.history.slice(-this.config.historyTrimTo);

        if (cb.consecutiveFailures >= this.config.threshold && !cb.tripped) {
            cb.tripped = true;
            cb.tripChapter = chapterNumber;
            cb.tripTimestamp = Date.now();
            logger.info('reviewCircuitBreaker', `[CIRCUIT-BREAKER] ⚠️ TRIPPED: ${cb.consecutiveFailures} consecutive failures at step=${step} chapter=${chapterNumber}`);
        }
        await this._save(cb);
    }

    async recordSuccess(chapterNumber) {
        const cb = await this._getStore();
        if (!cb) return;
        if (!cb.history) cb.history = [];
        cb.history.push({ step: 'any', chapterNumber, result: 'pass', timestamp: new Date().toISOString() });
        if (cb.history.length > this.config.historyMax) cb.history = cb.history.slice(-this.config.historyTrimTo);

        if (cb.tripped) {
            const elapsed = Date.now() - (cb.tripTimestamp || 0);
            if (elapsed >= this.config.cooldownMs) {
                cb.tripped = false;
                cb.consecutiveFailures = 0;
                logger.info('reviewCircuitBreaker', `[CIRCUIT-BREAKER] ✅ RESET after ${Math.round(elapsed / 60000)}min cooldown`);
            }
        } else {
            cb.consecutiveFailures = 0;
        }
        await this._save(cb);
    }

    async isTripped() {
        const cb = await this._getStore();
        return cb?.tripped || false;
    }

    async getAdjustedConfig() {
        const cb = await this._getStore();
        if (!cb?.tripped) return { temperatureBoost: 0, enablePolisher: false, message: '' };

        return {
            temperatureBoost: this.config.temperatureBoost,
            enablePolisher: this.config.enablePolisher,
            message: `熔断激活: 连续${cb.consecutiveFailures}次${cb.lastFailureStep}不通过，已提升temperature+${this.config.temperatureBoost}并启用polisher`
        };
    }

    async getStats() {
        const cb = await this._getStore();
        if (!cb) return { tripped: false, consecutiveFailures: 0, history: [], config: this.config };
        const recent = cb.history.slice(-10);
        const passCount = recent.filter(h => h.result === 'pass').length;
        const failCount = recent.filter(h => h.result === 'fail').length;
        return {
            tripped: cb.tripped,
            consecutiveFailures: cb.consecutiveFailures,
            lastFailureStep: cb.lastFailureStep,
            tripChapter: cb.tripChapter,
            recentPassRate: recent.length > 0 ? (passCount / recent.length * 100).toFixed(1) + '%' : 'N/A',
            recentPassCount: passCount,
            recentFailCount: failCount,
            history: cb.history.slice(-10),
            config: this.config
        };
    }

    /**
     * 重置熔断器状态 — 清除连续失败计数和tripped状态
     * 用于章节重置时防止旧熔断状态影响新Pipeline执行
     */
    async reset() {
        // S1 修复 BUG: 同 _getStore，显式创建新 history 数组避免共享引用
        const fresh = { id: this.projectId, projectId: this.projectId, ...EMPTY_CB, history: [], updatedAt: new Date().toISOString() };
        await store.setItem('circuit-breakers', this.projectId, fresh);
        logger.info('reviewCircuitBreaker', `[CIRCUIT-BREAKER] Reset for project ${this.projectId}`);
    }
}

function getCircuitBreaker(projectId, project) {
    const projectConfig = project?.circuitBreakerConfig || {};
    return new ReviewCircuitBreaker(projectId, projectConfig);
}

module.exports = { ReviewCircuitBreaker, getCircuitBreaker, DEFAULT_CONFIG };
