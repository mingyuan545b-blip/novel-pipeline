const store = require('../../store');
const { MEMORY_LAYERS, LAYER_DECAY_RATES, RECENCY_FLOOR, RECENCY_TOUCH_BOOST, COMPRESSION_THRESHOLD } = require('./memoryConstants');
const { _extractSummary } = require('./memoryLayerBuilder');

async function applyDecayAndCompress(projectId, currentChapter, getLayerFn, setLayerFn) {
    for (const layerName of ['L1', 'L2', 'L3', 'L4']) {
        const layer = await getLayerFn(projectId, MEMORY_LAYERS[layerName]);
        if (!layer) continue;

        const decayRate = LAYER_DECAY_RATES[layerName];
        if (decayRate === 0) continue;

        const chaptersSinceUpdate = currentChapter - (layer.chapterNumber || currentChapter);
        const decayFactor = Math.pow(1 - decayRate, Math.max(0, chaptersSinceUpdate));

        if (layer.recencyScore !== undefined) {
            layer.recencyScore = Math.max(RECENCY_FLOOR, layer.recencyScore * decayFactor);
        } else {
            layer.recencyScore = Math.max(RECENCY_FLOOR, 100 * decayFactor);
        }

        if (layer.recencyScore < COMPRESSION_THRESHOLD * 100) {
            await compressMemory(projectId, layerName, layer, setLayerFn);
        } else {
            await setLayerFn(projectId, MEMORY_LAYERS[layerName], layer);
        }
    }
}

async function compressMemory(projectId, layerName, layer, setLayerFn) {
    switch (layerName) {
        case 'L1': {
            const compressed = {
                ...layer,
                characterStates: {}, relationshipStates: {},
                equipmentStates: {}, growthStates: {}
            };
            const charEntries = Object.entries(layer.characterStates || {})
                .sort((a, b) => (b[1].recencyScore || 0) - (a[1].recencyScore || 0));
            for (const [id, state] of charEntries.slice(0, 5)) {
                compressed.characterStates[id] = {
                    ...state,
                    currentContent: `${state.name}|位置:${state.location}|战力:${state.powerLevel}|状态:${state.status}`
                };
            }
            const relEntries = Object.entries(layer.relationshipStates || {})
                .sort((a, b) => (b[1].recencyScore || 0) - (a[1].recencyScore || 0));
            for (const [id, rel] of relEntries.slice(0, 3)) {
                compressed.relationshipStates[id] = {
                    ...rel, content: `${rel.name}: ${rel.type}(强度:${rel.strength})`
                };
            }
            compressed.recencyScore = layer.recencyScore;
            compressed.compressed = true;
            await setLayerFn(projectId, MEMORY_LAYERS.L1, compressed);
            break;
        }
        case 'L2': {
            const compressed = {
                ...layer,
                recentSummaries: (layer.recentSummaries || []).slice(-2)
                    .map(s => ({ ...s, summary: s.summary?.substring(0, 80) || '' })),
                activeForeshadowings: (layer.activeForeshadowings || [])
                    .filter(f => f.urgency > 50).slice(0, 3)
            };
            compressed.recencyScore = layer.recencyScore;
            compressed.compressed = true;
            await setLayerFn(projectId, MEMORY_LAYERS.L2, compressed);
            break;
        }
        case 'L3': {
            const compressed = {
                ...layer,
                relevantHistory: (layer.relevantHistory || []).slice(0, 3),
                archivedMaterials: (layer.archivedMaterials || []).slice(0, 5)
            };
            compressed.recencyScore = layer.recencyScore;
            compressed.compressed = true;
            await setLayerFn(projectId, MEMORY_LAYERS.L3, compressed);
            break;
        }
        case 'L4': {
            if (layer.volumes) {
                const currentVol = Math.ceil((layer.chapterNumber || 1) / 30);
                const keptVolumes = {};
                if (layer.volumes[currentVol]) keptVolumes[currentVol] = layer.volumes[currentVol];
                if (layer.volumes[currentVol - 1]) keptVolumes[currentVol - 1] = layer.volumes[currentVol - 1];
                const compressed = { ...layer, volumes: keptVolumes };
                compressed.recencyScore = layer.recencyScore;
                compressed.compressed = true;
                await setLayerFn(projectId, MEMORY_LAYERS.L4, compressed);
            }
            break;
        }
    }
}

async function touchRecency(projectId, layerName, entryId, getLayerFn, setLayerFn) {
    const layer = await getLayerFn(projectId, MEMORY_LAYERS[layerName]);
    if (!layer) return;

    if (entryId && layer.characterStates?.[entryId]) {
        layer.characterStates[entryId].recencyScore = RECENCY_TOUCH_BOOST;
    } else if (entryId && layer.relationshipStates?.[entryId]) {
        layer.relationshipStates[entryId].recencyScore = RECENCY_TOUCH_BOOST;
    }
    layer.recencyScore = RECENCY_TOUCH_BOOST;
    await setLayerFn(projectId, MEMORY_LAYERS[layerName], layer);
}

async function generateVolumeSummary(projectId, endChapterNumber, getLayerFn, setLayerFn) {
    const volumeNum = Math.ceil(endChapterNumber / 30);
    const startChapter = (volumeNum - 1) * 30 + 1;

    const chapters = (await store.queryItems('chapters', { projectId }))
        .filter(c => c.chapterNumber >= startChapter && c.chapterNumber <= endChapter);

    const sorted = chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    const chapterSummaries = sorted.map(c =>
        `第${c.chapterNumber}章 ${c.title}: ${c.summary || _extractSummary(c.content)}`
    ).join('\n');

    const l4 = await getLayerFn(projectId, MEMORY_LAYERS.L4) || { volumes: {} };
    if (!l4.volumes) l4.volumes = {};

    l4.volumes[volumeNum] = {
        ...l4.volumes[volumeNum],
        summary: `[本卷${sorted.length}章摘要] ${chapterSummaries.substring(0, 2000)}`,
        generatedAt: new Date().toISOString()
    };

    await setLayerFn(projectId, MEMORY_LAYERS.L4, l4);
    return l4.volumes[volumeNum];
}

async function updateAfterChapter(projectId, chapterNumber, chapterContent, materialUpdates, buildFn, getLayerFn, setLayerFn, invalidateCacheFn) {
    await buildFn.buildL0(projectId, setLayerFn);
    await buildFn.buildL1(projectId, chapterNumber, setLayerFn);
    await buildFn.buildL2(projectId, chapterNumber, 5, setLayerFn);
    invalidateCacheFn(projectId, MEMORY_LAYERS.L3);

    if (chapterNumber % 30 === 0) {
        await generateVolumeSummary(projectId, chapterNumber, getLayerFn, setLayerFn);
    }

    await buildFn.buildL4(projectId, chapterNumber, setLayerFn, getLayerFn);
    await applyDecayAndCompress(projectId, chapterNumber, getLayerFn, setLayerFn);
}

module.exports = {
    applyDecayAndCompress, compressMemory, touchRecency,
    generateVolumeSummary, updateAfterChapter
};
