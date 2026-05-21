const axios = require('axios');
const fs = require('fs');
const path = require('path');
const llm = require('./llm');

const IMAGE_MODEL = 'image-01';
const IMAGE_BASE_URL = 'https://api.minimaxi.com/v1';

function getImageConfig() {
    return {
        apiKey: process.env.MINIMAX_API_KEY || process.env.LLM_API_KEY || '',
        groupId: process.env.MINIMAX_GROUP_ID || process.env.LLM_GROUP_ID || '',
        provider: process.env.LLM_PROVIDER || 'minimax',
        baseURL: process.env.LLM_BASE_URL || IMAGE_BASE_URL
    };
}

async function generateImage(prompt, options = {}) {
    const config = options.apiConfig || getImageConfig();
    if (!config.apiKey) throw new Error('API Key not configured for image generation');

    const isMiniMax = (config.provider || 'minimax') === 'minimax';
    if (!isMiniMax) {
        console.log('[IMAGE] Non-MiniMax provider, skipping image generation');
        return null;
    }

    const payload = {
        model: IMAGE_MODEL,
        prompt: prompt.substring(0, 1500),
        n: options.n || 1,
        aspect_ratio: options.aspectRatio || '16:9'
    };

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
    };

    if (config.groupId) {
        headers['x-group-id'] = config.groupId;
    }

    const baseURL = config.baseURL || IMAGE_BASE_URL;
    const url = `${baseURL}/image_generation`;

    console.log(`[IMAGE] Generating image: "${prompt.substring(0, 80)}..."`);

    try {
        const response = await axios.post(url, payload, { headers, timeout: 120000 });
        const data = response.data;

        if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
            const statusCode = data.base_resp.status_code;
            if (statusCode === 1026) {
                console.log(`[IMAGE] Content filtered by safety check, skipping`);
                return { success: false, filtered: true, images: [], usage: {} };
            }
            throw new Error(`Image API error: ${data.base_resp.status_msg || 'unknown'} (code: ${statusCode})`);
        }

        const imageUrls = data.data?.image_urls || [];
        console.log(`[IMAGE] Generated ${imageUrls.length} image(s)`);

        return {
            success: true,
            images: imageUrls.map(url => ({
                url,
                revisedPrompt: ''
            })),
            usage: data.metadata || {}
        };
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            throw new Error('Image generation timeout (120s)');
        }
        const errMsg = error.response?.data?.base_resp?.status_msg
            || error.response?.data?.error?.message
            || error.message;
        console.error(`[IMAGE] Generation error: ${errMsg}`);
        throw new Error(`Image generation failed: ${errMsg}`);
    }
}

async function downloadImage(imageUrl, savePath) {
    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
        });
        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(savePath, response.data);
        console.log(`[IMAGE] Saved to: ${savePath}`);
        return savePath;
    } catch (error) {
        console.error(`[IMAGE] Download error: ${error.message}`);
        throw new Error(`Failed to download image: ${error.message}`);
    }
}

async function extractImagePrompts(chapterContent, chapterTitle, chapterNumber) {
    const prompt = `分析以下小说章节内容，找出最适合生成配图的3个场景。选择标准：
1. 有悬念或紧张感的场景
2. 重要人物出场或关键互动的场景
3. 视觉冲击力强的场景描写

章节：第${chapterNumber}章 ${chapterTitle}

内容：
${chapterContent.substring(0, 8000)}

请输出JSON数组，每个元素包含：
- "scene": 场景简短描述（10字以内，用于文件命名）
- "prompt": 图片生成的英文prompt（详细描述画面构图、人物、光影、氛围，150字以内）

只输出JSON数组，不要其他内容。`;

    try {
        const result = await llm.chat(
            [{ role: 'user', content: prompt }],
            { maxTokens: 2000, temperature: 0.5 }
        );

        let content = result.choices?.[0]?.message?.content || '[]';
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const scenes = JSON.parse(content);
        if (!Array.isArray(scenes)) return [];

        return scenes.slice(0, 3).map(s => ({
            scene: s.scene || 'scene',
            prompt: s.prompt || ''
        })).filter(s => s.prompt);
    } catch (e) {
        console.error('[IMAGE] Extract prompts error:', e.message);
        return [];
    }
}

async function generateChapterImages(projectId, chapterNumber, chapterTitle, chapterContent, options = {}) {
    const outputDir = path.join(
        path.resolve(__dirname, '..', '..', 'output'),
        projectId,
        'images'
    );
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const scenes = await extractImagePrompts(chapterContent, chapterTitle, chapterNumber);
    if (scenes.length === 0) {
        console.log('[IMAGE] No suitable scenes found for image generation');
        return { success: true, images: [], message: 'No suitable scenes found' };
    }

    const results = [];
    const chapterPrefix = `第${String(chapterNumber).padStart(2, '0')}章-${chapterTitle}`;

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const safeSceneName = scene.scene.replace(/[\\/:*?"<>|]/g, '_').substring(0, 20);
        const fileName = `${chapterPrefix}-${safeSceneName}.png`;
        const savePath = path.join(outputDir, fileName);

        try {
            console.log(`[IMAGE] Scene ${i + 1}/${scenes.length}: ${scene.scene}`);
            const genResult = await generateImage(scene.prompt, {
                ...options,
                aspectRatio: options.aspectRatio || '16:9'
            });

            if (genResult && genResult.images?.length > 0) {
                const imgUrl = genResult.images[0].url;
                await downloadImage(imgUrl, savePath);
                results.push({
                    scene: scene.scene,
                    prompt: scene.prompt,
                    fileName,
                    filePath: savePath,
                    url: imgUrl,
                    revisedPrompt: genResult.images[0].revisedPrompt
                });
            }
        } catch (error) {
            console.error(`[IMAGE] Failed scene "${scene.scene}": ${error.message}`);
            results.push({
                scene: scene.scene,
                prompt: scene.prompt,
                fileName,
                error: error.message
            });
        }
    }

    const successCount = results.filter(r => !r.error).length;
    console.log(`[IMAGE] Chapter ${chapterNumber} complete: ${successCount}/${scenes.length} images generated`);

    return {
        success: true,
        chapterNumber,
        chapterTitle,
        images: results,
        outputDir,
        totalGenerated: successCount
    };
}

module.exports = {
    generateImage,
    downloadImage,
    extractImagePrompts,
    generateChapterImages,
    IMAGE_MODEL
};
