const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const MAP_LEVELS = [
    { key: 'universe', label: '宇宙', icon: '🌌', parent: null },
    { key: 'star-domain', label: '星域', icon: '✦', parent: 'universe' },
    { key: 'planet', label: '星球', icon: '🪐', parent: 'star-domain' },
    { key: 'continent', label: '州/大陆', icon: '🏔', parent: 'planet' },
    { key: 'country', label: '国/区域', icon: '🏰', parent: 'continent' },
    { key: 'city', label: '城市/地点', icon: '🏘', parent: 'country' }
];

const LEVEL_KEYS = MAP_LEVELS.map(l => l.key);

function getMapLevels() {
    return MAP_LEVELS;
}

function getRootNode(projectId) {
    const nodes = store.queryItems('map-nodes', { projectId });
    let root = nodes.find(n => n.level === 'universe');
    if (!root) {
        const id = uuidv4();
        const now = new Date().toISOString();
        root = {
            id,
            projectId,
            parentId: null,
            level: 'universe',
            name: '宇宙',
            description: '',
            x: 0,
            y: 0,
            width: 800,
            height: 600,
            color: '#1a1a2e',
            factionId: null,
            materialIds: [],
            tags: [],
            createdAt: now,
            updatedAt: now
        };
        store.setItem('map-nodes', id, root);
    }
    return root;
}

function getNode(projectId, nodeId) {
    const node = store.getItem('map-nodes', nodeId);
    if (!node || node.projectId !== projectId) return null;
    return node;
}

function getChildren(projectId, parentId) {
    return store.queryItems('map-nodes', { projectId })
        .filter(n => n.parentId === parentId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function getTree(projectId) {
    const nodes = store.queryItems('map-nodes', { projectId });
    const root = nodes.find(n => n.level === 'universe') || getRootNode(projectId);

    function buildTree(node) {
        const children = nodes.filter(n => n.parentId === node.id)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        return {
            ...node,
            children: children.map(buildTree)
        };
    }

    return buildTree(root);
}

function createNode(projectId, data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const parentLevelIdx = data.parentId ? LEVEL_KEYS.indexOf(
        (store.getItem('map-nodes', data.parentId) || {}).level
    ) : -1;
    const childLevel = parentLevelIdx >= 0 && parentLevelIdx < LEVEL_KEYS.length - 1
        ? LEVEL_KEYS[parentLevelIdx + 1]
        : data.level || 'star-domain';

    const node = {
        id,
        projectId,
        parentId: data.parentId || null,
        level: data.level || childLevel,
        name: data.name || '未命名',
        description: data.description || '',
        x: data.x || Math.random() * 600,
        y: data.y || Math.random() * 400,
        width: data.width || 200,
        height: data.height || 150,
        color: data.color || '',
        factionId: data.factionId || null,
        factionName: data.factionName || '',
        materialIds: data.materialIds || [],
        tags: data.tags || [],
        sortOrder: data.sortOrder || 0,
        createdAt: now,
        updatedAt: now
    };
    store.setItem('map-nodes', id, node);
    return node;
}

function updateNode(projectId, nodeId, data) {
    const node = store.getItem('map-nodes', nodeId);
    if (!node || node.projectId !== projectId) return null;
    const updated = { ...node, ...data, id: nodeId, projectId, updatedAt: new Date().toISOString() };
    store.setItem('map-nodes', nodeId, updated);
    return updated;
}

function deleteNode(projectId, nodeId) {
    const node = store.getItem('map-nodes', nodeId);
    if (!node || node.projectId !== projectId) return false;
    if (node.level === 'universe') return false;

    const allNodes = store.queryItems('map-nodes', { projectId });
    const toDelete = new Set();
    function collectDescendants(id) {
        toDelete.add(id);
        allNodes.filter(n => n.parentId === id).forEach(n => collectDescendants(n.id));
    }
    collectDescendants(nodeId);

    for (const id of toDelete) {
        store.deleteItem('map-nodes', id);
    }
    return { deleted: toDelete.size };
}

function batchCreateNodes(projectId, parentId, nodesData) {
    const created = [];
    const parent = store.getItem('map-nodes', parentId);
    const parentLevelIdx = parent ? LEVEL_KEYS.indexOf(parent.level) : -1;
    const childLevel = parentLevelIdx >= 0 && parentLevelIdx < LEVEL_KEYS.length - 1
        ? LEVEL_KEYS[parentLevelIdx + 1]
        : 'star-domain';

    for (let i = 0; i < nodesData.length; i++) {
        const data = nodesData[i];
        const node = createNode(projectId, {
            ...data,
            parentId,
            level: data.level || childLevel,
            sortOrder: data.sortOrder || i
        });
        created.push(node);
    }
    return created;
}

function getFactionTerritories(projectId, factionId) {
    return store.queryItems('map-nodes', { projectId })
        .filter(n => n.factionId === factionId);
}

const MAP_W = 1200;
const MAP_H = 800;
const MAP_CX = MAP_W / 2;
const MAP_CY = MAP_H / 2;

function analyzeSpatialPosition(name, content) {
    const text = (name + ' ' + (content || '')).toLowerCase();
    let angle = -1;
    let dist = 0.5;
    if (text.includes('银河系中心') || text.includes('银河中心')) { dist = 0.08; angle = 0; }
    else if (text.includes('核心区') || text.includes('第一旋臂')) { dist = 0.3; angle = Math.PI * 0.5; }
    else if (text.includes('第二旋臂')) { dist = 0.35; angle = Math.PI * 1.17; }
    else if (text.includes('第三旋臂') || text.includes('边缘区')) { dist = 0.4; angle = Math.PI * 1.83; }
    else if (text.includes('混沌区')) { dist = 0.6; angle = Math.PI * 0.17; }
    else if (text.includes('银河边缘') || text.includes('银河系边缘') || text.includes('真空地带')) { dist = 0.55; angle = Math.PI * 1.5; }
    else if (text.includes('边缘') || text.includes('外围')) { dist = 0.5; angle = Math.PI * 1.6; }
    else if (text.includes('交界') || text.includes('之间')) { dist = 0.35; angle = Math.PI * 0.75; }
    else if (text.includes('中心') || text.includes('核心')) { dist = 0.12; angle = 0; }
    if (angle === -1) {
        const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        angle = (hash % 360) * Math.PI / 180;
    }
    const nameHash = name.split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
    angle += (nameHash % 30 - 15) * Math.PI / 180;
    dist += ((nameHash % 100) / 1000 - 0.05);
    const maxR = Math.min(MAP_W, MAP_H) * 0.42;
    const r = dist * maxR;
    const x = MAP_CX + Math.cos(angle) * r;
    const y = MAP_CY + Math.sin(angle) * r;
    return { x: Math.round(Math.max(120, Math.min(MAP_W - 120, x))), y: Math.round(Math.max(80, Math.min(MAP_H - 80, y))) };
}

function analyzeConnections(materials) {
    const connections = [];
    const nameToIdx = {};
    materials.forEach((m, i) => { nameToIdx[m.name] = i; });
    for (const mat of materials) {
        const content = mat.currentContent || mat.initialContent || '';
        for (const other of materials) {
            if (mat.id === other.id) continue;
            if (content.includes(other.name) || (other.name.length >= 2 && content.includes(other.name))) {
                const exists = connections.find(c =>
                    (c.from === mat.id && c.to === other.id) || (c.from === other.id && c.to === mat.id));
                if (!exists) {
                    connections.push({ from: mat.id, fromName: mat.name, to: other.id, toName: other.name });
                }
            }
        }
    }
    return connections;
}

function importFromMaterials(projectId, parentId) {
    const materials = store.queryItems('materials', { projectId });
    const locationMaterials = materials.filter(m => {
        if (m.type !== 'location') return false;
        const name = m.name || '';
        if (name.includes('写法') || name.includes('指南') || name.includes('手法') ||
            name.includes('技巧') || name.includes('原则') || name.includes('节奏') ||
            name.includes('悬念') || name.includes('开篇') || name.includes('塑造') ||
            name.includes('战斗') || name.includes('信息释放') || name.includes('冰山')) return false;
        return true;
    });

    const existingNodes = store.queryItems('map-nodes', { projectId });
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

        const node = createNode(projectId, {
            parentId,
            name,
            level,
            x: pos.x,
            y: pos.y,
            description: content.substring(0, 200),
            materialIds: [mat.id],
            tags: ['imported', mat.type]
        });
        created.push(node);
        nodeMap[mat.id] = node;
    }

    const connections = analyzeConnections(locationMaterials);
    const resolvedConnections = connections.map(c => {
        const fromNode = nodeMap[c.from];
        const toNode = nodeMap[c.to];
        if (!fromNode || !toNode) return null;
        return { from: fromNode.id, fromName: fromNode.name, to: toNode.id, toName: toNode.name };
    }).filter(Boolean);

    return { created, count: created.length, skipped, total: locationMaterials.length, connections: resolvedConnections };
}

module.exports = {
    getMapLevels,
    getRootNode,
    getNode,
    getChildren,
    getTree,
    createNode,
    updateNode,
    deleteNode,
    batchCreateNodes,
    getFactionTerritories,
    importFromMaterials
};
