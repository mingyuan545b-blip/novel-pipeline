const logger = require('../shared/logger');
const path = require('path');
const fs = require('fs');
const { findFFmpeg, concatenateVideos, burnSubtitles } = require('./ffmpegUtils');
const { synthesizeSceneDialogues, composeSceneVideos } = require('./exportHelpers');

const OUTPUT_BASE = path.join(__dirname, '..', '..', 'output');

async function exportComicEpisode(projectId, episodeData, options = {}) {
    const episodeDir = path.join(OUTPUT_BASE, projectId, 'episodes', `EP${String(episodeData.episode || 1).padStart(2, '0')}`);
    if (!fs.existsSync(episodeDir)) {
        fs.mkdirSync(episodeDir, { recursive: true });
    }

    const scenes = episodeData.scenes || [];
    if (scenes.length === 0) {
        return { success: false, error: 'No scenes provided' };
    }

    const ffmpegPath = findFFmpeg();
    if (!ffmpegPath) {
        return { success: false, error: 'FFmpeg not found. Please install FFmpeg first.' };
    }

    const ttsResults = await synthesizeSceneDialogues(scenes, episodeDir, options);
    const concatList = await composeSceneVideos(scenes, ttsResults, episodeDir, ffmpegPath);

    if (concatList.length === 0) {
        return { success: false, error: 'No valid video segments to concatenate' };
    }

    const episodeTitle = episodeData.title || `EP${String(episodeData.episode || 1).padStart(2, '0')}`;
    const finalOutput = path.join(episodeDir, `${episodeTitle}.mp4`);

    try {
        await concatenateVideos(concatList, finalOutput, ffmpegPath);
    } catch (e) {
        return { success: false, error: `Concatenation failed: ${e.message}`, ttsResults, episodeDir };
    }

    const subtitleOutput = path.join(episodeDir, `${episodeTitle}.srt`);
    try {
        await generateSRT(scenes, ttsResults, subtitleOutput);
    } catch (e) {
        logger.error('export', '[EXPORT] SRT generation error:', e.message);
    }

    if (options.burnSubtitles && fs.existsSync(subtitleOutput)) {
        const subbedOutput = path.join(episodeDir, `${episodeTitle}_subtitled.mp4`);
        try {
            await burnSubtitles(finalOutput, subtitleOutput, subbedOutput, ffmpegPath);
        } catch (e) {
            logger.error('export', '[EXPORT] Burn subtitles error:', e.message);
        }
    }

    return {
        success: true,
        episodeTitle,
        outputPath: finalOutput,
        subtitlePath: fs.existsSync(subtitleOutput) ? subtitleOutput : null,
        sceneCount: concatList.length,
        ttsGenerated: ttsResults.filter(r => !r.error && !r.noDialogue).length,
        episodeDir,
        fileSize: fs.statSync(finalOutput).size
    };
}

async function generateSRT(scenes, ttsResults, outputPath) {
    let srtContent = '';
    let index = 1;
    let currentTime = 0;

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const dialogue = scene.dialogue || scene.subtitle || '';
        if (!dialogue) continue;

        const duration = scene.duration || 5;
        const startTime = formatSRTTime(currentTime);
        const endTime = formatSRTTime(currentTime + duration);

        srtContent += `${index}\n${startTime} --> ${endTime}\n${dialogue}\n\n`;
        index++;
        currentTime += duration;
    }

    fs.writeFileSync(outputPath, '\ufeff' + srtContent, 'utf-8');
    return outputPath;
}

function formatSRTTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

module.exports = {
    exportComicEpisode,
    findFFmpeg,
    mergeVideoAudio: require('./ffmpegUtils').mergeVideoAudio,
    imageToVideo: require('./ffmpegUtils').imageToVideo,
    imageToVideoWithAudio: require('./ffmpegUtils').imageToVideoWithAudio,
    concatenateVideos,
    burnSubtitles,
    generateSRT
};
