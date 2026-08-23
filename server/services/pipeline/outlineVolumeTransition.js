const store = require('../../store');
const logger = require('../../shared/logger');
const { getVolumeOrder } = require('./volumeHelpers');

async function handleVolumeTransition(projectId, existingCount, supplementCount) {
    const currentVolume = Math.floor(existingCount / 30) + 1;
    const chapterInVolume = existingCount % 30;
    const isVolumeComplete = chapterInVolume === 0 && existingCount > 0;

    let volumeOrderConfig = null;
    try { volumeOrderConfig = await getVolumeOrder(projectId); } catch (_) { /* silent */ }

    const allSubplaneMats = (await store.queryItems('materials', { projectId, type: 'sub-plane' })).filter(m => !m.archived);

    if (isVolumeComplete && volumeOrderConfig?.volumeOrder) {
        await lockPreviousVolumeSubplane(projectId, currentVolume - 1, volumeOrderConfig, allSubplaneMats);
        await unlockCurrentVolumeSubplane(projectId, currentVolume, volumeOrderConfig, allSubplaneMats);
    }

    let adjustedCount = supplementCount;
    if (isVolumeComplete) {
        adjustedCount = 30;
        logger.info('outlineSupplementer', '[PIPELINE] 第{v1}卷已完成，自动补充第{currentVolume}卷30章大纲', { v1: currentVolume - 1, currentVolume });
    } else if (chapterInVolume > 0) {
        const remainingInVolume = 30 - chapterInVolume;
        if (adjustedCount > remainingInVolume) adjustedCount = remainingInVolume;
    }

    return { currentVolume, chapterInVolume, isVolumeComplete, adjustedCount };
}

async function lockPreviousVolumeSubplane(projectId, previousVolume, volumeOrderConfig, allSubplaneMats) {
    const prevVolEntry = volumeOrderConfig.volumeOrder.find(v => v.volume === previousVolume);
    if (!prevVolEntry) return;
    const prevSub = allSubplaneMats.find(m => m.id === prevVolEntry.subplaneId || m.name === prevVolEntry.subplaneName);
    if (prevSub && !prevSub.isLocked) {
        prevSub.isLocked = true;
        prevSub.updatedAt = new Date().toISOString();
        await store.setItem('materials', prevSub.id, prevSub);
        logger.info('outlineSupplementer', '[PIPELINE] 自动锁定上一卷(第{previousVolume}卷)小世界: {prevSubName}', { previousVolume, prevSubName: prevSub.name });
    }
}

async function unlockCurrentVolumeSubplane(projectId, currentVolume, volumeOrderConfig, allSubplaneMats) {
    const nextVolEntry = volumeOrderConfig.volumeOrder.find(v => v.volume === currentVolume);
    if (!nextVolEntry) return;

    const targetSub = allSubplaneMats.find(m => m.id === nextVolEntry.subplaneId || m.name === nextVolEntry.subplaneName);
    if (targetSub) {
        if (targetSub.isLocked) {
            targetSub.isLocked = false;
            targetSub.updatedAt = new Date().toISOString();
            await store.setItem('materials', targetSub.id, targetSub);
            logger.info('outlineSupplementer', '[PIPELINE] 自动解锁第{currentVolume}卷小世界: {targetSubName}', { currentVolume, targetSubName: targetSub.name });
        }
    } else {
        const newSub = {
            id: nextVolEntry.subplaneId, projectId, type: 'sub-plane',
            name: nextVolEntry.subplaneName,
            description: `${nextVolEntry.type}类小世界`,
            initialContent: `【位面名】${nextVolEntry.subplaneName}\n【类型】${nextVolEntry.type}\n【核心规则】待探索\n【视觉特征】待探索`,
            currentContent: `【位面名】${nextVolEntry.subplaneName}\n【类型】${nextVolEntry.type}\n【核心规则】待探索\n【视觉特征】待探索`,
            isLocked: false, parentPlane: '主世界',
            tags: ['sub-plane', nextVolEntry.type], version: 1,
            changeLog: [{ action: 'auto-created', reason: `第${currentVolume}卷自动创建`, at: new Date().toISOString() }],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await store.setItem('materials', newSub.id, newSub);
    }

    for (const sub of allSubplaneMats) {
        if (sub.id === nextVolEntry.subplaneId) continue;
        if (!sub.isLocked) {
            sub.isLocked = true;
            sub.updatedAt = new Date().toISOString();
            await store.setItem('materials', sub.id, sub);
        }
    }
}

module.exports = { handleVolumeTransition };
