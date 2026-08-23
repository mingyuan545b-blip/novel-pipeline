const express = require('express');
const router = express.Router();
const dialectRegistry = require('../services/dialectRegistry');
const speechStyleRegistry = require('../services/speechStyleRegistry');
const speechStylePrompts = require('../services/speechStylePrompts');
const store = require('../store');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND } = ERROR_CODES;

router.get('/project-prompt/:projectId', async (req, res) => {
    const { projectId } = req.params;
    const project = await store.getItem('projects', projectId);
    if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

    const allMats = (await store.listItems('materials')).filter(m => m.projectId === projectId && !m.archived);
    const characters = allMats.filter(m => m.type === 'character');

    const result = {
        projectId,
        projectName: project.name || '',
        characters: [],
        writerPrompt: '',
        reviewerPrompt: ''
    };

    for (const char of characters) {
        const info = {
            id: char.id,
            name: char.name,
            dialectRegion: char.dialectRegion || null,
            dialectIntensity: char.dialectIntensity || null,
            speechStyle: char.speechStyle || null,
            speechStyleIntensity: char.speechStyleIntensity || null,
            dialectPrompt: '',
            stylePrompt: '',
            combinedNote: ''
        };

        if (char.dialectRegion) {
            info.dialectPrompt = dialectRegistry.getDialectPromptForCharacter(char.name, char.dialectRegion, char.dialectIntensity || 'medium');
        }
        if (char.speechStyle) {
            info.stylePrompt = speechStyleRegistry.getStylePromptForCharacter(char.name, char.speechStyle, char.speechStyleIntensity || 'medium');
        }
        if (char.dialectRegion && char.speechStyle) {
            const dialect = dialectRegistry.getDialect(char.dialectRegion);
            const style = speechStyleRegistry.getStyle(char.speechStyle);
            if (dialect && style) {
                info.combinedNote = `方言"${dialect.label}"降为轻度底色 + 风格"${style.label}"为主味`;
            }
        }

        if (char.dialectRegion || char.speechStyle) {
            result.characters.push(info);
        }
    }

    const flavorChars = characters.filter(c => c.dialectRegion || c.speechStyle);
    if (flavorChars.length > 0) {
        result.writerPrompt = speechStylePrompts.buildCombinedPromptBlock(flavorChars);
        result.reviewerPrompt = speechStylePrompts.buildCombinedReviewBlock(flavorChars);
    }

    res.json(result);
});

module.exports = router;
