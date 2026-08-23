const MAP_LEVELS = [
    { key: 'universe', label: '宇宙', icon: '🌌', parent: null },
    { key: 'star-domain', label: '星域', icon: '✦', parent: 'universe' },
    { key: 'planet', label: '星球', icon: '🪐', parent: 'star-domain' },
    { key: 'continent', label: '州/大陆', icon: '🏔', parent: 'planet' },
    { key: 'country', label: '国/区域', icon: '🏰', parent: 'continent' },
    { key: 'city', label: '城市/地点', icon: '🏘', parent: 'country' }
];

const LEVEL_KEYS = MAP_LEVELS.map(l => l.key);

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
    for (const mat of materials) {
        const content = mat.currentContent || mat.initialContent || '';
        for (const other of materials) {
            if (mat.id === other.id) continue;
            if (content.includes(other.name) || (other.name.length >= 2 && content.includes(other.name))) {
                const exists = connections.find(c => (c.from === mat.id && c.to === other.id) || (c.from === other.id && c.to === mat.id));
                if (!exists) connections.push({ from: mat.id, fromName: mat.name, to: other.id, toName: other.name });
            }
        }
    }
    return connections;
}

module.exports = { MAP_LEVELS, LEVEL_KEYS, MAP_W, MAP_H, analyzeSpatialPosition, analyzeConnections };
