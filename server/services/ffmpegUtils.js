const { spawn, execSync } = require('child_process');
const fs = require('fs');

function findFFmpeg() {
    try {
        const result = execSync('where ffmpeg 2>nul || which ffmpeg 2>/dev/null', { encoding: 'utf-8' }).trim();
        return result.split('\n')[0].trim();
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
            try { fs.unlinkSync(concatFile); } catch (_) { /* cleanup: ignore */ }
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

module.exports = {
    findFFmpeg,
    hashCode,
    createPlaceholderImage,
    mergeVideoAudio,
    imageToVideo,
    imageToVideoWithAudio,
    concatenateVideos,
    burnSubtitles
};
