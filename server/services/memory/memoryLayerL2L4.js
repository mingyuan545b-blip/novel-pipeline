const store = require('../../store');
const { MEMORY_LAYERS } = require('./memoryConstants');
const { _estimateTokens, _extractSummary } = require('./memoryLayerL0L1');

function _calcForeshadowingUrgency(foreshadowing, currentChapter) {
    const planted = foreshadowing.plantedChapter || 0;
    const gap = currentChapter - planted;
    if (gap > 50) return 90;
    if (gap > 30) return 70;
    if (gap > 15) return 50;
    return 20;
}

async function buildL2(projectId, chapterNumber, windowSize, setLayerFn) {
    const effectiveWindow = windowSize || 5;
    const chapters = await store.queryItems('chapters', { projectId });
    const sorted = chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

    const recentChapters = sorted
        .filter(c => c.chapterNumber < chapterNumber)
        .slice(-effectiveWindow);

    const quests = await store.queryItems('quests', { projectId });
    const activeQuests = quests.filter(q => q.status === 'active');

    const allMaterials = (await store.queryItems('materials', { projectId })).filter(m => !m.archived);
    const foreshadowings = allMaterials.filter(m => m.type === 'foreshadowing');
    const activeForeshadowings = foreshadowings.filter(f => {
        const content = f.currentContent || f.initialContent || '';
        return !content.includes('已回收') && !content.includes('已废弃');
    });

    const l2 = {
        chapterNumber,
        recentSummaries: recentChapters.map(c => ({
            chapterNumber: c.chapterNumber, title: c.title,
            summary: c.summary || _extractSummary(c.content),
            keyEvents: c.keyEvents || [], wordCount: c.wordCount || 0
        })),
        activeQuests: activeQuests.map(q => ({
            id: q.id, name: q.title || q.name,
            description: q.description, progress: q.progress || 0,
            priority: q.priority || 'medium'
        })),
        activeForeshadowings: activeForeshadowings.map(f => ({
            id: f.id, name: f.name,
            content: f.currentContent || f.initialContent,
            plantedChapter: f.plantedChapter || 0,
            urgency: _calcForeshadowingUrgency(f, chapterNumber),
            relatedCharacters: f.relatedCharacters || []
        })),
        totalTokenEstimate: 0
    };

    l2.totalTokenEstimate = _estimateTokens(JSON.stringify(l2));
    await setLayerFn(projectId, MEMORY_LAYERS.L2, l2);
    return l2;
}

async function buildL3(projectId, chapterNumber, relevantKeywords, setLayerFn, getLayerFn) {
    const allMaterials = await store.queryItems('materials', { projectId });
    const archivedMaterials = allMaterials.filter(m => m.archived);

    const chapters = await store.queryItems('chapters', { projectId });
    const olderChapters = chapters
        .filter(c => c.chapterNumber < chapterNumber - 5)
        .sort((a, b) => b.chapterNumber - a.chapterNumber);

    const { _relevanceScore } = require('./memoryCompression');
    const scored = [];
    for (const ch of olderChapters.slice(0, 50)) {
        const score = _relevanceScore(ch.content || ch.outline || '', relevantKeywords);
        if (score > 0) {
            scored.push({
                chapterNumber: ch.chapterNumber, title: ch.title,
                summary: ch.summary || _extractSummary(ch.content),
                relevanceScore: score
            });
        }
    }

    const relevantArchived = archivedMaterials
        .map(m => ({
            id: m.id, name: m.name, type: m.type,
            content: m.currentContent || m.initialContent,
            retiredAt: m.changeLog?.slice(-1)[0]?.timestamp
        }))
        .filter(m => {
            if (relevantKeywords.length === 0) return true;
            return _relevanceScore(m.content || '', relevantKeywords) > 0;
        });

    const l3 = {
        chapterNumber,
        relevantHistory: scored.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10),
        archivedMaterials: relevantArchived.slice(0, 20),
        totalTokenEstimate: 0
    };

    l3.totalTokenEstimate = _estimateTokens(JSON.stringify(l3));
    await setLayerFn(projectId, MEMORY_LAYERS.L3, l3);
    return l3;
}

async function buildL4(projectId, chapterNumber, setLayerFn, getLayerFn) {
    const chapters = await store.queryItems('chapters', { projectId });
    const sorted = chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

    const volumes = {};
    const VOLUME_SIZE = 30;

    for (const ch of sorted) {
        const vol = Math.ceil(ch.chapterNumber / VOLUME_SIZE);
        if (!volumes[vol]) {
            volumes[vol] = {
                volumeNumber: vol,
                startChapter: (vol - 1) * VOLUME_SIZE + 1,
                endChapter: vol * VOLUME_SIZE,
                chapters: [], summary: ''
            };
        }
        volumes[vol].chapters.push({
            chapterNumber: ch.chapterNumber, title: ch.title,
            summary: ch.summary || _extractSummary(ch.content),
            keyEvents: ch.keyEvents || []
        });
    }

    const existingL4 = await getLayerFn(projectId, MEMORY_LAYERS.L4);
    if (existingL4?.volumes) {
        for (const [volNum, volData] of Object.entries(volumes)) {
            const existing = existingL4.volumes[volNum];
            if (existing?.summary && existing.chapters?.length === volData.chapters.length) {
                volData.summary = existing.summary;
            }
        }
    }

    const l4 = { chapterNumber, volumes, totalTokenEstimate: 0 };
    l4.totalTokenEstimate = _estimateTokens(JSON.stringify(l4));
    await setLayerFn(projectId, MEMORY_LAYERS.L4, l4);
    return l4;
}

module.exports = { buildL2, buildL3, buildL4, _calcForeshadowingUrgency };
