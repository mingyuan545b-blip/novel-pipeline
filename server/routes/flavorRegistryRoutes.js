const express = require('express');
const router = express.Router();
const memeLexicon = require('../services/memeLexicon');
const dialectRegistry = require('../services/dialectRegistry');
const speechStyleRegistry = require('../services/speechStyleRegistry');
const namingStyleRegistry = require('../services/namingStyleRegistry');
const worldviewTemplateRegistry = require('../services/worldviewTemplateRegistry');
const characterArchetypeRegistry = require('../services/characterArchetypeRegistry');
const genreProfileRegistry = require('../services/genreProfileRegistry');
const systemPersonaRegistry = require('../services/systemPersonaRegistry');

const flavorLanguageRoutes = require('./flavorLanguageRoutes');
const flavorNarrativeRoutes = require('./flavorNarrativeRoutes');

// Mount sub-routers
router.use(flavorLanguageRoutes);
router.use(flavorNarrativeRoutes);

// --- Meme Lexicon ---
router.get('/meme-lexicon', (req, res) => {
    res.json(memeLexicon.listMemes());
});

router.get('/humor-devices', (req, res) => {
    res.json(memeLexicon.listDevices());
});

// --- Reload ---
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

module.exports = router;
