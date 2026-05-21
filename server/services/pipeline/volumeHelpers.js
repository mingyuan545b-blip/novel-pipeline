const fs = require('fs');
const path = require('path');
const store = require('../../store');

let _volumeOrderCache = {};

function getVolumeOrder(projectId) {
    const project = projectId ? store.getItem('projects', projectId) : null;
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
            console.warn('[PIPELINE] volume-order.json not found, using dynamic logic');
            return null;
        }
    }
}

function getVolumeSubplane(projectId, chapterNumber) {
    const volume = Math.floor((chapterNumber - 1) / 30) + 1;
    const order = getVolumeOrder(projectId);
    if (order && order.volumeOrder) {
        const entry = order.volumeOrder.find(v => v.volume === volume);
        if (entry) return entry;
    }
    const subplaneMaterials = store.queryItems('materials', { projectId, type: 'sub-plane' });
    const unlocked = subplaneMaterials.filter(m => !m.isLocked);
    if (unlocked.length > 0) return { subplaneId: unlocked[0].id, subplaneName: unlocked[0].name, volume };
    return null;
}

function getVisibleMaterials(projectId, targetChapterOrVolume, options = {}) {
    const { includeLocked = false, purpose = 'outline' } = options;
    const allMaterials = store.queryItems('materials', { projectId });
    const materials = allMaterials.filter(m => !m.archived);
    const subplaneMats = materials.filter(m => m.type === 'sub-plane');

    const project = store.getItem('projects', projectId);
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

    const volumeEntry = getVolumeSubplane(projectId, chapterNumber);
    const currentVolSubplane = volumeEntry
        ? subplaneMats.find(m => m.id === volumeEntry.subplaneId || m.name === volumeEntry.subplaneName)
        : subplaneMats.find(m => !m.isLocked);

    const currentVolSubplaneId = currentVolSubplane?.id;
    const currentVolSubplaneName = currentVolSubplane?.name;
    const currentVolSubplaneShortName = currentVolSubplaneName?.replace(/^次位面[···]+/, '');

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
                sp.name.replace(/^次位面[···]+/, '') === m.parentPlane
            );
            if (parentSub && (parentSub.id === currentVolSubplaneId || parentSub.name === currentVolSubplaneName)) return true;
            return false;
        }
        if (m.type === 'equipment' || m.type === 'rule' || m.type === 'mechanism' || m.type === 'power-system' || m.type === 'geography' || m.type === 'technology' || m.type === 'phenomenon' || m.type === 'location') {
            if (!m.parentPlane) return true;
            if (allowedParentPlanes.has(m.parentPlane)) return true;
            const parentSub = subplaneMats.find(sp =>
                sp.id === m.parentPlane || sp.name === m.parentPlane ||
                sp.name.replace(/^次位面[···]+/, '') === m.parentPlane
            );
            if (parentSub && (parentSub.id === currentVolSubplaneId || parentSub.name === currentVolSubplaneName)) return true;
            return false;
        }
        return true;
    });

    const lockedSubplaneNames = subplaneMats
        .filter(m => m.isLocked && m.id !== currentVolSubplaneId)
        .map(m => ({ full: m.name, short: m.name.replace(/^次位面[···]+/, '') }));

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
    const entry = getVolumeSubplane(projectId, targetChapter);
    if (!entry) return;
    const subplaneMaterials = store.queryItems('materials', { projectId, type: 'sub-plane' });
    for (const m of subplaneMaterials) {
        const shouldBeUnlocked = m.id === entry.subplaneId || m.name === entry.subplaneName;
        if (m.isLocked === shouldBeUnlocked) {
            await store.setItem('materials', m.id, { ...m, isLocked: !shouldBeUnlocked });
            console.log(`[PIPELINE] ${shouldBeUnlocked ? '解锁' : '锁定'}次位面: ${m.name}`);
        }
    }
}

function buildVolumeRhythmGuidance(projectId, targetCount, existingCount = 0) {
    const chapters = store.queryItems('chapters', { projectId }).sort((a, b) => a.chapterNumber - b.chapterNumber);
    const allOutlines = chapters.map(c => ({
        num: c.chapterNumber,
        outline: c.outline || '',
        title: c.title || ''
    }));

    const subplaneNames = [];
    const subplaneMaterials = store.queryItems('materials', { projectId, type: 'sub-plane' });
    for (const m of subplaneMaterials) {
        if (m.name) subplaneNames.push(m.name);
    }

    const unlockedSubplanes = subplaneMaterials.filter(m => !m.isLocked).map(m => m.name);
    const lockedSubplanes = subplaneMaterials.filter(m => m.isLocked).map(m => m.name);

    const existingSubplaneRefs = [];
    for (const ch of allOutlines) {
        const text = ch.outline + ch.title;
        for (const name of subplaneNames) {
            const shortName = name.replace(/^次位面[···]+/, '');
            if (text.includes(shortName) || text.includes(name)) {
                if (!existingSubplaneRefs.find(r => r.name === name)) {
                    existingSubplaneRefs.push({ name, firstChapter: ch.num });
                }
            }
        }
    }

    const totalExisting = allOutlines.length;
    const currentVolume = Math.floor(totalExisting / 30) + 1;
    const chapterInVolume = (totalExisting % 30) + 1;

    let guidance = `\n【当前卷节奏状态 - 必须参考】`;
    guidance += `\n- 已有${totalExisting}章，当前处于第${currentVolume}卷，卷内第${chapterInVolume}章`;
    guidance += `\n- 已解锁次位面：${unlockedSubplanes.length > 0 ? unlockedSubplanes.join('、') : '无'}`;
    guidance += `\n- 未解锁次位面：${lockedSubplanes.length > 0 ? lockedSubplanes.join('、') : '无'}`;

    if (existingSubplaneRefs.length > 0) {
        guidance += `\n- 已使用的次位面：${existingSubplaneRefs.map(r => `${r.name}(首次出现Ch${r.firstChapter})`).join('、')}`;
    }

    if (chapterInVolume <= 5) {
        guidance += `\n- 当前应处于：第一阶段·主世界铺垫（Ch1-5），准备进入次位面`;
        guidance += `\n- 本卷应使用的次位面：${unlockedSubplanes.length > 0 ? unlockedSubplanes[0] : '待解锁'}`;
    } else if (chapterInVolume <= 25) {
        guidance += `\n- 当前应处于：第二阶段·深入次位面探索（Ch6-25），专注当前位面`;
        guidance += `\n- 禁止引入新次位面！继续深入当前位面的探索和任务推进`;
    } else {
        guidance += `\n- 当前应处于：第三阶段·主世界回响（Ch26-30），返回主世界消化能力`;
        guidance += `\n- 禁止引入新次位面！专注主世界剧情和配角互动`;
    }

    guidance += `\n- 关键提醒：本卷只能使用一个次位面！如果已有次位面在探索中，绝对不能引入第二个！`;

    return guidance;
}

module.exports = {
    getVolumeOrder,
    getVolumeSubplane,
    getVisibleMaterials,
    enforceVolumeSubplaneLocks,
    buildVolumeRhythmGuidance
};
