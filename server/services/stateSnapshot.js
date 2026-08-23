const store = require('../store');
const { v4: uuidv4 } = require('uuid');
const { getSnapshotHistory } = require('./stateSnapshotQueries');
const { computeDiff } = require('./stateSnapshotDiff');

const queries = require('./stateSnapshotQueries');
const diffModule = require('./stateSnapshotDiff');

class StateSnapshotService {
    async createSnapshot(projectId, chapterNumber, chapterContent, materialUpdates) {
        const allMaterials = await store.queryItems('materials', m => m.projectId === projectId);
        const activeMaterials = allMaterials.filter(m => !m.archived);

        const characters = activeMaterials.filter(m => m.type === 'character');
        const relationships = activeMaterials.filter(m => m.type === 'relationship');
        const equipment = activeMaterials.filter(m => m.type === 'equipment');
        const growthHistories = activeMaterials.filter(m => m.type === 'growth-history');
        const foreshadowings = activeMaterials.filter(m => m.type === 'foreshadowing');
        const worldviews = activeMaterials.filter(m => m.type === 'worldview');
        const powerSystems = activeMaterials.filter(m => m.type === 'power-system');

        const prevSnapshots = await store.queryItems('state-snapshots', s => s.projectId === projectId);
        const prevSnapshot = prevSnapshots
            .filter(s => s.chapterNumber < chapterNumber)
            .sort((a, b) => b.chapterNumber - a.chapterNumber)[0];

        const characterStates = {};
        for (const c of characters) {
            const prevState = prevSnapshot?.characterStates?.[c.id] || {};
            const updates = materialUpdates?.characterUpdates?.find(u => u.id === c.id);
            characterStates[c.id] = {
                id: c.id, name: c.name,
                content: c.currentContent || c.initialContent,
                location: updates?.location || prevState.location || '未知',
                powerLevel: updates?.powerLevel || prevState.powerLevel || '未知',
                status: updates?.status || prevState.status || '正常',
                equipment: equipment.filter(e => e.characterId === c.id || e.parentFaction === c.parentFaction).map(e => e.name),
                growthHistory: growthHistories.find(g => g.characterId === c.id)?.currentContent || '',
                appearedInChapter: this._detectAppearance(chapterContent, c.name),
                changesFromPrev: updates?.changes || []
            };
        }

        const relationshipStates = {};
        for (const r of relationships) {
            const prevState = prevSnapshot?.relationshipStates?.[r.id] || {};
            relationshipStates[r.id] = {
                id: r.id, name: r.name,
                type: r.relationshipType || r.type || '未知',
                strength: r.strength || prevState.strength || '中等',
                appearedInChapter: this._detectAppearance(chapterContent, r.name)
            };
        }

        const equipmentStates = {};
        for (const e of equipment) {
            equipmentStates[e.id] = { id: e.id, name: e.name, type: e.equipmentType || e.type || '未知' };
        }

        const foreshadowingStates = {};
        for (const f of foreshadowings) {
            const prevState = prevSnapshot?.foreshadowingStates?.[f.id] || {};
            foreshadowingStates[f.id] = {
                id: f.id, name: f.name,
                status: f.status || prevState.status || 'planted',
                plantedChapter: f.plantedChapter || prevState.plantedChapter || chapterNumber,
                urgency: this._calcUrgency(f.plantedChapter || prevState.plantedChapter || chapterNumber, chapterNumber, f.status || prevState.status)
            };
        }

        const worldviewStates = {};
        for (const w of worldviews) worldviewStates[w.id] = { id: w.id, name: w.name, content: w.currentContent || '' };
        const powerSystemStates = {};
        for (const p of powerSystems) powerSystemStates[p.id] = { id: p.id, name: p.name, content: p.currentContent || '' };

        const currentStates = { characterStates, relationshipStates, equipmentStates, foreshadowingStates };
        const diff = computeDiff(prevSnapshot, currentStates);

        const snapshot = {
            id: uuidv4(), projectId, chapterNumber,
            timestamp: new Date().toISOString(),
            characterStates, relationshipStates, equipmentStates,
            foreshadowingStates, worldviewStates, powerSystemStates,
            diff, materialCount: activeMaterials.length
        };

        await store.setItem('state-snapshots', snapshot.id, snapshot);
        return snapshot;
    }

    _detectAppearance(content, name) {
        if (!content || !name) return false;
        return content.includes(name);
    }

    _calcUrgency(plantedChapter, currentChapter, status) {
        if (status === 'harvested' || status === 'resolved') return 0;
        const gap = currentChapter - plantedChapter;
        if (gap > 50) return 90;
        if (gap > 30) return 70;
        if (gap > 15) return 50;
        return 20;
    }

    async getSnapshot(projectId, chapterNumber) { return queries.getSnapshot(projectId, chapterNumber); }
    async getSnapshotHistory(projectId) { return queries.getSnapshotHistory(projectId); }
    async getCharacterTimeline(projectId, characterId) { return queries.getCharacterTimeline(projectId, characterId); }
    async getRelationshipTimeline(projectId, relationshipId) { return queries.getRelationshipTimeline(projectId, relationshipId); }
    async getPowerProgression(projectId, characterId) { return queries.getPowerProgression(projectId, characterId); }
    async getForeshadowingTracker(projectId) { return queries.getForeshadowingTracker(projectId); }
    async restoreSnapshot(projectId, chapterNumber) { return diffModule.restoreSnapshot(projectId, chapterNumber); }
    async getDiff(projectId, chapterA, chapterB) { return diffModule.getDiff(projectId, chapterA, chapterB); }
}

module.exports = new StateSnapshotService();
