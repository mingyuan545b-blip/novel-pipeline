'use strict';

const store = require('../../store');
const logger = require('../../shared/logger');

const FACT_TYPE = 'knowledge-facts';

const DECAY_RATES = {
    M0: 0,
    M1: 0.05,
    M2: 0.02,
    M3: 0.01
};

const LEVEL_THRESHOLDS = {
    M0: { maxAge: Infinity, minImportance: 0 },
    M1: { maxAge: 5, minImportance: 60 },
    M2: { maxAge: 15, minImportance: 30 },
    M3: { maxAge: 50, minImportance: 10 }
};

/** 旧名兼容映射（L0→M0, L1→M1, L2→M2, L3→M3） */
const LEGACY_LEVEL_MAP = { L0: 'M0', L1: 'M1', L2: 'M2', L3: 'M3' };

function normalizeLevel(level) {
    return LEGACY_LEVEL_MAP[level] || level;
}

class MemoryPyramid {
    async addFact(projectId, level, category, factText, options = {}) {
        const normalizedLevel = normalizeLevel(level);
        const id = options.id || `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const fact = {
            id,
            projectId,
            level: normalizedLevel,
            category,
            entityId: options.entityId || null,
            chapterNumber: options.chapterNumber || 0,
            factText,
            importance: options.importance || 50,
            accessCount: 0,
            lastAccessedChapter: options.chapterNumber || 0,
            decayScore: 1.0,
            expiresAtChapter: options.expiresAtChapter || null
        };

        await store.setItem(FACT_TYPE, id, fact);
        return fact;
    }

    async getFactsForChapter(projectId, chapterNumber, options = {}) {
        const all = await store.queryItems(FACT_TYPE, { projectId });
        const normalizedFilterLevel = options.level ? normalizeLevel(options.level) : null;
        const filtered = all.filter(f => {
            if (normalizedFilterLevel && normalizeLevel(f.level) !== normalizedFilterLevel) return false;
            if (options.category && f.category !== options.category) return false;
            if (f.expiresAtChapter && chapterNumber > f.expiresAtChapter) return false;
            return true;
        });

        for (const f of filtered) {
            f.decayScore = this._computeDecay(f, chapterNumber);
            f.lastAccessedChapter = chapterNumber;
            f.accessCount = (f.accessCount || 0) + 1;
        }

        const levelOrder = { M0: 0, M1: 1, M2: 2, M3: 3, L0: 0, L1: 1, L2: 2, L3: 3 };
        filtered.sort((a, b) => {
            const oa = levelOrder[a.level] ?? 3;
            const ob = levelOrder[b.level] ?? 3;
            if (oa !== ob) return oa - ob;
            return (b.decayScore || 0) - (a.decayScore || 0);
        });

        return filtered;
    }

    async getFactsForPrompt(projectId, chapterNumber, tokenBudget = 2000) {
        const facts = await this.getFactsForChapter(projectId, chapterNumber);
        const result = [];
        let budgetUsed = 0;

        for (const f of facts) {
            const tokens = Math.ceil(f.factText.length / 2);
            if (budgetUsed + tokens <= tokenBudget) {
                result.push(f);
                budgetUsed += tokens;
            }
        }

        return result;
    }

    async promoteFact(factId, newLevel) {
        const fact = await store.getItem(FACT_TYPE, factId);
        if (!fact) return null;
        fact.level = normalizeLevel(newLevel);
        fact.decayScore = 1.0;
        await store.setItem(FACT_TYPE, factId, fact);
        return fact;
    }

    async runDecayCycle(projectId, currentChapter) {
        const all = await store.queryItems(FACT_TYPE, { projectId });
        let demoted = 0;

        for (const f of all) {
            const nLevel = normalizeLevel(f.level);
            if (nLevel === 'M0') continue;

            const age = currentChapter - (f.chapterNumber || 0);
            const threshold = LEVEL_THRESHOLDS[nLevel];
            if (!threshold) continue;

            if (age > threshold.maxAge && f.importance < threshold.minImportance) {
                const newLevel = nLevel === 'M1' ? 'M2' : nLevel === 'M2' ? 'M3' : null;
                if (newLevel) {
                    f.level = newLevel;
                    f.decayScore = this._computeDecay(f, currentChapter);
                    await store.setItem(FACT_TYPE, f.id, f);
                    demoted++;
                }
            }
        }

        logger.info('memoryPyramid', `Decay cycle: ${demoted} facts demoted for project ${projectId} at ch${currentChapter}`);
        return { demoted };
    }

    _computeDecay(fact, currentChapter) {
        const rate = DECAY_RATES[normalizeLevel(fact.level)] || 0;
        if (rate === 0) return 1.0;
        const age = currentChapter - (fact.chapterNumber || 0);
        return Math.max(0, 1.0 - age * rate);
    }
}

module.exports = MemoryPyramid;
module.exports.normalizeLevel = normalizeLevel;
module.exports.LEGACY_LEVEL_MAP = LEGACY_LEVEL_MAP;
module.exports.MEMORY_LEVELS = { M0: 'M0', M1: 'M1', M2: 'M2', M3: 'M3' };
