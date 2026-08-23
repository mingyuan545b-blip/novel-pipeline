const store = require('../../store');
const stateSnapshot = require('../stateSnapshot');
const { SEVERITY, CHECK_DIMENSIONS } = require('./constants');
const ext = require('./extractors');

async function checkCharacterConsistency(projectId, chapterNumber, chapterContent) {
    const issues = [];
    const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
    const characters = materials.filter(m => m.type === 'character');
    const snapshot = await stateSnapshot.getSnapshot(projectId, chapterNumber - 1);
    if (!snapshot) return issues;

    for (const char of characters) {
        const charState = snapshot.characterStates?.[char.id];
        if (!charState) continue;
        const name = char.name;
        const content = chapterContent || '';

        if (content.includes(name)) {
            if (charState.status === '死亡' || charState.status === '已故') {
                const context = ext.extractContext(content, name, 50);
                if (!context.includes('回忆') && !context.includes('幻象') && !context.includes('梦中') && !context.includes('记忆')) {
                    issues.push({
                        dimension: CHECK_DIMENSIONS.CHARACTER, severity: SEVERITY.CRITICAL,
                        title: '已故角色出现',
                        description: `角色"${name}"在第${charState.lastAppearanceChapter || '?'}章已标记为"${charState.status}"，但在第${chapterNumber}章中直接出现`,
                        characterId: char.id, characterName: name, context,
                        suggestion: `确认"${name}"是否真的复活，或改为回忆/梦境/幻象形式出现`
                    });
                }
            }
            if (charState.location && charState.location !== '未知' && charState.location !== '行踪不定') {
                const locationMentions = ext.findLocationMentions(content, name, charState.location);
                if (locationMentions.conflict) {
                    issues.push({
                        dimension: CHECK_DIMENSIONS.CHARACTER, severity: SEVERITY.WARNING,
                        title: '角色位置矛盾',
                        description: `角色"${name}"上一章在"${charState.location}"，本章出现位置可能矛盾`,
                        characterId: char.id, characterName: name, expectedLocation: charState.location,
                        context: locationMentions.context, suggestion: `确认"${name}"是否有合理的移动理由`
                    });
                }
            }
            const charContent = char.currentContent || char.initialContent || '';
            const traits = ext.extractCharacterTraits(charContent);
            for (const trait of traits) {
                const contradiction = ext.detectTraitContradiction(content, name, trait);
                if (contradiction) {
                    issues.push({
                        dimension: CHECK_DIMENSIONS.CHARACTER, severity: SEVERITY.WARNING,
                        title: '角色性格矛盾',
                        description: `角色"${name}"的设定特征"${trait}"与本章行为可能矛盾`,
                        characterId: char.id, characterName: name, trait, context: contradiction,
                        suggestion: `确认"${name}"的行为是否符合其性格设定，或是否有合理的变化理由`
                    });
                }
            }
        }
    }
    return issues;
}

async function checkRelationshipConsistency(projectId, chapterNumber, chapterContent) {
    const issues = [];
    const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
    const relationships = materials.filter(m => m.type === 'relationship');
    const snapshot = await stateSnapshot.getSnapshot(projectId, chapterNumber - 1);
    if (!snapshot) return issues;

    for (const rel of relationships) {
        const relState = snapshot.relationshipStates?.[rel.id];
        if (!relState) continue;
        const content = chapterContent || '';
        const relName = rel.name;

        if (ext.mentionsRelationship(content, relName)) {
            const relType = relState.type;
            const strength = relState.strength;
            if (relType === '敌对' || relType === '仇恨') {
                const friendlyInteraction = ext.detectFriendlyInteraction(content, relName);
                if (friendlyInteraction && strength > 70) {
                    issues.push({
                        dimension: CHECK_DIMENSIONS.RELATIONSHIP, severity: SEVERITY.WARNING,
                        title: '敌对关系友好互动',
                        description: `关系"${relName}"标记为${relType}(强度${strength})，但本章出现友好互动`,
                        relationshipId: rel.id, relationshipName: relName, context: friendlyInteraction,
                        suggestion: '确认是否有合理的和解/伪装/利益交换等解释'
                    });
                }
            }
            if (relType === '恋人' || relType === '亲密') {
                const hostileInteraction = ext.detectHostileInteraction(content, relName);
                if (hostileInteraction && strength > 60) {
                    issues.push({
                        dimension: CHECK_DIMENSIONS.RELATIONSHIP, severity: SEVERITY.WARNING,
                        title: '亲密关系敌对互动',
                        description: `关系"${relName}"标记为${relType}(强度${strength})，但本章出现敌对互动`,
                        relationshipId: rel.id, relationshipName: relName, context: hostileInteraction,
                        suggestion: '确认是否有合理的误会/考验/转变等解释'
                    });
                }
            }
        }
    }
    return issues;
}

module.exports = { checkCharacterConsistency, checkRelationshipConsistency };
