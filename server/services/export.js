const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const tts = require('./tts');

const OUTPUT_BASE = path.join(__dirname, '..', '..', 'output');

function createPlaceholderImage(savePath, text, width, height) {
    const ffmpegPath = findFFmpeg();
    if (!ffmpegPath) return null;
    const colors = ['0x0d1b2a', '0x1b263b', '0x415a77', '0x2b2d42', '0x1a1a2e', '0x16213e'];
    const colorIdx = Math.abs(hashCode(text || '')) % colors.length;
    const args = [
        '-y', '-f', 'lavfi',
        '-i', `color=c=${colors[colorIdx]}:s=${width}x${height}:d=1`,
        '-frames:v', '1', savePath
    ];
    try {
        execSync(`"${ffmpegPath}" ${args.join(' ')}`, { stdio: 'pipe', timeout: 10000 });
        if (fs.existsSync(savePath)) return savePath;
        return null;
    } catch {
        return null;
    }
}

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash;
}

function findFFmpeg() {
    try {
        const result = execSync('where ffmpeg 2>nul || which ffmpeg 2>/dev/null', { encoding: 'utf-8' }).trim();
        return result.split('\n')[0].trim();
    } catch {
        return null;
    }
}

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
        console.error('[EXPORT] SRT generation error:', e.message);
    }

    if (options.burnSubtitles && fs.existsSync(subtitleOutput)) {
        const subbedOutput = path.join(episodeDir, `${episodeTitle}_subtitled.mp4`);
        try {
            await burnSubtitles(finalOutput, subtitleOutput, subbedOutput, ffmpegPath);
        } catch (e) {
            console.error('[EXPORT] Burn subtitles error:', e.message);
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

function mergeVideoAudio(videoPath, audioPath, outputPath, ffmpegPath, duration) {
    return new Promise((resolve, reject) => {
        const args = [
            '-y',
            '-i', videoPath,
            '-i', audioPath,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-shortest',
            outputPath
        ];
        const proc = spawn(ffmpegPath, args, { stdio: 'pipe' });
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
        proc.on('error', reject);
    });
}

function imageToVideo(imagePath, outputPath, ffmpegPath, duration) {
    return new Promise((resolve, reject) => {
        const args = [
            '-y',
            '-loop', '1',
            '-i', imagePath,
            '-c:v', 'libx264',
            '-t', String(duration),
            '-pix_fmt', 'yuv420p',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-r', '24',
            outputPath
        ];
        const proc = spawn(ffmpegPath, args, { stdio: 'pipe' });
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
        proc.on('error', reject);
    });
}

function imageToVideoWithAudio(imagePath, audioPath, outputPath, ffmpegPath, fallbackDuration) {
    return new Promise((resolve, reject) => {
        const args = [
            '-y',
            '-loop', '1',
            '-i', imagePath,
            '-i', audioPath,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-pix_fmt', 'yuv420p',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-r', '24',
            '-shortest',
            outputPath
        ];
        const proc = spawn(ffmpegPath, args, { stdio: 'pipe' });
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
        proc.on('error', reject);
    });
}

function concatenateVideos(videoPaths, outputPath, ffmpegPath) {
    return new Promise((resolve, reject) => {
        const concatFile = outputPath + '.concat.txt';
        const content = videoPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
        fs.writeFileSync(concatFile, content, 'utf-8');

        const args = [
            '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', concatFile,
            '-c', 'copy',
            outputPath
        ];
        const proc = spawn(ffmpegPath, args, { stdio: 'pipe' });
        proc.on('close', (code) => {
            try { fs.unlinkSync(concatFile); } catch {}
            code === 0 ? resolve() : reject(new Error(`ffmpeg concat exit ${code}`));
        });
        proc.on('error', reject);
    });
}

function burnSubtitles(videoPath, subtitlePath, outputPath, ffmpegPath) {
    return new Promise((resolve, reject) => {
        const args = [
            '-y',
            '-i', videoPath,
            '-vf', `subtitles='${subtitlePath.replace(/'/g, "'\\''").replace(/\\/g, '/')}'`,
            '-c:a', 'copy',
            outputPath
        ];
        const proc = spawn(ffmpegPath, args, { stdio: 'pipe' });
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg burn exit ${code}`)));
        proc.on('error', reject);
    });
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
    mergeVideoAudio,
    imageToVideo,
    imageToVideoWithAudio,
    concatenateVideos,
    burnSubtitles,
    generateSRT
};
