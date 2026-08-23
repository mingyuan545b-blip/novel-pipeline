const logger = require('../../shared/logger');

function formatContextForPrompt(context, options = {}) {
    const { maxLength = 8000, includeMetadata = false, separator = '\n---\n' } = options;
    if (!context) return '';
    if (typeof context === 'string') return context.substring(0, maxLength);

    const parts = [];
    if (context.characters && context.characters.length > 0) {
        parts.push('【角色状态】\n' + context.characters.map(c => {
            let line = `${c.name || c.id}`;
            if (c.state) {
                const stateStr = Object.entries(c.state).filter(([k, v]) => k !== '_lastStateId' && k !== 'stateChangedFields' && v !== undefined && v !== null).map(([k, v]) => `${k}=${v}`).join(', ');
                if (stateStr) line += `: ${stateStr}`;
            }
            return line;
        }).join('\n'));
    }

    if (context.worldview && Object.keys(context.worldview).length > 0) {
        parts.push('【世界观】\n' + Object.entries(context.worldview).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n'));
    }

    if (context.foreshadowing && context.foreshadowing.length > 0) {
        parts.push('【伏笔】\n' + context.foreshadowing.map(f => `${f.name || f.id}: ${f.progress || '进行中'}`).join('\n'));
    }

    if (context.timeline && context.timeline.length > 0) {
        parts.push('【时间线】\n' + context.timeline.map(t => `${t.chapter || t.time}: ${t.event || t.description || ''}`).join('\n'));
    }

    if (context.relations && context.relations.length > 0) {
        parts.push('【关系】\n' + context.relations.map(r => `${r.from}→${r.to}: ${r.label || r.type || ''}`).join('\n'));
    }

    if (includeMetadata && context.metadata) {
        parts.push('【元数据】\n' + JSON.stringify(context.metadata, null, 2));
    }

    const result = parts.join(separator);
    return result.length > maxLength ? result.substring(0, maxLength) + '\n...(截断)' : result;
}

function formatCharacterStateForPrompt(characterState, schema) {
    if (!characterState) return '';
    const lines = [];
    for (const [key, value] of Object.entries(characterState)) {
        if (key === '_lastStateId' || key === 'stateChangedFields' || value === undefined || value === null) continue;
        const fieldDef = schema?.fields?.[key];
        const label = fieldDef?.label || key;
        lines.push(`${label}: ${value}`);
    }
    return lines.join(', ');
}

function formatMaterialBrief(material) {
    if (!material) return '';
    const name = material.name || material.id || '';
    const type = material.type || '';
    const content = (material.currentContent || material.initialContent || '').substring(0, 100);
    return `【${name}】(${type}) ${content}`;
}

module.exports = { formatContextForPrompt, formatCharacterStateForPrompt, formatMaterialBrief };
