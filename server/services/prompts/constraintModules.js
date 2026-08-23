const { CONSTRAINT_MODULES } = require('./constraintModuleDefs');
const { AGENT_CONSTRAINT_MAP } = require('./constraintAgentMap');

function buildFoundationFromModules(agentType, genrePlugin = null) {
    const moduleIds = AGENT_CONSTRAINT_MAP[agentType] || ['role-boundary'];

    const skipIds = new Set();
    if (genrePlugin?.foundation?.skipConstraints) {
        for (const id of genrePlugin.foundation.skipConstraints) {
            skipIds.add(id);
        }
    }

    const genreId = genrePlugin?.id || null;

    const sections = [];
    for (const id of moduleIds) {
        if (skipIds.has(id)) continue;
        const mod = CONSTRAINT_MODULES[id];
        if (!mod) continue;
        if (mod.applicableGenres != null && genreId && !mod.applicableGenres.includes(genreId)) continue;
        const moduleText = mod.text || (mod.rules && mod.rules.length > 0 ? mod.rules.join('\n') : '');
        if (moduleText) sections.push(moduleText);
    }

    if (genrePlugin?.foundation?.additionalFoundationRules) {
        for (const rule of genrePlugin.foundation.additionalFoundationRules) {
            sections.push(rule);
        }
    }

    return sections.join('\n\n');
}

function listConstraintModules() {
    return Object.entries(CONSTRAINT_MODULES).map(([id, mod]) => ({
        id,
        label: mod.label || mod.name,
        scope: mod.scope || mod.priority,
        applicableGenres: mod.applicableGenres || null,
        charCount: (mod.text || mod.rules?.join('\n') || '').length,
        text: mod.text || (mod.rules || []).join('\n')
    }));
}

function getAgentConstraintIds(agentType) {
    return AGENT_CONSTRAINT_MAP[agentType] || ['role-boundary'];
}

module.exports = {
    CONSTRAINT_MODULES,
    AGENT_CONSTRAINT_MAP,
    buildFoundationFromModules,
    listConstraintModules,
    getAgentConstraintIds
};
