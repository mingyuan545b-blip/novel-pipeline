const express = require('express');
const router = express.Router();
const worldviewTemplateRegistry = require('../services/worldviewTemplateRegistry');
const characterArchetypeRegistry = require('../services/characterArchetypeRegistry');
const genreProfileRegistry = require('../services/genreProfileRegistry');
const systemPersonaRegistry = require('../services/systemPersonaRegistry');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND } = ERROR_CODES;

// --- System Personas ---
router.get('/system-personas', (req, res) => {
    const list = systemPersonaRegistry.list();
    const summary = list.map(p => ({
        id: p.id, label: p.label, tag: p.tag, category: p.category,
        description: p.description, recommendedGenres: p.recommendedGenres || []
    }));
    res.json(summary);
});

router.get('/system-personas/:id', (req, res) => {
    const persona = systemPersonaRegistry.get(req.params.id);
    if (!persona) return res.apiError(NOT_FOUND.statusCode, 'System persona not found', NOT_FOUND.code);
    res.json(persona);
});

router.get('/system-personas/:id/preview', (req, res) => {
    const persona = systemPersonaRegistry.get(req.params.id);
    if (!persona) return res.apiError(NOT_FOUND.statusCode, 'System persona not found', NOT_FOUND.code);
    res.json({
        id: persona.id, label: persona.label, tag: persona.tag,
        writerPrompt: systemPersonaRegistry.buildWriterPrompt(req.params.id),
        reviewerPrompt: systemPersonaRegistry.buildReviewerPrompt(req.params.id),
        interface: persona.interface, interactionRules: persona.interactionRules,
        dialogueExamples: persona.dialogueExamples
    });
});

// --- Genre Profiles ---
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
    if (!profile) return res.apiError(NOT_FOUND.statusCode, 'Genre profile not found', NOT_FOUND.code);
    res.json(profile);
});

// --- Character Archetypes ---
router.get('/character-archetypes', (req, res) => {
    const list = characterArchetypeRegistry.list();
    const summary = list.map(a => ({
        id: a.id, label: a.label, tag: a.tag, description: a.description,
        roleInStory: a.roleInStory, recommendedSpeechStyles: a.recommendedSpeechStyles || [],
        recommendedDialects: a.recommendedDialects || []
    }));
    res.json(summary);
});

router.get('/character-archetypes/:id', (req, res) => {
    const archetype = characterArchetypeRegistry.get(req.params.id);
    if (!archetype) return res.apiError(NOT_FOUND.statusCode, 'Character archetype not found', NOT_FOUND.code);
    res.json(archetype);
});

router.get('/character-archetypes/:id/preview', (req, res) => {
    const archetype = characterArchetypeRegistry.get(req.params.id);
    if (!archetype) return res.apiError(NOT_FOUND.statusCode, 'Character archetype not found', NOT_FOUND.code);
    res.json({
        id: archetype.id, label: archetype.label, tag: archetype.tag,
        writerPrompt: characterArchetypeRegistry.buildWriterPrompt(req.params.id),
        reviewerPrompt: characterArchetypeRegistry.buildReviewerPrompt(req.params.id),
        dimensions: archetype.dimensions, sceneReactions: archetype.sceneReactions
    });
});

// --- Worldview Templates ---
router.get('/worldview-templates', (req, res) => {
    res.json(worldviewTemplateRegistry.list());
});

router.get('/worldview-templates/infer', (req, res) => {
    const genre = req.query.genre || '';
    const inferred = worldviewTemplateRegistry.inferFromGenre(genre);
    res.json({ genre, inferred: inferred ? { id: inferred.id, label: inferred.label, tag: inferred.tag } : null });
});

router.get('/worldview-templates/:id', (req, res) => {
    const template = worldviewTemplateRegistry.get(req.params.id);
    if (!template) return res.apiError(NOT_FOUND.statusCode, 'Template not found', NOT_FOUND.code);
    res.json(template);
});

router.get('/worldview-templates/:id/phase', (req, res) => {
    const template = worldviewTemplateRegistry.get(req.params.id);
    if (!template) return res.apiError(NOT_FOUND.statusCode, 'Template not found', NOT_FOUND.code);
    const chapter = parseInt(req.query.chapter) || 1;
    const total = parseInt(req.query.total) || 100;
    const phase = worldviewTemplateRegistry.getCurrentPhase(req.params.id, chapter, total);
    res.json({ templateId: req.params.id, chapter, totalChapters: total, phase });
});

module.exports = router;
