const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { COMFYUI_URL } = require('./comfyuiConstants');
const { LLM_DEFAULTS } = require('../../config/systemConfig');

async function queuePrompt(workflow) {
    const response = await axios.post(`${COMFYUI_URL}/prompt`, {
        prompt: workflow
    }, { timeout: 30000 });
    return response.data;
}

async function waitForCompletion(promptId, timeoutMs = 600000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        try {
            const resp = await axios.get(`${COMFYUI_URL}/history/${promptId}`, { timeout: 10000 });
            const history = resp.data;
            if (history[promptId]) {
                const status = history[promptId].status;
                if (status.completed) {
                    return { success: true, outputs: history[promptId].outputs };
                }
                if (status.status_str === 'error') {
                    return { success: false, error: status.messages?.join('\n') || 'Unknown error' };
                }
            }
        } catch (e) {
            // continue waiting
        }
        await new Promise(r => setTimeout(r, LLM_DEFAULTS.comfyuiPollIntervalMs));
    }
    return { success: false, error: 'Timeout waiting for completion' };
}

async function getOutputImages(outputs) {
    const images = [];
    for (const [nodeId, nodeOutput] of Object.entries(outputs)) {
        if (nodeOutput.images) {
            for (const img of nodeOutput.images) {
                images.push({
                    url: `${COMFYUI_URL}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type || 'output'}`,
                    filename: img.filename,
                    subfolder: img.subfolder || ''
                });
            }
        }
        if (nodeOutput.videos) {
            for (const vid of nodeOutput.videos) {
                images.push({
                    url: `${COMFYUI_URL}/view?filename=${encodeURIComponent(vid.filename)}&subfolder=${encodeURIComponent(vid.subfolder || '')}&type=${vid.type || 'output'}`,
                    filename: vid.filename,
                    subfolder: vid.subfolder || '',
                    isVideo: true
                });
            }
        }
        if (nodeOutput.gifs) {
            for (const gif of nodeOutput.gifs) {
                images.push({
                    url: `${COMFYUI_URL}/view?filename=${encodeURIComponent(gif.filename)}&subfolder=${encodeURIComponent(gif.subfolder || '')}&type=${gif.type || 'output'}`,
                    filename: gif.filename,
                    subfolder: gif.subfolder || '',
                    isVideo: true
                });
            }
        }
    }
    return images;
}

async function downloadOutput(url, savePath) {
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
    fs.writeFileSync(savePath, response.data);
    return savePath;
}

async function uploadImage(imagePath, imageName) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath), imageName || path.basename(imagePath));
    form.append('overwrite', 'true');
    const resp = await axios.post(`${COMFYUI_URL}/upload/image`, form, {
        headers: form.getHeaders(),
        timeout: 60000
    });
    return resp.data;
}

module.exports = { queuePrompt, waitForCompletion, getOutputImages, downloadOutput, uploadImage };
