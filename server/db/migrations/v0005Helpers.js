/**
 * Character state extraction and building utilities for v0005 migration.
 */
const logger = require('../../shared/logger');

function extractCharacterUpdates(materialManagerOutput) {
    const updates = [];
    try {
        let parsed;
        if (typeof materialManagerOutput === 'string') {
            const jsonMatch = materialManagerOutput.match(/\{[\s\S]*"updates"[\s\S]*\}/);
            if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        } else {
            parsed = materialManagerOutput;
        }
        if (parsed?.updates && Array.isArray(parsed.updates)) {
            for (const update of parsed.updates) {
                const changeObj = update.changes || update.stateChanges || update.fields;
                if (update.type === 'character' && changeObj) {
                    for (const [key, value] of Object.entries(changeObj)) {
                        const actualValue = value && typeof value === 'object' && 'to' in value ? value.to : value;
                        updates.push({
                            name: update.name || update.characterName,
                            characterId: update.characterId,
                            dataKey: key,
                            stateValue: actualValue,
                            chapterNumber: update.chapterNumber
                        });
                    }
                }
            }
        }
    } catch (e) {
        logger.warn('migration-v0005', `Failed to parse materialManagerOutput: ${e.message}`);
    }
    return updates;
}

function buildCharacterStateRecord(charId, charName, chapterNum, updates, projectId) {
    if (!charId || !charName || !chapterNum) return null;
    const delta = {};
    const changedFields = [];
    for (const update of updates) {
        if (update.dataKey && update.stateValue !== undefined) {
            delta[update.dataKey] = update.stateValue;
            if (!changedFields.includes(update.dataKey)) changedFields.push(update.dataKey);
        }
    }
    if (Object.keys(delta).length === 0) return null;
    return {
        id: `cs-${charId}-ch${chapterNum}`, projectId,
        characterId: charId, characterName: charName, chapterNumber: chapterNum,
        delta: JSON.stringify(delta), stateChangedFields: JSON.stringify(changedFields),
        previousChapterState: null, updatedAt: new Date().toISOString()
    };
}

function inferType(value) {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

function detectGenre(styleProfile) {
    const genre = styleProfile?.genre || styleProfile?.genreType || '';
    if (genre.includes('修仙') || genre.includes('玄幻') || genre.includes('仙侠')) return 'high-martial';
    if (genre.includes('都市') || genre.includes('现实') || genre.includes('现代')) return 'urban-reality';
    if (genre.includes('科幻') || genre.includes('末世') || genre.includes('赛博')) return 'sci-fi-apocalypse';
    return 'high-martial';
}

module.exports = { extractCharacterUpdates, buildCharacterStateRecord, inferType, detectGenre };
