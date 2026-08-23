const store = require('../store');
const { v4: uuidv4 } = require('uuid');
const { CONSTRAINT_DEFAULTS } = require('../config/systemConfig');

const STORE_TYPE = 'consistency-constraints';

async function addConstraint(projectId, { type, description, constraint, sourceChapter, evidence, activeUntil }) {
    const id = `cc_${uuidv4().substring(0, 8)}`;
    const defaultActiveUntil = sourceChapter + CONSTRAINT_DEFAULTS.DEFAULT_LIFESPAN_CHAPTERS;
    const entry = {
        id,
        projectId,
        type,
        description,
        constraint,
        sourceChapter,
        evidence: evidence || '',
        activeFrom: sourceChapter + 1,
        activeUntil: activeUntil != null ? activeUntil : defaultActiveUntil,
        resolved: false,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString()
    };
    await store.setItem(STORE_TYPE, id, entry);
    return entry;
}

async function getActiveConstraints(projectId, currentChapter) {
    const all = await store.queryItems(STORE_TYPE, { projectId });
    return all
        .filter(c => {
            if (c.resolved) return false;
            const effectiveUntil = _resolveActiveUntil(c);
            if (effectiveUntil < currentChapter) return false;
            return c.activeFrom <= currentChapter;
        })
        .sort((a, b) => a.sourceChapter - b.sourceChapter)
        .slice(0, CONSTRAINT_DEFAULTS.MAX_ACTIVE_CONSTRAINTS);
}

async function getAllConstraints(projectId) {
    const all = await store.queryItems(STORE_TYPE, { projectId });
    return all.sort((a, b) => (a.sourceChapter || 0) - (b.sourceChapter || 0));
}

async function resolveConstraint(constraintId, resolvedBy) {
    const entry = await store.getItem(STORE_TYPE, constraintId);
    if (!entry) return null;
    entry.resolved = true;
    entry.resolvedAt = new Date().toISOString();
    entry.resolvedBy = resolvedBy || 'auto';
    await store.setItem(STORE_TYPE, constraintId, entry);
    return entry;
}

async function autoResolveConstraints(projectId, chapterNumber) {
    const all = await store.queryItems(STORE_TYPE, { projectId });
    let resolvedCount = 0;
    for (const c of all) {
        if (c.resolved) continue;
        const effectiveUntil = _resolveActiveUntil(c);
        if (effectiveUntil < chapterNumber) {
            await resolveConstraint(c.id, 'auto-expired');
            resolvedCount++;
        }
    }
    return resolvedCount;
}

function _resolveActiveUntil(constraint) {
    if (constraint.activeUntil != null) return constraint.activeUntil;
    if (CONSTRAINT_DEFAULTS.AUTO_RESOLVE_LEGACY_NULL) {
        return (constraint.sourceChapter || 0) + CONSTRAINT_DEFAULTS.DEFAULT_LIFESPAN_CHAPTERS;
    }
    return Infinity;
}

function formatConstraintsForPrompt(constraints) {
    if (!constraints || constraints.length === 0) return '';
    const lines = constraints.map((c, i) => {
        const source = `[第${c.sourceChapter}章reader发现]`;
        const until = c.activeUntil != null ? ` (有效至第${c.activeUntil}章)` : '';
        return `${i + 1}. ${source}${until} ${c.constraint}`;
    });
    return `【一致性约束——必须遵守】\n以下约束来自阅读者发现的跨章节硬伤，后续写作中必须遵守：\n${lines.join('\n')}`;
}

module.exports = {
    addConstraint,
    getActiveConstraints,
    getAllConstraints,
    resolveConstraint,
    autoResolveConstraints,
    formatConstraintsForPrompt,
    STORE_TYPE
};
