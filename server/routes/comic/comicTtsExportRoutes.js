const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const tts = require('../../services/tts');
const exportService = require('../../services/export');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { VALIDATION_ERROR, INTERNAL_ERROR } = ERROR_CODES;

router.get('/tts/voices', (req, res) => {
    res.json(tts.getVoices());
});

router.post('/tts/synthesize', async (req, res) => {
    try {
        const { text, voice, rate, volume, pitch, projectId, fileName } = req.body;
        if (!text) return res.apiError(VALIDATION_ERROR.statusCode, 'text is required', VALIDATION_ERROR.code);
        const outputDir = projectId
            ? path.join(__dirname, '..', '..', '..', 'output', projectId, 'tts')
            : path.join(__dirname, '..', '..', '..', 'output', 'tts');
        const outputPath = path.join(outputDir, fileName || `tts_${Date.now()}.mp3`);
        const result = await tts.synthesize(text, { voice, rate, volume, pitch, outputPath });
        res.json(result);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/tts/synthesize-batch', async (req, res) => {
    try {
        const { dialogues, projectId, episodeNumber } = req.body;
        if (!dialogues || !Array.isArray(dialogues)) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'dialogues array is required', VALIDATION_ERROR.code);
        }
        const outputDir = projectId
            ? path.join(__dirname, '..', '..', '..', 'output', projectId, 'tts', `ep${String(episodeNumber || 1).padStart(2, '0')}`)
            : path.join(__dirname, '..', '..', '..', 'output', 'tts');
        const result = await tts.synthesizeChapterDialogue(dialogues, outputDir, req.body);
        res.json(result);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/export-episode', async (req, res) => {
    try {
        const { projectId, episode, scenes, title, defaultVoice, burnSubtitles } = req.body;
        if (!projectId || !scenes || !Array.isArray(scenes)) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'projectId and scenes array are required', VALIDATION_ERROR.code);
        }
        const result = await exportService.exportComicEpisode(projectId, {
            episode, title, scenes
        }, { defaultVoice, burnSubtitles });
        res.json(result);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/export-status/:projectId', (req, res) => {
    const episodesDir = path.join(__dirname, '..', '..', '..', 'output', req.params.projectId, 'episodes');
    if (!fs.existsSync(episodesDir)) return res.json({ episodes: [] });
    const episodes = fs.readdirSync(episodesDir).filter(d => {
        const full = path.join(episodesDir, d);
        return fs.statSync(full).isDirectory();
    }).map(d => {
        const full = path.join(episodesDir, d);
        const files = fs.readdirSync(full);
        const mp4Files = files.filter(f => f.endsWith('.mp4') && !f.includes('_audio') && !f.includes('scene_'));
        return { name: d, videos: mp4Files, totalFiles: files.length };
    });
    res.json({ episodes });
});

module.exports = router;
