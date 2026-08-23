const store = require('../store');
const { getSnapshot } = require('./stateSnapshotQueries');

async function restoreSnapshot(projectId, chapterNumber) {
    const snapshot = await getSnapshot(projectId, chapterNumber);
    if (!snapshot) throw new Error(`找不到第${chapterNumber}章的快照`);

    const materials = await store.queryItems('materials', m => m.projectId === projectId);
    for (const [id, state] of Object.entries(snapshot.characterStates || {})) {
        const mat = materials.find(m => m.id === id);
        if (mat) {
            await store.setItem('materials', id, {
                ...mat, currentContent: state.content, restoredFromSnapshot: chapterNumber
            });
        }
    }
    return { restored: true, chapterNumber, affectedMaterials: Object.keys(snapshot.characterStates || {}).length };
}

function diffStates(statesA, statesB) {
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

async function getDiff(projectId, chapterA, chapterB) {
    const snapA = await getSnapshot(projectId, chapterA);
    const snapB = await getSnapshot(projectId, chapterB);
    if (!snapA || !snapB) throw new Error('找不到指定章节的快照');
    return {
        chapterA, chapterB,
        characterChanges: diffStates(snapA.characterStates, snapB.characterStates),
        relationshipChanges: diffStates(snapA.relationshipStates, snapB.relationshipStates),
        equipmentChanges: diffStates(snapA.equipmentStates, snapB.equipmentStates),
        foreshadowingChanges: diffStates(snapA.foreshadowingStates, snapB.foreshadowingStates)
    };
}

function computeDiff(prevSnapshot, currentStates) {
    if (!prevSnapshot) return { isNew: true, changes: [] };
    const changes = [];

    for (const [id, state] of Object.entries(currentStates.characterStates || {})) {
        const prev = prevSnapshot.characterStates?.[id];
        if (!prev) {
            changes.push({ type: 'character', id, name: state.name, change: '新增角色' });
        } else {
            if (prev.location !== state.location) changes.push({ type: 'character', id, name: state.name, field: 'location', from: prev.location, to: state.location });
            if (prev.powerLevel !== state.powerLevel) changes.push({ type: 'character', id, name: state.name, field: 'powerLevel', from: prev.powerLevel, to: state.powerLevel });
            if (prev.status !== state.status) changes.push({ type: 'character', id, name: state.name, field: 'status', from: prev.status, to: state.status });
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

module.exports = { restoreSnapshot, getDiff, diffStates, computeDiff };
