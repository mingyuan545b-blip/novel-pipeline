const express = require('express');
const router = express.Router();
const dialectRegistry = require('../services/dialectRegistry');
const speechStyleRegistry = require('../services/speechStyleRegistry');
const namingStyleRegistry = require('../services/namingStyleRegistry');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND } = ERROR_CODES;

// --- Naming Styles ---
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
    if (!style) return res.apiError(NOT_FOUND.statusCode, 'Naming style not found', NOT_FOUND.code);
    res.json(style);
});

router.get('/naming-styles/:id/preview', (req, res) => {
    const style = namingStyleRegistry.get(req.params.id);
    if (!style) return res.apiError(NOT_FOUND.statusCode, 'Naming style not found', NOT_FOUND.code);
    const intensity = req.query.intensity || 'medium';
    const prompt = namingStyleRegistry.buildPromptBlock(req.params.id, intensity);
    res.json({ id: style.id, label: style.label, tag: style.tag, intensity, prompt });
});

// --- Dialects ---
router.get('/dialects', (req, res) => {
    const dialects = dialectRegistry.getAllRegions();
    const detailed = dialects.map(d => {
        const full = dialectRegistry.getDialect(d.region);
        return { region: d.region, label: d.label, description: d.description, examples: full?.examples || {} };
    });
    res.json(detailed);
});

router.get('/dialects/:region', (req, res) => {
    const dialect = dialectRegistry.getDialect(req.params.region);
    if (!dialect) return res.apiError(NOT_FOUND.statusCode, 'Dialect not found', NOT_FOUND.code);
    res.json(dialect);
});

router.get('/dialects/:region/preview', (req, res) => {
    const { region } = req.params;
    const intensity = req.query.intensity || 'medium';
    const charName = req.query.charName || '角色';
    const dialect = dialectRegistry.getDialect(region);
    if (!dialect) return res.apiError(NOT_FOUND.statusCode, 'Dialect not found', NOT_FOUND.code);
    const prompt = dialectRegistry.getDialectPromptForCharacter(charName, region, intensity);
    const example = dialect.examples?.[intensity] || dialect.examples?.medium || '';
    res.json({
        region, label: dialect.label, intensity, prompt, example,
        features: {
            sentenceFinal: dialect.features?.sentenceFinal?.slice(0, 5) || [],
            pronouns: dialect.features?.pronouns || {},
            vocabulary: Object.entries(dialect.features?.vocabulary || {}).slice(0, 8)
        }
    });
});

// --- Speech Styles ---
router.get('/speech-styles', (req, res) => {
    const styles = speechStyleRegistry.getAllStyles();
    const detailed = styles.map(s => {
        const full = speechStyleRegistry.getStyle(s.id);
        return { id: s.id, label: s.label, description: s.description, examples: full?.examples || {} };
    });
    res.json(detailed);
});

router.get('/speech-styles/:id', (req, res) => {
    const style = speechStyleRegistry.getStyle(req.params.id);
    if (!style) return res.apiError(NOT_FOUND.statusCode, 'Speech style not found', NOT_FOUND.code);
    res.json(style);
});

router.get('/speech-styles/:id/preview', (req, res) => {
    const { id } = req.params;
    const intensity = req.query.intensity || 'medium';
    const charName = req.query.charName || '角色';
    const style = speechStyleRegistry.getStyle(id);
    if (!style) return res.apiError(NOT_FOUND.statusCode, 'Speech style not found', NOT_FOUND.code);
    const prompt = speechStyleRegistry.getStylePromptForCharacter(charName, id, intensity);
    const example = style.examples?.[intensity] || style.examples?.medium || '';
    res.json({
        id, label: style.label, intensity, prompt, example,
        features: {
            metaphorMap: Object.entries(style.features?.metaphorMap || {}).slice(0, 6),
            slangMap: Object.entries(style.features?.slangMap || {}).slice(0, 6),
            catchphrases: style.features?.catchphrases?.slice(0, 6) || [],
            signaturePhrases: style.features?.signaturePhrases?.slice(0, 6) || []
        }
    });
});

// --- Combined Preview ---
router.post('/preview-combined', (req, res) => {
    const { dialectRegion, dialectIntensity, speechStyle, speechStyleIntensity, charName } = req.body;
    const name = charName || '角色';
    const parts = [];

    if (dialectRegion) {
        const dialect = dialectRegistry.getDialect(dialectRegion);
        if (dialect) {
            const di = dialectIntensity || 'medium';
            parts.push({
                type: 'dialect', label: dialect.label, intensity: di,
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
                type: 'style', label: style.label, intensity: si,
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

module.exports = router;
