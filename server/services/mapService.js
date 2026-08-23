const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { MAP_LEVELS, LEVEL_KEYS, analyzeSpatialPosition, analyzeConnections } = require('./mapLayout');

function getMapLevels() { return MAP_LEVELS; }

async function getRootNode(projectId) {
    const nodes = await store.queryItems('map-nodes', { projectId });
    let root = nodes.find(n => n.level === 'universe');
    if (!root) {
        const id = uuidv4();
        const now = new Date().toISOString();
        root = { id, projectId, parentId: null, level: 'universe', name: '宇宙', description: '', x: 0, y: 0, width: 800, height: 600, color: '#1a1a2e', factionId: null, materialIds: [], tags: [], createdAt: now, updatedAt: now };
        await store.setItem('map-nodes', id, root);
    }
    return root;
}

async function getNode(projectId, nodeId) {
    const node = await store.getItem('map-nodes', nodeId);
    if (!node || node.projectId !== projectId) return null;
    return node;
}

async function getChildren(projectId, parentId) {
    return (await store.queryItems('map-nodes', { projectId }))
        .filter(n => n.parentId === parentId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

async function getTree(projectId) {
    const nodes = await store.queryItems('map-nodes', { projectId });
    const root = nodes.find(n => n.level === 'universe') || await getRootNode(projectId);
    function buildTree(node) {
        const children = nodes.filter(n => n.parentId === node.id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        return { ...node, children: children.map(buildTree) };
    }
    return buildTree(root);
}

async function createNode(projectId, data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const parentLevelIdx = data.parentId ? LEVEL_KEYS.indexOf((await store.getItem('map-nodes', data.parentId) || {}).level) : -1;
    const childLevel = parentLevelIdx >= 0 && parentLevelIdx < LEVEL_KEYS.length - 1 ? LEVEL_KEYS[parentLevelIdx + 1] : data.level || 'star-domain';
    const node = { id, projectId, parentId: data.parentId || null, level: data.level || childLevel, name: data.name || '未命名', description: data.description || '', x: data.x || Math.random() * 600, y: data.y || Math.random() * 400, width: data.width || 200, height: data.height || 150, color: data.color || '', factionId: data.factionId || null, factionName: data.factionName || '', materialIds: data.materialIds || [], tags: data.tags || [], sortOrder: data.sortOrder || 0, createdAt: now, updatedAt: now };
    await store.setItem('map-nodes', id, node);
    return node;
}

async function updateNode(projectId, nodeId, data) {
    const node = await store.getItem('map-nodes', nodeId);
    if (!node || node.projectId !== projectId) return null;
    const updated = { ...node, ...data, id: nodeId, projectId, updatedAt: new Date().toISOString() };
    await store.setItem('map-nodes', nodeId, updated);
    return updated;
}

async function deleteNode(projectId, nodeId) {
    const node = await store.getItem('map-nodes', nodeId);
    if (!node || node.projectId !== projectId) return false;
    if (node.level === 'universe') return false;
    const allNodes = await store.queryItems('map-nodes', { projectId });
    const toDelete = new Set();
    function collectDescendants(id) { toDelete.add(id); allNodes.filter(n => n.parentId === id).forEach(n => collectDescendants(n.id)); }
    collectDescendants(nodeId);
    for (const id of toDelete) await store.deleteItem('map-nodes', id);
    return { deleted: toDelete.size };
}

async function batchCreateNodes(projectId, parentId, nodesData) {
    const created = [];
    const parent = await store.getItem('map-nodes', parentId);
    const parentLevelIdx = parent ? LEVEL_KEYS.indexOf(parent.level) : -1;
    const childLevel = parentLevelIdx >= 0 && parentLevelIdx < LEVEL_KEYS.length - 1 ? LEVEL_KEYS[parentLevelIdx + 1] : 'star-domain';
    for (let i = 0; i < nodesData.length; i++) {
        const data = nodesData[i];
        const node = createNode(projectId, { ...data, parentId, level: data.level || childLevel, sortOrder: data.sortOrder || i });
        created.push(node);
    }
    return created;
}

async function getFactionTerritories(projectId, factionId) {
    return (await store.queryItems('map-nodes', { projectId })).filter(n => n.factionId === factionId);
}

async function importFromMaterials(projectId, parentId) {
    const materials = await store.queryItems('materials', { projectId });
    const locationMaterials = materials.filter(m => {
        if (m.type !== 'location') return false;
        const name = m.name || '';
        if (name.includes('写法') || name.includes('指南') || name.includes('手法') || name.includes('技巧') || name.includes('原则') || name.includes('节奏') || name.includes('悬念') || name.includes('开篇') || name.includes('塑造') || name.includes('战斗') || name.includes('信息释放') || name.includes('冰山')) return false;
        return true;
    });
    const existingNodes = await store.queryItems('map-nodes', { projectId });
    let skipped = 0;
    const created = [];
    const nodeMap = {};
    for (const mat of locationMaterials) {
        const existing = existingNodes.find(n => n.materialIds && n.materialIds.includes(mat.id));
        if (existing) { skipped++; nodeMap[mat.id] = existing; continue; }
        let level = 'country';
        const name = mat.name || '';
        if (name.includes('星域') || name.includes('宇宙')) level = 'star-domain';
        else if (name.includes('星球') || name.includes('行星')) level = 'planet';
        else if (name.includes('大陆') || name.includes('州') || name.includes('星系') || name.includes('旋臂')) level = 'continent';
        else if (name.includes('帝国') || name.includes('联邦') || name.includes('王国') || name.includes('国')) level = 'country';
        else if (name.includes('城') || name.includes('镇') || name.includes('村') || name.includes('港') || name.includes('地') || name.includes('星') || name.includes('遗迹')) level = 'city';
        const content = mat.currentContent || mat.initialContent || '';
        const pos = analyzeSpatialPosition(name, content);
        const node = createNode(projectId, { parentId, name, level, x: pos.x, y: pos.y, description: content.substring(0, 200), materialIds: [mat.id], tags: ['imported', mat.type] });
        created.push(node);
        nodeMap[mat.id] = node;
    }
    const connections = analyzeConnections(locationMaterials);
    const resolvedConnections = connections.map(c => { const fromNode = nodeMap[c.from]; const toNode = nodeMap[c.to]; if (!fromNode || !toNode) return null; return { from: fromNode.id, fromName: fromNode.name, to: toNode.id, toName: toNode.name }; }).filter(Boolean);
    return { created, count: created.length, skipped, total: locationMaterials.length, connections: resolvedConnections };
}

module.exports = { getMapLevels, getRootNode, getNode, getChildren, getTree, createNode, updateNode, deleteNode, batchCreateNodes, getFactionTerritories, importFromMaterials };
