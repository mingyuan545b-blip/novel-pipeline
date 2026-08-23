const { getCharacterStateSchema, formatStateForPrompt } = require('../../config/characterStateSchemas');

function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 2);
}

function buildBriefText(name, stateJson, genreId) {
    const schema = getCharacterStateSchema(genreId);
    const parts = [name];
    const importantKeys = ['cultivationStage', 'combatPowerLevel', 'jobTitle', 'position', 'factionName'];
    for (const key of importantKeys) {
        if (stateJson[key]) {
            const field = schema.fields[key];
            parts.push(`${field ? field.label : key}=${stateJson[key]}`);
        }
    }
    if (stateJson.hp !== undefined && stateJson.hp !== 100) parts.push(`HP=${stateJson.hp}`);
    if (stateJson.mp !== undefined && stateJson.mp !== 100) parts.push(`MP=${stateJson.mp}`);
    return parts.join(' | ');
}

function buildSummaryText(name, stateJson, bindsJson, relationsJson, genreId) {
    const schema = getCharacterStateSchema(genreId);
    const lines = [];
    const stateParts = [];
    const trackedKeys = ['hp', 'mp', 'energy', 'stamina', 'combatPower', 'combatPowerLevel', 'cultivationStage', 'spiritualRoot', 'meridianStatus', 'position', 'factionName', 'jobTitle', 'company', 'socialStatus', 'psychologicalState', 'radiation', 'vehicle', 'personality', 'speakingTone', 'signatureDetail', 'protagonistMirror', 'independentStance', 'fateArc', 'innerConflict'];
    for (const key of trackedKeys) {
        if (stateJson[key] !== undefined && stateJson[key] !== '' && stateJson[key] !== null) {
            const field = schema.fields[key];
            const label = field ? field.label : key;
            stateParts.push(`${label}=${stateJson[key]}`);
        }
    }
    lines.push(`【${name}】${stateParts.join(', ')}`);
    const binds = Array.isArray(bindsJson) ? bindsJson : [];
    if (binds.length > 0) {
        const bindParts = binds.filter(b => b.status !== 'lost' && b.status !== 'consumed').map(b => {
            let s = b.name;
            if (b.masteryLevel) s += `(${b.masteryLevel})`;
            else if (b.brief) s += `(${b.brief.substring(0, 30)})`;
            return s;
        });
        if (bindParts.length > 0) lines.push(`持有: ${bindParts.join(', ')}`);
    }
    const rels = Array.isArray(relationsJson) ? relationsJson : [];
    if (rels.length > 0) {
        const relParts = rels.slice(0, 5).map(r => `${r.relLabel || r.relType}:${r.targetName}`);
        if (relParts.length > 0) lines.push(`关系: ${relParts.join(', ')}`);
    }
    return lines.join('\n');
}

function buildDetailText(name, stateJson, bindsJson, relationsJson, deltaJson, genreId) {
    const schema = getCharacterStateSchema(genreId);
    const lines = [];
    const formatted = formatStateForPrompt(stateJson, schema, 'detailed');
    if (formatted) {
        lines.push(`【${name}】\n${formatted}`);
    } else {
        lines.push(`【${name}】${JSON.stringify(stateJson)}`);
    }
    const binds = Array.isArray(bindsJson) ? bindsJson : [];
    if (binds.length > 0) {
        lines.push('\n绑定物:');
        for (const b of binds) {
            if (b.status === 'lost' || b.status === 'consumed') continue;
            let desc = `  ${b.type}/${b.name}`;
            if (b.masteryLevel) desc += ` [${b.masteryLevel}]`;
            if (b.brief) desc += ` - ${b.brief}`;
            if (b.personalNotes) desc += ` (${b.personalNotes})`;
            lines.push(desc);
        }
    }
    const rels = Array.isArray(relationsJson) ? relationsJson : [];
    if (rels.length > 0) {
        lines.push('\n关系:');
        for (const r of rels) {
            lines.push(`  ${r.targetName}: ${r.relLabel || r.relType} (强度${r.strength || 50})`);
        }
    }
    const delta = deltaJson && typeof deltaJson === 'object' && Object.keys(deltaJson).length > 0 ? deltaJson : null;
    if (delta) {
        lines.push('\n本章变化:');
        for (const [key, change] of Object.entries(delta)) {
            const field = schema.fields[key];
            const label = field ? field.label : key;
            lines.push(`  ${label}: ${change.from} → ${change.to}`);
        }
    }
    return lines.join('\n');
}

module.exports = { estimateTokens, buildBriefText, buildSummaryText, buildDetailText };
