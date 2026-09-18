'use strict';

/**
 * subplaneUnlock.js — 小世界解封检查
 * 从 chapterExecutor.js 拆出（2026-09-18，主文件超200行限制）。
 */
const store = require('../../../store');
const logger = require('../../../shared/logger');

const UNLOCK_INTERVAL_CHAPTERS = 30;

async function tryUnlockSubplane(projectId, totalCompleted, addLog) {
    try {
        let volumeOrderConfig = null;
        try { volumeOrderConfig = await require('../volumeHelpers').getVolumeOrder(projectId); } catch (_) { /* silent */ }
        if (volumeOrderConfig?.volumeOrder) return;
        // 统一数据入口：通过 DataContext 读取（含 isLocked 的全量素材，不用 getActiveMaterials）
        const ctx = await getDataContext(projectId);
        const lockedPlanes = (await ctx.getMaterials())
            .filter((m) => m.type === 'sub-plane' && m.isLocked);
        if (lockedPlanes.length === 0 || totalCompleted <= 0) return;
        if (totalCompleted % UNLOCK_INTERVAL_CHAPTERS !== 0) return;
        const planeToUnlock = lockedPlanes[Math.floor(Math.random() * lockedPlanes.length)];
        planeToUnlock.isLocked = false;
        planeToUnlock.unlockChapter = totalCompleted;
        planeToUnlock.updatedAt = new Date().toISOString();
        await require('../../../store').setItem('materials', planeToUnlock.id, planeToUnlock);
        addLog(`🔓 小世界解封：${planeToUnlock.name}（第${totalCompleted}章完成触发）`);
    } catch (unlockErr) {
        logger.warn('infinitePipeline', 'Sub-plane unlock check failed', { unlockErrMessage: unlockErr.message });
    }
}

module.exports = { tryUnlockSubplane };
