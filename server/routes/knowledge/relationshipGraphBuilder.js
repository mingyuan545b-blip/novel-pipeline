const logger = require('../../shared/logger');
const store = require('../../store');
const stateSnapshot = require('../../services/stateSnapshot');
const { getGenreRelationTypes, getGenreRelationTypeKeywords } = require('../../config/genreEntitySchemas');
const { detectGenre } = require('../../services/genreConfig');

const CATEGORY_SEMANTIC_GROUPS = {
    'char-friendly': ['lover', 'friend', 'ally', 'colleague', 'neighbor', 'benefactor', 'secret-admirer', 'teammate', 'contractor', 'guide', 'mentor', 'survivor', 'informant', 'detective', 'witness', 'victim'],
    'char-hostile': ['rival', 'enemy', 'target', 'suspect', 'deceiver', 'bounty-target', 'accomplice', 'sacrifice'],
    'family': ['family', 'master', 'disciple', 'fellow-disciple'],
    'hierarchy': ['subordinate', 'handler', 'asset', 'system-bound', 'ruler']
};

const REL_TYPE_TO_CATEGORY = {};
for (const [category, types] of Object.entries(CATEGORY_SEMANTIC_GROUPS)) {
    for (const t of types) { REL_TYPE_TO_CATEGORY[t] = category; }
}

function inferCategory(relType, relLabel, genreRelationTypes, genreKeywords) {
    if (relType && REL_TYPE_TO_CATEGORY[relType]) return REL_TYPE_TO_CATEGORY[relType];
    if (genreRelationTypes.includes(relType)) {
        for (const types of Object.values(CATEGORY_SEMANTIC_GROUPS)) {
            if (types.includes(relType)) return REL_TYPE_TO_CATEGORY[relType] || 'other';
        }
    }
    const text = (relLabel || '').toLowerCase();
    for (const [type, words] of Object.entries(genreKeywords)) {
        if (words.some(w => text.includes(w))) return REL_TYPE_TO_CATEGORY[type] || 'other';
    }
    return 'other';
}

function findCharNode(nodes, name) {
    if (!name) return null;
    return nodes.find(n => n.name.includes(name) || name.includes(n.name));
}

async function buildRelationshipGraph(projectId) {
    let styleProfile = null;
    try { const project = await store.getItem('projects', projectId); styleProfile = project?.styleProfile || null; } catch (_) { logger.warn('relationshipGraphBui', '[graph-builder]', _.message || _); }

    const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
    const characters = materials.filter(m => m.type === 'character');
    const relationships = materials.filter(m => m.type === 'relationship');

    const nodes = characters.map(c => ({
        id: c.id, label: c.name, name: c.name, type: 'character',
        description: (c.currentContent || c.initialContent || '').substring(0, 100),
        group: c.tags?.[0] || 'default', faction: c.parentFaction || '', role: ''
    }));

    let genreId = '';
    try { const genre = detectGenre(styleProfile); if (genre) genreId = genre.id; } catch (_) { logger.warn('relationshipGraphBui', '[graph-builder]', _.message || _); }
    const genreRelationTypes = getGenreRelationTypes(genreId);
    const genreKeywords = getGenreRelationTypeKeywords(genreId);

    const edges = [];

    for (const r of relationships) {
        const content = r.currentContent || r.initialContent || '';
        const nameParts = r.name.split(/[与和及→←↔\-：:]/);
        if (nameParts.length >= 2) {
            const source = findCharNode(nodes, nameParts[0].trim());
            const target = findCharNode(nodes, nameParts[nameParts.length - 1].trim());
            if (source && target) {
                edges.push({ id: r.id, source: source.id, target: target.id,
                    label: r.name.replace(/^[^与和及]*[与和及]/, '').trim() || content.substring(0, 30),
                    category: inferCategory('other', r.name, genreRelationTypes, genreKeywords),
                    type: 'other', strength: 50, detail: content.substring(0, 100) });
            }
        }
    }

    let registryIdToName = {};
    try { const regEntities = await store.queryItems('entity-registry', er => er.projectId === projectId); for (const re of regEntities) { registryIdToName[re.id] = re.name; } } catch (_) { logger.warn('relationshipGraphBui', '[graph-builder]', _.message || _); }

    try {
        const charRels = await store.queryItems('character-relations', cr => cr.projectId === projectId);
        for (const cr of charRels) {
            const fromName = registryIdToName[cr.fromCharacterId] || '';
            const toName = registryIdToName[cr.toCharacterId] || '';
            const fromNode = fromName ? findCharNode(nodes, fromName) : null;
            const toNode = toName ? findCharNode(nodes, toName) : null;
            if (fromNode && toNode) {
                const existing = edges.find(e => (e.source === fromNode.id && e.target === toNode.id) || (e.source === toNode.id && e.target === fromNode.id));
                if (!existing) {
                    edges.push({ id: cr.id, source: fromNode.id, target: toNode.id,
                        label: cr.relLabel || cr.relType || '关系',
                        category: inferCategory(cr.relType, cr.relLabel, genreRelationTypes, genreKeywords),
                        type: cr.relType || 'other', strength: cr.strength || 50, detail: cr.notes || '' });
                }
            }
        }
    } catch (crErr) { logger.warn('relationshipGraphBui', '[KNOWLEDGE] character_relations query failed:', crErr.message); }

    try {
        const entityRels = await store.queryItems('entity-relations', er => er.projectId === projectId);
        for (const er of entityRels) {
            const fromName = registryIdToName[er.fromEntityId] || '';
            const toName = registryIdToName[er.toEntityId] || '';
            const fromNode = fromName ? findCharNode(nodes, fromName) : null;
            const toNode = toName ? findCharNode(nodes, toName) : null;
            if (fromNode && toNode) {
                const existing = edges.find(e => (e.source === fromNode.id && e.target === toNode.id) || (e.source === toNode.id && e.target === fromNode.id));
                if (!existing) {
                    edges.push({ id: er.id, source: fromNode.id, target: toNode.id,
                        label: er.relLabel || er.relType || '关系',
                        category: inferCategory(er.relType, er.relLabel, genreRelationTypes, genreKeywords),
                        type: er.relType || 'other', strength: er.strength || 50, detail: er.notes || '' });
                }
            }
        }
    } catch (_) { logger.warn('relationshipGraphBui', '[graph-builder]', _.message || _); }

    try {
        const entityRegistry = require('../../services/entityRegistry');
        const regEntities = await entityRegistry.getEntitiesForProject(projectId);
        for (const re of regEntities) { const node = nodes.find(n => n.id === re.id || n.name === re.name); if (node && re.roleLevel) node.role = re.roleLevel; }
    } catch (_) { logger.warn('relationshipGraphBui', '[graph-builder]', _.message || _); }

    const snapshot = await stateSnapshot.getSnapshot(projectId);
    if (snapshot?.relationshipStates) {
        for (const edge of edges) { const state = snapshot.relationshipStates[edge.id]; if (state) { edge.type = state.type || edge.type; edge.strength = state.strength || edge.strength; } }
    }

    return { nodes, edges };
}

module.exports = { buildRelationshipGraph };
