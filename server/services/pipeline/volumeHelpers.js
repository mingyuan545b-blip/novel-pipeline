/**
 * volumeHelpers.js — 卷小世界辅助（async版）
 * 所有store调用必须await，PG后端下store.queryItems/getItem返回Promise
 */
const fs = require('fs');
const path = require('path');
const store = require('../../store');
const logger = require('../../shared/logger');

let _volumeOrderCache = {};

async function getVolumeOrder(projectId) {
    const project = projectId ? await store.getItem('projects', projectId) : null;
    const genre = project?.genre || project?.styleProfile?.key || '';
    const cacheKey = genre || 'default';
    if (_volumeOrderCache[cacheKey]) return _volumeOrderCache[cacheKey];
    try {
        const genreFileMap = {
            'causal-eye-strategy': 'volume-order-causal-eye.json',
            'strategy-crossplane': 'volume-order-strategy.json',
            'witty-strategy': 'volume-order-witty-strategy.json',
        };
        const fileName = genreFileMap[genre] || 'volume-order.json';
        const orderPath = path.join(__dirname, '..', '..', '..', 'data', 'subplanes', fileName);
        _volumeOrderCache[cacheKey] = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
        return _volumeOrderCache[cacheKey];
    } catch (e) {
        try {
            const fallbackPath = path.join(__dirname, '..', '..', '..', 'data', 'subplanes', 'volume-order.json');
            _volumeOrderCache[cacheKey] = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
            return _volumeOrderCache[cacheKey];
        } catch (e2) {
            logger.warn('volumeHelpers', 'volume-order.json not found, using dynamic logic');
            return null;
        }
    }
}

async function getVolumeSubplane(projectId, chapterNumber) {
    const volume = Math.floor((chapterNumber - 1) / 30) + 1;
    const order = await getVolumeOrder(projectId);
    if (order && order.volumeOrder) {
        const entry = order.volumeOrder.find(v => v.volume === volume);
        if (entry) return entry;
    }
    const subplaneMaterials = await store.queryItems('materials', { projectId, type: 'sub-plane' });
    const unlocked = subplaneMaterials.filter(m => !m.isLocked);
    if (unlocked.length > 0) return { subplaneId: unlocked[0].id, subplaneName: unlocked[0].name, volume };
    return null;
}

async function getVisibleMaterials(projectId, targetChapterOrVolume, options = {}) {
    const { includeLocked = false, purpose = 'outline' } = options;
    const allMaterials = await store.queryItems('materials', { projectId });
    const materials = allMaterials.filter(m => !m.archived);
    const subplaneMats = materials.filter(m => m.type === 'sub-plane');

    const project = await store.getItem('projects', projectId);
    const protagonistName = project?.styleProfile?.protagonistName || '';

    let targetVolume;
    let chapterNumber;
    if (typeof targetChapterOrVolume === 'object' && targetChapterOrVolume.volume) {
        targetVolume = targetChapterOrVolume.volume;
        chapterNumber = (targetVolume - 1) * 30 + 1;
    } else {
        chapterNumber = targetChapterOrVolume;
        targetVolume = Math.floor((chapterNumber - 1) / 30) + 1;
    }

    const volumeEntry = await getVolumeSubplane(projectId, chapterNumber);
    const currentVolSubplane = volumeEntry
        ? subplaneMats.find(m => m.id === volumeEntry.subplaneId || m.name === volumeEntry.subplaneName)
        : subplaneMats.find(m => !m.isLocked);

    const currentVolSubplaneId = currentVolSubplane?.id;
    const currentVolSubplaneName = currentVolSubplane?.name;
    const currentVolSubplaneShortName = currentVolSubplaneName?.replace(/^小世界[···]+/, '');

    const allowedParentPlanes = new Set(['主世界', '', null, undefined]);
    if (currentVolSubplaneId) allowedParentPlanes.add(currentVolSubplaneId);
    if (currentVolSubplaneName) allowedParentPlanes.add(currentVolSubplaneName);
    if (currentVolSubplaneShortName) allowedParentPlanes.add(currentVolSubplaneShortName);

    const allowedCurrentPlanes = new Set();
    if (currentVolSubplaneId) allowedCurrentPlanes.add(currentVolSubplaneId);

    const filtered = materials.filter(m => {
        if (m.type === 'sub-plane') {
            return currentVolSubplane && (m.id === currentVolSubplane.id || m.id === currentVolSubplaneId);
        }
        if (m.type === 'character' || m.type === 'faction' || m.type === 'institution') {
            if (!m.parentPlane) return true;
            if (protagonistName && m.name === protagonistName) return true;
            if (m.currentPlaneId && allowedCurrentPlanes.has(m.currentPlaneId)) return true;
            if (allowedParentPlanes.has(m.parentPlane)) return true;
            const parentSub = subplaneMats.find(sp =>
                sp.id === m.parentPlane || sp.name === m.parentPlane ||
                sp.name.replace(/^小世界[···]+/, '') === m.parentPlane
            );
            if (parentSub && (parentSub.id === currentVolSubplaneId || parentSub.name === currentVolSubplaneName)) return true;
            return false;
        }
        if (m.type === 'equipment' || m.type === 'rule' || m.type === 'mechanism' || m.type === 'power-system' || m.type === 'geography' || m.type === 'technology' || m.type === 'phenomenon' || m.type === 'location') {
            if (!m.parentPlane) return true;
            if (allowedParentPlanes.has(m.parentPlane)) return true;
            const parentSub = subplaneMats.find(sp =>
                sp.id === m.parentPlane || sp.name === m.parentPlane ||
                sp.name.replace(/^小世界[···]+/, '') === m.parentPlane
            );
            if (parentSub && (parentSub.id === currentVolSubplaneId || parentSub.name === currentVolSubplaneName)) return true;
            return false;
        }
        return true;
    });

    const lockedSubplaneNames = subplaneMats
        .filter(m => m.isLocked && m.id !== currentVolSubplaneId)
        .map(m => ({ full: m.name, short: m.name.replace(/^小世界[···]+/, '') }));

    return {
        materials: filtered,
        currentVolSubplane,
        currentVolume: targetVolume,
        lockedSubplaneNames,
        allowedParentPlanes,
        debug: {
            totalMaterials: materials.length,
            filteredMaterials: filtered.length,
            removedMaterials: materials.length - filtered.length,
            currentVolSubplaneId,
            currentVolSubplaneName,
            subplaneCount: subplaneMats.length,
            unlockedSubplanes: subplaneMats.filter(m => !m.isLocked).map(m => m.name),
            lockedSubplanes: subplaneMats.filter(m => m.isLocked).map(m => m.name),
        }
    };
}

async function enforceVolumeSubplaneLocks(projectId, targetChapter) {
    const targetVolume = Math.floor((targetChapter - 1) / 30) + 1;
    const entry = await getVolumeSubplane(projectId, targetChapter);
    if (!entry) return;
    const subplaneMaterials = await store.queryItems('materials', { projectId, type: 'sub-plane' });
    for (const m of subplaneMaterials) {
        const shouldBeUnlocked = m.id === entry.subplaneId || m.name === entry.subplaneName;
        if (m.isLocked === shouldBeUnlocked) {
            await store.setItem('materials', m.id, { ...m, isLocked: !shouldBeUnlocked });
            logger.info('volumeHelpers', `${shouldBeUnlocked ? '解锁' : '锁定'}小世界: ${m.name}`);
        }
    }
}

module.exports = {
    getVolumeOrder,
    getVolumeSubplane,
    getVisibleMaterials,
    enforceVolumeSubplaneLocks
};
