async function saveSubplaneMaterials({ projectId, parsed, subplaneName, subplaneType, volumeNumber, project }) {
    const store = require('../../store');
    const subplaneId = `sp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const createdMaterials = [];

    const chapters = await store.queryItems('chapters', { projectId });
    const existingCount = chapters.length;
    const currentVolume = volumeNumber || Math.floor(existingCount / 30) + 1;

    const volumeOrderConfig = loadVolumeOrderConfig(project);
    const volEntry = volumeOrderConfig?.volumeOrder?.find(v => v.volume === currentVolume);
    const isCurrentVolumeSubplane = volEntry && (volEntry.subplaneName === `小世界·${subplaneName}` || volEntry.subplaneName === subplaneName);
    const shouldUnlock = isCurrentVolumeSubplane;

    const subMat = buildSubplaneMaterial({ subplaneId, projectId, parsed, subplaneName, subplaneType, currentVolume, shouldUnlock });
    await store.setItem('materials', subplaneId, subMat);
    createdMaterials.push({ type: 'sub-plane', name: subMat.name, id: subplaneId });

    const factionNameToId = await saveFactions({ parsed, projectId, subplaneId, subMat, subplaneType, shouldUnlock, createdMaterials });
    await saveCharacters({ parsed, projectId, subplaneId, subplaneType, subMat, shouldUnlock, factionNameToId, createdMaterials });
    await saveItems({ parsed, projectId, subplaneId, subplaneType, subMat, shouldUnlock, createdMaterials });

    return { subplaneId, createdMaterials };
}

function loadVolumeOrderConfig(project) {
    try {
        const fs = require('fs');
        const path = require('path');
        const genre = project.genre || project.styleProfile?.key || '';
        const genreFileMap = {
            'causal-eye-strategy': 'volume-order-causal-eye.json',
            'strategy-crossplane': 'volume-order-strategy.json',
            'witty-strategy': 'volume-order-witty-strategy.json',
        };
        const fileName = genreFileMap[genre] || 'volume-order.json';
        const voPath = path.join(__dirname, '..', '..', '..', 'data', 'subplanes', fileName);
        if (fs.existsSync(voPath)) return JSON.parse(fs.readFileSync(voPath, 'utf8'));
    } catch (_) { /* silent */ }
    return null;
}

function buildSubplaneMaterial({ subplaneId, projectId, parsed, subplaneName, subplaneType, currentVolume, shouldUnlock }) {
    return {
        id: subplaneId, projectId, type: 'sub-plane',
        name: parsed.subplane.name || `小世界·${subplaneName}`,
        description: parsed.subplane.description || `${subplaneType}类小世界`,
        initialContent: parsed.subplane.initialContent,
        currentContent: parsed.subplane.initialContent,
        parentPlane: '主世界', isLocked: !shouldUnlock,
        tags: ['sub-plane', subplaneType], version: 1,
        changeLog: [{ action: 'generated', reason: `手动生成小世界素材(第${currentVolume}卷${shouldUnlock ? '，当前卷解锁' : '，非当前卷锁定'})`, at: new Date().toISOString() }],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
}

async function saveFactions({ parsed, projectId, subplaneId, subMat, subplaneType, shouldUnlock, createdMaterials }) {
    const store = require('../../store');
    const factionNameToId = {};
    if (!parsed.factions) return factionNameToId;

    for (const fac of parsed.factions) {
        const facId = `fac-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const facMat = {
            id: facId, projectId, type: 'faction', name: fac.name, description: fac.description,
            initialContent: fac.content, currentContent: fac.content,
            parentPlane: subplaneId, isLocked: !shouldUnlock,
            tags: [subMat.name, subplaneType], version: 1, changeLog: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await store.setItem('materials', facId, facMat);
        createdMaterials.push({ type: 'faction', name: fac.name, id: facId });
        factionNameToId[fac.name] = facId;
    }
    return factionNameToId;
}

async function saveCharacters({ parsed, projectId, subplaneId, subplaneType, subMat, shouldUnlock, factionNameToId, createdMaterials }) {
    const store = require('../../store');
    if (!parsed.characters) return;

    for (const chr of parsed.characters) {
        const chrId = `chr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const chrMat = {
            id: chrId, projectId, type: 'character', name: chr.name, description: chr.description,
            initialContent: chr.content, currentContent: chr.content,
            parentPlane: subplaneId, parentFaction: factionNameToId[chr.faction] || chr.faction,
            isLocked: !shouldUnlock, tags: [subMat.name, subplaneType, 'original'],
            refNames: chr.refNames || {}, version: 1, changeLog: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await store.setItem('materials', chrId, chrMat);
        createdMaterials.push({ type: 'character', name: chr.name, id: chrId });
    }
}

async function saveItems({ parsed, projectId, subplaneId, subplaneType, subMat, shouldUnlock, createdMaterials }) {
    const store = require('../../store');
    if (!parsed.items) return;

    for (const itm of parsed.items) {
        const itmId = `itm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const itmMat = {
            id: itmId, projectId, type: 'equipment', name: itm.name, description: itm.description,
            initialContent: itm.content, currentContent: itm.content,
            parentPlane: subplaneId, isLocked: !shouldUnlock,
            tags: [subMat.name, subplaneType, 'sub-plane-item'], version: 1, changeLog: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await store.setItem('materials', itmId, itmMat);
        createdMaterials.push({ type: 'equipment', name: itm.name, id: itmId });
    }
}

module.exports = { saveSubplaneMaterials };
