const store = require('../store');

const CIRCUIT_BREAKER_THRESHOLD = 3;
const COOLDOWN_MS = 10 * 60 * 1000;

const EMPTY_CB = {
    consecutiveFailures: 0,
    lastFailureStep: '',
    tripped: false,
    tripChapter: 0,
    tripTimestamp: 0,
    history: []
};

function _migrateFromProject(projectId) {
    const project = store.getItem('projects', projectId);
    if (!project || !project._circuitBreaker) return null;
    const oldCb = project._circuitBreaker;
    delete project._circuitBreaker;
    store.setItem('projects', projectId, project);
    console.log(`[CIRCUIT-BREAKER] Migrated state from project ${projectId} to independent storage`);
    return oldCb;
}

class ReviewCircuitBreaker {
    constructor(projectId) {
        this.projectId = projectId;
    }

    _getStore() {
        let cb = store.getItem('circuit-breakers', this.projectId);
        if (cb) return cb;
        const migrated = _migrateFromProject(this.projectId);
        if (migrated) {
            store.setItem('circuit-breakers', this.projectId, { id: this.projectId, projectId: this.projectId, ...migrated, updatedAt: new Date().toISOString() });
            return store.getItem('circuit-breakers', this.projectId);
        }
        const fresh = { id: this.projectId, projectId: this.projectId, ...EMPTY_CB, updatedAt: new Date().toISOString() };
        store.setItem('circuit-breakers', this.projectId, fresh);
        return fresh;
    }

    async _save(cb) {
        cb.updatedAt = new Date().toISOString();
        await store.setItem('circuit-breakers', this.projectId, cb);
    }

    async recordFailure(step, chapterNumber) {
        const cb = this._getStore();
        if (!cb) return;
        cb.consecutiveFailures++;
        cb.lastFailureStep = step;
        if (!cb.history) cb.history = [];
        cb.history.push({ step, chapterNumber, result: 'fail', timestamp: new Date().toISOString() });
        if (cb.history.length > 50) cb.history = cb.history.slice(-30);

        if (cb.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && !cb.tripped) {
            cb.tripped = true;
            cb.tripChapter = chapterNumber;
            cb.tripTimestamp = Date.now();
            console.log(`[CIRCUIT-BREAKER] ⚠️ TRIPPED: ${cb.consecutiveFailures} consecutive failures at step=${step} chapter=${chapterNumber}`);
        }
        await this._save(cb);
    }

    async recordSuccess(chapterNumber) {
        const cb = this._getStore();
        if (!cb) return;
        if (!cb.history) cb.history = [];
        cb.history.push({ step: 'any', chapterNumber, result: 'pass', timestamp: new Date().toISOString() });
        if (cb.history.length > 50) cb.history = cb.history.slice(-30);

        if (cb.tripped) {
            const elapsed = Date.now() - (cb.tripTimestamp || 0);
            if (elapsed >= COOLDOWN_MS) {
                cb.tripped = false;
                cb.consecutiveFailures = 0;
                console.log(`[CIRCUIT-BREAKER] ✅ RESET after ${Math.round(elapsed / 60000)}min cooldown`);
            }
        } else {
            cb.consecutiveFailures = 0;
        }
        await this._save(cb);
    }

    isTripped() {
        const cb = this._getStore();
        return cb?.tripped || false;
    }

    getAdjustedConfig() {
        const cb = this._getStore();
        if (!cb?.tripped) return { temperatureBoost: 0, enablePolisher: false, message: '' };

        return {
            temperatureBoost: 0.15,
            enablePolisher: true,
            message: `熔断激活: 连续${cb.consecutiveFailures}次${cb.lastFailureStep}不通过，已提升temperature+0.15并启用polisher`
        };
    }

    getStats() {
        const cb = this._getStore();
        if (!cb) return { tripped: false, consecutiveFailures: 0, history: [] };
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
            history: cb.history.slice(-10)
        };
    }
}

function getCircuitBreaker(projectId) {
    return new ReviewCircuitBreaker(projectId);
}

module.exports = { ReviewCircuitBreaker, getCircuitBreaker, CIRCUIT_BREAKER_THRESHOLD };
