const store = require('../../store');
const { MEMORY_LAYERS } = require('./memoryConstants');
const { estimateTokens: sharedEstimateTokens } = require('../contextBudget');

function _estimateTokens(text) {
    return sharedEstimateTokens(text);
}

function _extractSummary(content) {
    if (!content) return '';
    const first500 = content.substring(0, 500);
    const sentences = first500.match(/[^。！？.!?]+[。！？.!?]/g) || [first500];
    return sentences.slice(0, 3).join('');
}

async function buildL0(projectId, setLayerFn) {
    const allMaterials = (await store.queryItems('materials', { projectId })).filter(m => !m.archived);
    const worldviews = allMaterials.filter(m => m.type === 'worldview');
    const powerSystems = allMaterials.filter(m => m.type === 'power-system');
    let coreChars = allMaterials.filter(m => m.type === 'character' && (m.tags?.includes('核心') || m.tags?.includes('主角') || m.tags?.includes('template')));
    if (coreChars.length === 0) {
        const allChars = allMaterials.filter(m => m.type === 'character');
        coreChars = allChars.slice(0, Math.min(3, allChars.length));
    }

    const l0 = {
        worldRules: worldviews.map(w => ({
            id: w.id, name: w.name,
            content: w.currentContent || w.initialContent,
            version: w.version || 1
        })),
        powerFramework: powerSystems.map(p => ({
            id: p.id, name: p.name,
            content: p.currentContent || p.initialContent,
            version: p.version || 1
        })),
        coreCharacters: coreChars.map(c => ({
            id: c.id, name: c.name,
            content: c.currentContent || c.initialContent,
            version: c.version || 1
        })),
        totalTokenEstimate: 0
    };

    l0.totalTokenEstimate = _estimateTokens(JSON.stringify(l0));
    await setLayerFn(projectId, MEMORY_LAYERS.L0, l0);
    return l0;
}

async function buildL1(projectId, chapterNumber, setLayerFn) {
    const allMaterials = (await store.queryItems('materials', { projectId })).filter(m => !m.archived);
    const characters = allMaterials.filter(m => m.type === 'character');
    const relationships = allMaterials.filter(m => m.type === 'relationship');
    const equipment = allMaterials.filter(m => m.type === 'equipment');
    const growthHistories = allMaterials.filter(m => m.type === 'growth-history');

    const snapshots = await store.queryItems('state-snapshots', { projectId });
    const latestSnapshot = snapshots
        .filter(s => s.chapterNumber <= (chapterNumber || 99999))
        .sort((a, b) => b.chapterNumber - a.chapterNumber)[0];

    const charStates = {};
    for (const c of characters) {
        const snapState = latestSnapshot?.characterStates?.[c.id];
        charStates[c.id] = {
            id: c.id, name: c.name,
            currentContent: c.currentContent || c.initialContent,
            location: snapState?.location || '未知',
            status: snapState?.status || '活跃',
            powerLevel: snapState?.powerLevel || '未知',
            emotionalState: snapState?.emotionalState || '未知',
            lastAppearanceChapter: snapState?.lastAppearanceChapter || 0,
            active: snapState?.active !== false
        };
    }

    const relStates = {};
    for (const r of relationships) {
        const snapRel = latestSnapshot?.relationshipStates?.[r.id];
        relStates[r.id] = {
            id: r.id, name: r.name,
            content: r.currentContent || r.initialContent,
            type: snapRel?.type || r.tags?.[0] || '未知',
            strength: snapRel?.strength || 50,
            lastChangeChapter: snapRel?.lastChangeChapter || 0
        };
    }

    const equipStates = {};
    for (const e of equipment) {
        const snapEquip = latestSnapshot?.equipmentStates?.[e.id];
        equipStates[e.id] = {
            id: e.id, name: e.name,
            content: e.currentContent || e.initialContent,
            owner: snapEquip?.owner || '未知',
            status: snapEquip?.status || '完好'
        };
    }

    const growthStates = {};
    for (const g of growthHistories) {
        growthStates[g.id] = {
            id: g.id, name: g.name,
            content: g.currentContent || g.initialContent,
            milestones: latestSnapshot?.growthMilestones?.[g.id] || []
        };
    }

    const l1 = {
        chapterNumber: chapterNumber || latestSnapshot?.chapterNumber || 0,
        characterStates: charStates,
        relationshipStates: relStates,
        equipmentStates: equipStates,
        growthStates: growthStates,
        totalTokenEstimate: 0
    };

    l1.totalTokenEstimate = _estimateTokens(JSON.stringify(l1));
    await setLayerFn(projectId, MEMORY_LAYERS.L1, l1);
    return l1;
}

module.exports = { buildL0, buildL1, _estimateTokens, _extractSummary };
