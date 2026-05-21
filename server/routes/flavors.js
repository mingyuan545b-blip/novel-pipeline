const express = require('express');
const router = express.Router();
const dialectRegistry = require('../services/dialectRegistry');
const speechStyleRegistry = require('../services/speechStyleRegistry');
const namingStyleRegistry = require('../services/namingStyleRegistry');
const memeLexicon = require('../services/memeLexicon');
const worldviewTemplateRegistry = require('../services/worldviewTemplateRegistry');
const characterArchetypeRegistry = require('../services/characterArchetypeRegistry');
const genreProfileRegistry = require('../services/genreProfileRegistry');
const systemPersonaRegistry = require('../services/systemPersonaRegistry');
const store = require('../store');

router.get('/naming-styles/infer', (req, res) => {
    const genre = req.query.genre || '';
    const inferred = namingStyleRegistry.inferFromGenre(genre);
    res.json({ genre, inferred: inferred ? { id: inferred.id, label: inferred.label, tag: inferred.tag } : null });
});

router.get('/naming-styles', (req, res) => {
    res.json(namingStyleRegistry.list());
});

router.get('/naming-styles/:id', (req, res) => {
    const style = namingStyleRegistry.get(req.params.id);
    if (!style) return res.status(404).json({ error: 'Naming style not found' });
    res.json(style);
});

router.get('/naming-styles/:id/preview', (req, res) => {
    const style = namingStyleRegistry.get(req.params.id);
    if (!style) return res.status(404).json({ error: 'Naming style not found' });
    const intensity = req.query.intensity || 'medium';
    const prompt = namingStyleRegistry.buildPromptBlock(req.params.id, intensity);
    res.json({ id: style.id, label: style.label, tag: style.tag, intensity, prompt });
});

router.get('/dialects', (req, res) => {
    const dialects = dialectRegistry.getAllRegions();
    const detailed = dialects.map(d => {
        const full = dialectRegistry.getDialect(d.region);
        return {
            region: d.region,
            label: d.label,
            description: d.description,
            examples: full?.examples || {}
        };
    });
    res.json(detailed);
});

router.get('/dialects/:region', (req, res) => {
    const dialect = dialectRegistry.getDialect(req.params.region);
    if (!dialect) return res.status(404).json({ error: 'Dialect not found' });
    res.json(dialect);
});

router.get('/dialects/:region/preview', (req, res) => {
    const { region } = req.params;
    const intensity = req.query.intensity || 'medium';
    const charName = req.query.charName || '角色';
    const dialect = dialectRegistry.getDialect(region);
    if (!dialect) return res.status(404).json({ error: 'Dialect not found' });

    const prompt = dialectRegistry.getDialectPromptForCharacter(charName, region, intensity);
    const example = dialect.examples?.[intensity] || dialect.examples?.medium || '';
    res.json({
        region,
        label: dialect.label,
        intensity,
        prompt,
        example,
        features: {
            sentenceFinal: dialect.features?.sentenceFinal?.slice(0, 5) || [],
            pronouns: dialect.features?.pronouns || {},
            vocabulary: Object.entries(dialect.features?.vocabulary || {}).slice(0, 8)
        }
    });
});

router.get('/speech-styles', (req, res) => {
    const styles = speechStyleRegistry.getAllStyles();
    const detailed = styles.map(s => {
        const full = speechStyleRegistry.getStyle(s.id);
        return {
            id: s.id,
            label: s.label,
            description: s.description,
            examples: full?.examples || {}
        };
    });
    res.json(detailed);
});

router.get('/speech-styles/:id', (req, res) => {
    const style = speechStyleRegistry.getStyle(req.params.id);
    if (!style) return res.status(404).json({ error: 'Speech style not found' });
    res.json(style);
});

router.get('/speech-styles/:id/preview', (req, res) => {
    const { id } = req.params;
    const intensity = req.query.intensity || 'medium';
    const charName = req.query.charName || '角色';
    const style = speechStyleRegistry.getStyle(id);
    if (!style) return res.status(404).json({ error: 'Speech style not found' });

    const prompt = speechStyleRegistry.getStylePromptForCharacter(charName, id, intensity);
    const example = style.examples?.[intensity] || style.examples?.medium || '';
    res.json({
        id,
        label: style.label,
        intensity,
        prompt,
        example,
        features: {
            metaphorMap: Object.entries(style.features?.metaphorMap || {}).slice(0, 6),
            slangMap: Object.entries(style.features?.slangMap || {}).slice(0, 6),
            catchphrases: style.features?.catchphrases?.slice(0, 6) || [],
            signaturePhrases: style.features?.signaturePhrases?.slice(0, 6) || []
        }
    });
});

router.post('/preview-combined', (req, res) => {
    const { dialectRegion, dialectIntensity, speechStyle, speechStyleIntensity, charName } = req.body;
    const name = charName || '角色';
    const parts = [];

    if (dialectRegion) {
        const dialect = dialectRegistry.getDialect(dialectRegion);
        if (dialect) {
            const di = dialectIntensity || 'medium';
            parts.push({
                type: 'dialect',
                label: dialect.label,
                intensity: di,
                example: dialect.examples?.[di] || dialect.examples?.medium || '',
                prompt: dialectRegistry.getDialectPromptForCharacter(name, dialectRegion, di)
            });
        }
    }

    if (speechStyle) {
        const style = speechStyleRegistry.getStyle(speechStyle);
        if (style) {
            const si = speechStyleIntensity || 'medium';
            parts.push({
                type: 'style',
                label: style.label,
                intensity: si,
                example: style.examples?.[si] || style.examples?.medium || '',
                prompt: speechStyleRegistry.getStylePromptForCharacter(name, speechStyle, si)
            });
        }
    }

    if (dialectRegion && speechStyle) {
        const dialect = dialectRegistry.getDialect(dialectRegion);
        const style = speechStyleRegistry.getStyle(speechStyle);
        if (dialect && style) {
            parts.push({
                type: 'combined',
                note: `方言"${dialect.label}"降为轻度底色 + 风格"${style.label}"为主味`,
                principle: '风格是主味，方言是若隐若现的底色。读者先记住风格，再隐约感到口音'
            });
        }
    }

    res.json({ charName: name, parts });
});

router.get('/system-personas', (req, res) => {
    const list = systemPersonaRegistry.list();
    const summary = list.map(p => ({
        id: p.id,
        label: p.label,
        tag: p.tag,
        category: p.category,
        description: p.description,
        recommendedGenres: p.recommendedGenres || []
    }));
    res.json(summary);
});

router.get('/system-personas/:id', (req, res) => {
    const persona = systemPersonaRegistry.get(req.params.id);
    if (!persona) return res.status(404).json({ error: 'System persona not found' });
    res.json(persona);
});

router.get('/system-personas/:id/preview', (req, res) => {
    const persona = systemPersonaRegistry.get(req.params.id);
    if (!persona) return res.status(404).json({ error: 'System persona not found' });
    res.json({
        id: persona.id,
        label: persona.label,
        tag: persona.tag,
        writerPrompt: systemPersonaRegistry.buildWriterPrompt(req.params.id),
        reviewerPrompt: systemPersonaRegistry.buildReviewerPrompt(req.params.id),
        interface: persona.interface,
        interactionRules: persona.interactionRules,
        dialogueExamples: persona.dialogueExamples
    });
});

router.get('/genre-profiles', (req, res) => {
    res.json(genreProfileRegistry.list());
});

router.get('/genre-profiles/resolve', (req, res) => {
    const genre = req.query.genre || '';
    const profile = genreProfileRegistry.resolve(genre);
    if (!profile) return res.json({ genre, profile: null });
    const fullConfig = genreProfileRegistry.buildFullConfig(genre);
    res.json({ genre, profile, fullConfig });
});

router.get('/genre-profiles/:id', (req, res) => {
    const profile = genreProfileRegistry.get(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Genre profile not found' });
    res.json(profile);
});

router.get('/character-archetypes', (req, res) => {
    const list = characterArchetypeRegistry.list();
    const summary = list.map(a => ({
        id: a.id,
        label: a.label,
        tag: a.tag,
        description: a.description,
        roleInStory: a.roleInStory,
        recommendedSpeechStyles: a.recommendedSpeechStyles || [],
        recommendedDialects: a.recommendedDialects || []
    }));
    res.json(summary);
});

router.get('/character-archetypes/:id', (req, res) => {
    const archetype = characterArchetypeRegistry.get(req.params.id);
    if (!archetype) return res.status(404).json({ error: 'Character archetype not found' });
    res.json(archetype);
});

router.get('/character-archetypes/:id/preview', (req, res) => {
    const archetype = characterArchetypeRegistry.get(req.params.id);
    if (!archetype) return res.status(404).json({ error: 'Character archetype not found' });
    const writerPrompt = characterArchetypeRegistry.buildWriterPrompt(req.params.id);
    const reviewerPrompt = characterArchetypeRegistry.buildReviewerPrompt(req.params.id);
    res.json({
        id: archetype.id,
        label: archetype.label,
        tag: archetype.tag,
        writerPrompt,
        reviewerPrompt,
        dimensions: archetype.dimensions,
        sceneReactions: archetype.sceneReactions
    });
});

router.get('/meme-lexicon', (req, res) => {
    res.json(memeLexicon.listMemes());
});

router.get('/humor-devices', (req, res) => {
    res.json(memeLexicon.listDevices());
});

router.get('/worldview-templates', (req, res) => {
    res.json(worldviewTemplateRegistry.list());
});

router.get('/worldview-templates/infer', (req, res) => {
    const genre = req.query.genre || '';
    const inferred = worldviewTemplateRegistry.inferFromGenre(genre);
    res.json({ genre, inferred: inferred ? { id: inferred.id, label: inferred.label, tag: inferred.tag } : null });
});

router.get('/worldview-templates/:id/phase', (req, res) => {
    const template = worldviewTemplateRegistry.get(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    const chapter = parseInt(req.query.chapter) || 1;
    const total = parseInt(req.query.total) || 100;
    const phase = worldviewTemplateRegistry.getCurrentPhase(req.params.id, chapter, total);
    res.json({ templateId: req.params.id, chapter, totalChapters: total, phase });
});

router.post('/reload', (req, res) => {
    dialectRegistry.reload();
    speechStyleRegistry.reload();
    namingStyleRegistry.reload();
    memeLexicon.reload();
    worldviewTemplateRegistry.reload();
    characterArchetypeRegistry.reload();
    genreProfileRegistry.reload();
    systemPersonaRegistry.reload();
    res.json({ success: true, message: 'All registries reloaded' });
});

router.get('/project-prompt/:projectId', (req, res) => {
    const { projectId } = req.params;
    const project = store.getItem('projects', projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const allMats = store.listItems('materials').filter(m => m.projectId === projectId && !m.archived);
    const characters = allMats.filter(m => m.type === 'character');

    const result = {
        projectId,
        projectName: project.name || '',
        characters: [],
        writerPrompt: '',
        reviewerPrompt: ''
    };

    const dialectOnlyChars = [];
    const styleChars = [];
    const bothChars = [];

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
            bothChars.push(char);
        } else if (char.dialectRegion) {
            dialectOnlyChars.push(char);
        } else if (char.speechStyle) {
            styleChars.push(char);
        }

        if (char.dialectRegion || char.speechStyle) {
            result.characters.push(info);
        }
    }

    const flavorChars = characters.filter(c => c.dialectRegion || c.speechStyle);
    if (flavorChars.length > 0) {
        result.writerPrompt = speechStyleRegistry.buildCombinedPromptBlock(flavorChars);
        result.reviewerPrompt = speechStyleRegistry.buildCombinedReviewBlock(flavorChars);
    }

    res.json(result);
});

module.exports = router;
