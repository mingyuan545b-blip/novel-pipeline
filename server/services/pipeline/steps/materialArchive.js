/**
 * materialArchive.js — 素材自动归档逻辑（从materialLifecycle.js拆出）
 * 包含autoArchiveStaleMaterials和autoArchiveForExpansion
 */
const store = require('../../../store');
const logger = require('../../../shared/logger');
const { getMaterialLifecycle } = require('./materialLifecycle');

function autoArchiveStaleMaterials(activeMaterials, chapterNum, currentVolumeSubplaneId, options = {}) {
    const STALE_THRESHOLD_EPHEMERAL = options.staleThresholdEphemeral || 15;
    const STALE_THRESHOLD_SEMI = options.staleThresholdSemi || 30;
    const archived = [];

    const stale = activeMaterials.filter(m => {
        const lifecycle = getMaterialLifecycle(m);
        if (lifecycle === 'permanent') return false;
        if (m.isLocked) return false;
        if (m.name && m.name.includes('主角')) return false;
        const lastUpdated = m.sourceChapter || 0;
        const age = chapterNum - lastUpdated;
        if (lifecycle === 'semiPermanent') {
            if (m.parentPlane === currentVolumeSubplaneId) return false;
            return age > STALE_THRESHOLD_SEMI;
        }
        return age > STALE_THRESHOLD_EPHEMERAL;
    });

    for (const mat of stale) {
        const lifecycle = getMaterialLifecycle(mat);
        store.setItem('materials', mat.id, {
            ...mat,
            archived: true,
            archivedReason: `素材过期自动归档（${lifecycle}级，${mat.sourceChapter ? 'Ch' + mat.sourceChapter : '项目级'}→Ch${chapterNum}）`,
            archivedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        logger.info('materialArchive', `Auto-archived stale ${lifecycle} material: ${mat.name}`);
        archived.push(mat);
    }

    return archived;
}

function autoArchiveForExpansion(activeMaterials, dynamicMaxMaterials) {
    const archived = [];

    if (activeMaterials.length <= dynamicMaxMaterials) return archived;

    const excess = activeMaterials.length - dynamicMaxMaterials;
    const candidates = [...activeMaterials]
        .filter(m => getMaterialLifecycle(m) === 'ephemeral')
        .sort((a, b) => (a.sourceChapter || 0) - (b.sourceChapter || 0));
    const toArchive = candidates.slice(0, excess);

    for (const mat of toArchive) {
        store.setItem('materials', mat.id, {
            ...mat,
            archived: true,
            archivedReason: `素材库膨胀自动归档（活跃${activeMaterials.length}>上限${dynamicMaxMaterials}，仅归档临时素材）`,
            archivedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        logger.info('materialArchive', `Auto-archived ephemeral material: ${mat.name}`);
        archived.push(mat);
    }

    return archived;
}

module.exports = { autoArchiveStaleMaterials, autoArchiveForExpansion };
