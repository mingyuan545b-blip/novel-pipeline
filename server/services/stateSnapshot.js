const store = require('../store');
const { v4: uuidv4 } = require('uuid');

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
                id: c.id,
                name: c.name,
                content: c.currentContent || c.initialContent,
                location: updates?.location || prevState.location || '未知',
                status: updates?.status || prevState.status || '活跃',
                powerLevel: updates?.powerLevel || prevState.powerLevel || '未知',
                emotionalState: updates?.emotionalState || prevState.emotionalState || '平静',
                lastAppearanceChapter: this._detectAppearance(chapterContent, c.name)
                    ? chapterNumber
                    : (prevState.lastAppearanceChapter || 0),
                active: updates?.active !== undefined ? updates.active : (prevState.active !== false),
                changesFromPrev: updates ? Object.keys(updates) : []
            };
        }

        const relationshipStates = {};
        for (const r of relationships) {
            const prevState = prevSnapshot?.relationshipStates?.[r.id] || {};
            const updates = materialUpdates?.relationshipUpdates?.find(u => u.id === r.id);
            relationshipStates[r.id] = {
                id: r.id,
                name: r.name,
                content: r.currentContent || r.initialContent,
                type: updates?.type || prevState.type || r.tags?.[0] || '未知',
                strength: updates?.strength || prevState.strength || 50,
                lastChangeChapter: updates ? chapterNumber : (prevState.lastChangeChapter || 0),
                changeDescription: updates?.description || prevState.changeDescription || ''
            };
        }

        const equipmentStates = {};
        for (const e of equipment) {
            const prevState = prevSnapshot?.equipmentStates?.[e.id] || {};
            const updates = materialUpdates?.equipmentUpdates?.find(u => u.id === e.id);
            equipmentStates[e.id] = {
                id: e.id,
                name: e.name,
                content: e.currentContent || e.initialContent,
                owner: updates?.owner || prevState.owner || '未知',
                status: updates?.status || prevState.status || '完好',
                lastChangeChapter: updates ? chapterNumber : (prevState.lastChangeChapter || 0)
            };
        }

        const growthMilestones = {};
        for (const g of growthHistories) {
            const prevMilestones = prevSnapshot?.growthMilestones?.[g.id] || [];
            const updates = materialUpdates?.growthUpdates?.find(u => u.id === g.id);
            const newMilestone = updates ? {
                chapter: chapterNumber,
                description: updates.milestone || '',
                timestamp: new Date().toISOString()
            } : null;
            growthMilestones[g.id] = newMilestone
                ? [...prevMilestones, newMilestone]
                : prevMilestones;
        }

        const foreshadowingStates = {};
        for (const f of foreshadowings) {
            const prevState = prevSnapshot?.foreshadowingStates?.[f.id] || {};
            const updates = materialUpdates?.foreshadowingUpdates?.find(u => u.id === f.id);
            foreshadowingStates[f.id] = {
                id: f.id,
                name: f.name,
                content: f.currentContent || f.initialContent,
                status: updates?.status || prevState.status || 'planted',
                plantedChapter: updates?.plantedChapter || prevState.plantedChapter || chapterNumber,
                harvestedChapter: updates?.harvestedChapter || prevState.harvestedChapter || null,
                urgency: this._calcUrgency(
                    updates?.plantedChapter || prevState.plantedChapter || chapterNumber,
                    chapterNumber,
                    updates?.status || prevState.status
                )
            };
        }

        const timelineEvents = [];
        const quests = await store.queryItems('quests', q => q.projectId === projectId);
        const activeQuests = quests.filter(q => q.status === 'active');
        if (materialUpdates?.timelineEvents) {
            timelineEvents.push(...materialUpdates.timelineEvents);
        }

        const snapshot = {
            id: uuidv4(),
            projectId,
            chapterNumber,
            timestamp: new Date().toISOString(),
            characterStates,
            relationshipStates,
            equipmentStates,
            growthMilestones,
            foreshadowingStates,
            activeQuests: activeQuests.map(q => ({ id: q.id, name: q.name, status: q.status, progress: q.progress })),
            timelineEvents,
            worldviewSnapshot: worldviews.map(w => ({ id: w.id, name: w.name, content: w.currentContent || w.initialContent })),
            powerSystemSnapshot: powerSystems.map(p => ({ id: p.id, name: p.name, content: p.currentContent || p.initialContent })),
            diffFromPrev: this._computeDiff(prevSnapshot, { characterStates, relationshipStates, equipmentStates, foreshadowingStates })
        };

        await store.setItem('state-snapshots', snapshot.id, snapshot);
        return snapshot;
    }

    async getSnapshot(projectId, chapterNumber) {
        const snapshots = await store.queryItems('state-snapshots', s => s.projectId === projectId);
        if (chapterNumber) {
            return snapshots
                .filter(s => s.chapterNumber === chapterNumber)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        }
        return snapshots.sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
    }

    async getSnapshotHistory(projectId) {
        const snapshots = await store.queryItems('state-snapshots', s => s.projectId === projectId);
        return snapshots.sort((a, b) => a.chapterNumber - b.chapterNumber);
    }

    async getCharacterTimeline(projectId, characterId) {
        const snapshots = await this.getSnapshotHistory(projectId);
        return snapshots.map(s => ({
            chapterNumber: s.chapterNumber,
            timestamp: s.timestamp,
            state: s.characterStates?.[characterId] || null
        })).filter(e => e.state !== null);
    }

    async getRelationshipTimeline(projectId, relationshipId) {
        const snapshots = await this.getSnapshotHistory(projectId);
        return snapshots.map(s => ({
            chapterNumber: s.chapterNumber,
            timestamp: s.timestamp,
            state: s.relationshipStates?.[relationshipId] || null
        })).filter(e => e.state !== null);
    }

    async getPowerProgression(projectId, characterId) {
        const timeline = await this.getCharacterTimeline(projectId, characterId);
        return timeline
            .filter(t => t.state.powerLevel && t.state.powerLevel !== '未知')
            .map(t => ({
                chapterNumber: t.chapterNumber,
                powerLevel: t.state.powerLevel,
                changesFromPrev: t.state.changesFromPrev || []
            }));
    }

    async getForeshadowingTracker(projectId) {
        const snapshots = await this.getSnapshotHistory(projectId);
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

    async restoreSnapshot(projectId, chapterNumber) {
        const snapshot = await this.getSnapshot(projectId, chapterNumber);
        if (!snapshot) throw new Error(`找不到第${chapterNumber}章的快照`);

        const materials = await store.queryItems('materials', m => m.projectId === projectId);

        for (const [id, state] of Object.entries(snapshot.characterStates || {})) {
            const mat = materials.find(m => m.id === id);
            if (mat) {
                await store.setItem('materials', id, {
                    ...mat,
                    currentContent: state.content,
                    restoredFromSnapshot: chapterNumber
                });
            }
        }

        return { restored: true, chapterNumber, affectedMaterials: Object.keys(snapshot.characterStates || {}).length };
    }

    async getDiff(projectId, chapterA, chapterB) {
        const snapA = await this.getSnapshot(projectId, chapterA);
        const snapB = await this.getSnapshot(projectId, chapterB);
        if (!snapA || !snapB) throw new Error('找不到指定章节的快照');

        return {
            chapterA,
            chapterB,
            characterChanges: this._diffStates(snapA.characterStates, snapB.characterStates),
            relationshipChanges: this._diffStates(snapA.relationshipStates, snapB.relationshipStates),
            equipmentChanges: this._diffStates(snapA.equipmentStates, snapB.equipmentStates),
            foreshadowingChanges: this._diffStates(snapA.foreshadowingStates, snapB.foreshadowingStates)
        };
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

    _computeDiff(prevSnapshot, currentStates) {
        if (!prevSnapshot) return { isNew: true, changes: [] };
        const changes = [];

        for (const [id, state] of Object.entries(currentStates.characterStates || {})) {
            const prev = prevSnapshot.characterStates?.[id];
            if (!prev) {
                changes.push({ type: 'character', id, name: state.name, change: '新增角色' });
            } else {
                if (prev.location !== state.location) {
                    changes.push({ type: 'character', id, name: state.name, field: 'location', from: prev.location, to: state.location });
                }
                if (prev.powerLevel !== state.powerLevel) {
                    changes.push({ type: 'character', id, name: state.name, field: 'powerLevel', from: prev.powerLevel, to: state.powerLevel });
                }
                if (prev.status !== state.status) {
                    changes.push({ type: 'character', id, name: state.name, field: 'status', from: prev.status, to: state.status });
                }
            }
        }

        for (const [id, state] of Object.entries(currentStates.relationshipStates || {})) {
            const prev = prevSnapshot.relationshipStates?.[id];
            if (!prev) {
                changes.push({ type: 'relationship', id, name: state.name, change: '新增关系' });
            } else if (prev.strength !== state.strength || prev.type !== state.type) {
                changes.push({ type: 'relationship', id, name: state.name, field: 'strength/type', from: `${prev.type}(${prev.strength})`, to: `${state.type}(${state.strength})` });
            }
        }

        for (const [id, state] of Object.entries(currentStates.foreshadowingStates || {})) {
            const prev = prevSnapshot.foreshadowingStates?.[id];
            if (!prev) {
                changes.push({ type: 'foreshadowing', id, name: state.name, change: '埋下伏笔' });
            } else if (prev.status !== state.status) {
                changes.push({ type: 'foreshadowing', id, name: state.name, field: 'status', from: prev.status, to: state.status });
            }
        }

        return { isNew: false, changes };
    }

    _diffStates(statesA, statesB) {
        const changes = [];
        const allIds = new Set([...Object.keys(statesA || {}), ...Object.keys(statesB || {})]);

        for (const id of allIds) {
            const a = statesA?.[id];
            const b = statesB?.[id];
            if (!a && b) {
                changes.push({ id, name: b.name, change: '新增', details: b });
            } else if (a && !b) {
                changes.push({ id, name: a.name, change: '移除', details: a });
            } else if (a && b) {
                const fields = {};
                for (const key of Object.keys(a)) {
                    if (key !== 'id' && a[key] !== b[key] && typeof a[key] !== 'object') {
                        fields[key] = { from: a[key], to: b[key] };
                    }
                }
                if (Object.keys(fields).length > 0) {
                    changes.push({ id, name: a.name || b.name, change: '变更', fields });
                }
            }
        }

        return changes;
    }
}

module.exports = new StateSnapshotService();
