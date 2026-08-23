const path = require('path');
const fs = require('fs');
const tts = require('./tts');
const { findFFmpeg, createPlaceholderImage, imageToVideo, imageToVideoWithAudio, mergeVideoAudio } = require('./ffmpegUtils');

async function synthesizeSceneDialogues(scenes, episodeDir, options) {
    const ttsResults = [];
    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        if (scene.dialogue && scene.dialogue.trim()) {
            const audioPath = path.join(episodeDir, `scene_${String(i + 1).padStart(3, '0')}.mp3`);
            const subtitlePath = path.join(episodeDir, `scene_${String(i + 1).padStart(3, '0')}.vtt`);
            try {
                const result = await tts.synthesize(scene.dialogue, {
                    voice: scene.voice || options.defaultVoice || 'zh-CN-YunxiNeural',
                    rate: scene.rate || '+0%',
                    outputPath: audioPath,
                    subtitlePath
                });
                ttsResults.push({ index: i, ...result });
            } catch (e) {
                ttsResults.push({ index: i, error: e.message });
            }
        } else {
            ttsResults.push({ index: i, noDialogue: true });
        }
    }
    return ttsResults;
}

async function composeSceneVideos(scenes, ttsResults, episodeDir, ffmpegPath) {
    const concatList = [];
    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        let videoPath = scene.videoPath;
        let imagePath = scene.imagePath;

        if (!videoPath && !imagePath) {
            imagePath = path.join(episodeDir, `scene_${String(i + 1).padStart(3, '0')}_placeholder.png`);
            createPlaceholderImage(imagePath, scene.dialogue || `Scene ${i + 1}`, 1280, 720);
        }

        if (imagePath && !fs.existsSync(imagePath)) {
            imagePath = path.join(episodeDir, `scene_${String(i + 1).padStart(3, '0')}_placeholder.png`);
            createPlaceholderImage(imagePath, scene.dialogue || `Scene ${i + 1}`, 1280, 720);
        }

        if (!videoPath && !imagePath) continue;

        const ttsResult = ttsResults[i];
        const audioPath = ttsResult?.mediaPath;
        const hasAudio = audioPath && fs.existsSync(audioPath);

        let sceneOutputPath;
        if (videoPath && fs.existsSync(videoPath)) {
            if (hasAudio) {
                sceneOutputPath = path.join(episodeDir, `scene_${String(i + 1).padStart(3, '0')}_audio.mp4`);
                try {
                    await mergeVideoAudio(videoPath, audioPath, sceneOutputPath, ffmpegPath, scene.duration);
                } catch (e) {
                    sceneOutputPath = videoPath;
                }
            } else {
                sceneOutputPath = videoPath;
            }
        } else if (imagePath && fs.existsSync(imagePath)) {
            const duration = scene.duration || 5;
            sceneOutputPath = path.join(episodeDir, `scene_${String(i + 1).padStart(3, '0')}.mp4`);
            try {
                if (hasAudio) {
                    await imageToVideoWithAudio(imagePath, audioPath, sceneOutputPath, ffmpegPath, duration);
                } else {
                    await imageToVideo(imagePath, sceneOutputPath, ffmpegPath, duration);
                }
            } catch (e) {
                continue;
            }
        } else {
            continue;
        }

        if (sceneOutputPath && fs.existsSync(sceneOutputPath)) {
            concatList.push(sceneOutputPath);
        }
    }
    return concatList;
}

module.exports = {
    synthesizeSceneDialogues,
    composeSceneVideos
};
