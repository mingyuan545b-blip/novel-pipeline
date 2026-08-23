const store = require('../store');
const logger = require('../shared/logger');

function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 2);
}

class ItemDefinition {
    async createDefinition(projectId, defType, name, descLevels = {}) {
        const id = descLevels.id || `def-${defType}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const briefDesc = descLevels.briefDesc || '';
        const summaryDesc = descLevels.summaryDesc || '';
        const detailDesc = descLevels.detailDesc || '';
        const loreDesc = descLevels.loreDesc || '';
        const entry = {
            id,
            projectId,
            defType,
            name,
            rarity: descLevels.rarity || 'common',
            briefDesc,
            summaryDesc,
            detailDesc,
            loreDesc,
            briefTokens: estimateTokens(briefDesc),
            summaryTokens: estimateTokens(summaryDesc),
            detailTokens: estimateTokens(detailDesc),
            loreTokens: estimateTokens(loreDesc),
            propertiesJson: descLevels.propertiesJson || {},
            constraintsJson: descLevels.constraintsJson || {},
            sourceChapter: descLevels.sourceChapter || null,
            tags: descLevels.tags || [],
            ...descLevels
        };
        entry.id = id;
        entry.projectId = projectId;
        entry.defType = defType;
        entry.name = name;
        entry.briefDesc = briefDesc;
        entry.summaryDesc = summaryDesc;
        entry.detailDesc = detailDesc;
        entry.loreDesc = loreDesc;
        await store.setItem('item-definitions', id, entry);
        return entry;
    }

    async getDefinition(defId) {
        return await store.getItem('item-definitions', defId);
    }

    async queryDefinitions(projectId, options = {}) {
        return await store.queryItems('item-definitions', { projectId, ...options });
    }

    async getDescForBudget(defId, tokenBudget) {
        const def = await store.getItem('item-definitions', defId);
        if (!def) return { text: '', tokens: 0, level: 'none' };

        if (tokenBudget <= 100 && def.briefDesc) {
            return { text: def.briefDesc, tokens: def.briefTokens || 0, level: 'brief' };
        }
        if (tokenBudget <= 500 && def.summaryDesc) {
            return { text: def.summaryDesc, tokens: def.summaryTokens || 0, level: 'summary' };
        }
        if (tokenBudget <= 1500 && def.detailDesc) {
            return { text: def.detailDesc, tokens: def.detailTokens || 0, level: 'detail' };
        }
        if (def.loreDesc) {
            return { text: def.loreDesc, tokens: def.loreTokens || 0, level: 'lore' };
        }
        return { text: def.detailDesc || def.summaryDesc || def.briefDesc || '', tokens: def.detailTokens || 0, level: 'detail' };
    }

    async updateDefinition(defId, updates) {
        const def = await store.getItem('item-definitions', defId);
        if (!def) return null;
        const merged = { ...def, ...updates };
        if (updates.briefDesc !== undefined) merged.briefTokens = estimateTokens(updates.briefDesc);
        if (updates.summaryDesc !== undefined) merged.summaryTokens = estimateTokens(updates.summaryDesc);
        if (updates.detailDesc !== undefined) merged.detailTokens = estimateTokens(updates.detailDesc);
        if (updates.loreDesc !== undefined) merged.loreTokens = estimateTokens(updates.loreDesc);
        await store.setItem('item-definitions', defId, merged);
        return merged;
    }
}

const itemDefinition = new ItemDefinition();
module.exports = itemDefinition;
