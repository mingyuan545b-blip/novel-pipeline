const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TTS_VOICES = {
    'zh-CN-XiaoxiaoNeural': { name: '晓晓（女·温柔）', lang: 'zh-CN', gender: 'Female' },
    'zh-CN-XiaoyiNeural': { name: '晓依（女·活泼）', lang: 'zh-CN', gender: 'Female' },
    'zh-CN-YunjianNeural': { name: '云健（男·沉稳）', lang: 'zh-CN', gender: 'Male' },
    'zh-CN-YunxiNeural': { name: '云希（男·阳光）', lang: 'zh-CN', gender: 'Male' },
    'zh-CN-YunxiaNeural': { name: '云夏（男·少年）', lang: 'zh-CN', gender: 'Male' },
    'zh-CN-YunyangNeural': { name: '云扬（男·新闻）', lang: 'zh-CN', gender: 'Male' },
    'zh-CN-liaoning-XiaobeiNeural': { name: '小北（女·东北）', lang: 'zh-CN-liaoning', gender: 'Female' },
    'zh-CN-shaanxi-XiaoniNeural': { name: '小妮（女·陕西）', lang: 'zh-CN-shaanxi', gender: 'Female' },
    'ja-JP-NanamiNeural': { name: '七海（女·日语）', lang: 'ja-JP', gender: 'Female' },
    'en-US-JennyNeural': { name: 'Jenny（女·英语）', lang: 'en-US', gender: 'Female' },
    'en-US-GuyNeural': { name: 'Guy（男·英语）', lang: 'en-US', gender: 'Male' },
    'ko-KR-SunHiNeural': { name: 'SunHi（女·韩语）', lang: 'ko-KR', gender: 'Female' }
};

function getVoices() {
    return Object.entries(TTS_VOICES).map(([key, val]) => ({
        key,
        ...val
    }));
}

function synthesize(text, options = {}) {
    const voice = options.voice || 'zh-CN-YunxiNeural';
    const rate = options.rate || '+0%';
    const volume = options.volume || '+0%';
    const pitch = options.pitch || '+0Hz';
    const outputPath = options.outputPath;

    if (!outputPath) throw new Error('outputPath is required');
    if (!text || text.trim().length === 0) throw new Error('text is required');

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const mediaPath = outputPath.endsWith('.mp3') ? outputPath : outputPath.replace(/\.[^.]+$/, '') + '.mp3';

    return new Promise((resolve, reject) => {
        const runnerPath = path.join(__dirname, 'tts_runner.py');
        const tmpDir = path.join(__dirname, '..', '..', 'output', '_tts_tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2);
        const paramFile = path.join(tmpDir, `params_${jobId}.json`);
        const resultFile = path.join(tmpDir, `result_${jobId}.json`);

        const params = {
            text,
            voice,
            output: mediaPath,
            rate,
            volume,
            pitch,
            resultFile
        };
        if (options.subtitlePath) {
            params.subtitle = options.subtitlePath;
        }
        const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:7897';
        if (proxyUrl) {
            params.proxy = proxyUrl;
        }

        fs.writeFileSync(paramFile, JSON.stringify(params), 'utf-8');

        const proc = spawn('python', [runnerPath, paramFile], {
            stdio: 'pipe'
        });

        let stderr = '';
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            try { fs.unlinkSync(paramFile); } catch { /* cleanup */ }
            if (code === 0) {
                resolve({
                    success: true,
                    mediaPath,
                    subtitlePath: options.subtitlePath || null,
                    voice,
                    textLength: text.length
                });
            } else {
                reject(new Error(`edge-tts failed with code ${code}: ${stderr}`));
            }
        });

        proc.on('error', (err) => {
            reject(new Error(`Failed to start edge-tts: ${err.message}`));
        });
    });
}

async function synthesizeChapterDialogue(dialogues, outputDir, options = {}) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const results = [];
    for (let i = 0; i < dialogues.length; i++) {
        const dlg = dialogues[i];
        const voice = dlg.voice || options.defaultVoice || 'zh-CN-YunxiNeural';
        const fileName = `dialogue_${String(i + 1).padStart(3, '0')}.mp3`;
        const mediaPath = path.join(outputDir, fileName);
        const subtitlePath = path.join(outputDir, `dialogue_${String(i + 1).padStart(3, '0')}.vtt`);

        try {
            const result = await synthesize(dlg.text, {
                voice,
                rate: dlg.rate || options.rate || '+0%',
                volume: dlg.volume || options.volume || '+0%',
                pitch: dlg.pitch || options.pitch || '+0Hz',
                outputPath: mediaPath,
                subtitlePath
            });
            results.push({
                index: i,
                speaker: dlg.speaker || '旁白',
                ...result
            });
        } catch (error) {
            results.push({
                index: i,
                speaker: dlg.speaker || '旁白',
                error: error.message
            });
        }
    }

    return {
        success: true,
        total: dialogues.length,
        generated: results.filter(r => !r.error).length,
        results,
        outputDir
    };
}

module.exports = {
    getVoices,
    synthesize,
    synthesizeChapterDialogue,
    TTS_VOICES
};
