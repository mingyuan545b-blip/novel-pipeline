const store = require('../store');

async function getSnapshot(projectId, chapterNumber) {
    const snapshots = await store.queryItems('state-snapshots', s => s.projectId === projectId);
    if (chapterNumber) {
        return snapshots
            .filter(s => s.chapterNumber === chapterNumber)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    }
    return snapshots.sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
}

async function getSnapshotHistory(projectId) {
    const snapshots = await store.queryItems('state-snapshots', s => s.projectId === projectId);
    return snapshots.sort((a, b) => a.chapterNumber - b.chapterNumber);
}

async function getCharacterTimeline(projectId, characterId) {
    const snapshots = await getSnapshotHistory(projectId);
    return snapshots.map(s => ({
        chapterNumber: s.chapterNumber, timestamp: s.timestamp,
        state: s.characterStates?.[characterId] || null
    })).filter(e => e.state !== null);
}

async function getRelationshipTimeline(projectId, relationshipId) {
    const snapshots = await getSnapshotHistory(projectId);
    return snapshots.map(s => ({
        chapterNumber: s.chapterNumber, timestamp: s.timestamp,
        state: s.relationshipStates?.[relationshipId] || null
    })).filter(e => e.state !== null);
}

async function getPowerProgression(projectId, characterId) {
    const timeline = await getCharacterTimeline(projectId, characterId);
    return timeline
        .filter(t => t.state.powerLevel && t.state.powerLevel !== '未知')
        .map(t => ({
            chapterNumber: t.chapterNumber, powerLevel: t.state.powerLevel,
            changesFromPrev: t.state.changesFromPrev || []
        }));
}

async function getForeshadowingTracker(projectId) {
    const snapshots = await getSnapshotHistory(projectId);
    if (!snapshots.length) return [];
    const latest = snapshots[snapshots.length - 1];
    const allForeshadowings = Object.values(latest.foreshadowingStates || {});
    return allForeshadowings.map(f => {
        const history = snapshots
            .filter(s => s.foreshadowingStates?.[f.id])
            .map(s => ({
                chapterNumber: s.chapterNumber,
                status: s.foreshadowingStates[f.id].status,
                urgency: s.foreshadowingStates[f.id].urgency
            }));
        return { ...f, history };
    });
}

module.exports = {
    getSnapshot, getSnapshotHistory, getCharacterTimeline,
    getRelationshipTimeline, getPowerProgression, getForeshadowingTracker
};
