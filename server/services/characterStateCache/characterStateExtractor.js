const logger = require('../../shared/logger');
const store = require('../../store');
const { getCharacterStateSchema } = require('../../config/characterStateSchemas');
const { getDataContext } = require('../dataContext');

function extractStateFromMaterial(material, genreId) {
    const schema = getCharacterStateSchema(genreId);
    const content = material.currentContent || material.initialContent || '';
    const state = {};

    if (schema && schema.fields) {
        for (const [key, field] of Object.entries(schema.fields)) {
            const label = field.label || key;
            const regex = new RegExp(`【${label}】(.+)`);
            const match = content.match(regex);
            if (match) {
                state[key] = field.type === 'number' ? Number(match[1]) || field.defaultValue : match[1].trim();
            } else if (field.defaultValue !== undefined) {
                state[key] = field.defaultValue;
            }
        }
    }

    state.name = material.name;
    state.roleLevel = material.roleLevel || 'npc';
    return state;
}

async function extractBindsForCharacter(projectId, characterMaterial) {
    const binds = [];
    const content = characterMaterial.currentContent || characterMaterial.initialContent || '';
    const equipMatch = content.match(/【(?:装备|法宝|持有物|武器)】(.+)/);
    if (equipMatch) {
        const items = equipMatch[1].split(/[、,，]/).map(s => s.trim()).filter(Boolean);
        for (const item of items) {
            binds.push({ type: 'equipment', name: item, status: 'active', priority: 6 });
        }
    }
    const techMatch = content.match(/【(?:功法|武技|技能|修炼)】(.+)/);
    if (techMatch) {
        const items = techMatch[1].split(/[、,，]/).map(s => s.trim()).filter(Boolean);
        for (const item of items) {
            binds.push({ type: 'technique', name: item, status: 'active', priority: 8 });
        }
    }
    return binds;
}

async function extractRelationsForCharacter(projectId, characterMaterial) {
    const rels = [];
    const content = characterMaterial.currentContent || characterMaterial.initialContent || '';
    const relMatch = content.match(/【(?:关系|人际)】(.+)/);
    if (relMatch) {
        const parts = relMatch[1].split(/[;；]/).map(s => s.trim()).filter(Boolean);
        for (const part of parts) {
            const m = part.match(/(.+?)[：:](.+)/);
            if (m) {
                rels.push({ targetName: m[1].trim(), relLabel: m[2].trim(), relType: 'other', strength: 50 });
            }
        }
    }
    return rels;
}

async function detectGenre(projectId) {
    try {
        const ctx = await getDataContext(projectId);
        const project = await ctx.getProject();
        if (project?.genre) return project.genre;
        const styleTemplate = project?.styleTemplateId ? await store.getItem('style-templates', project.styleTemplateId) : null;
        if (styleTemplate?.genre) return styleTemplate.genre;
    } catch (_) { logger.warn('characterStateExtrac', '[char-state-extractor]', _.message || _); }
    return 'high-martial';
}

module.exports = { extractStateFromMaterial, extractBindsForCharacter, extractRelationsForCharacter, detectGenre };
