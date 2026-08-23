const logger = require('../../shared/logger');
const { buildTextToImageWorkflow, buildImageToVideoWorkflow, buildLTX23RealisticVideoWorkflow } = require('./comfyuiWorkflowsLtx');
const { buildWan22TextToVideoWorkflow, buildWan22ImageToVideoWorkflow } = require('./comfyuiWorkflowsWan');
const { queuePrompt, waitForCompletion, getOutputImages, downloadOutput } = require('./comfyuiApi');
const { freeMemory } = require('./comfyuiSystem');

async function generateTextToImage(prompt, options = {}) {
    logger.info('comfyuiGenerators', `[COMFYUI] Text-to-Image: "${prompt.substring(0, 80)}..."`);
    const workflow = buildTextToImageWorkflow(prompt, options);
    const { prompt_id } = await queuePrompt(workflow);
    logger.info('comfyuiGenerators', `[COMFYUI] Queued: ${prompt_id}`);
    const result = await waitForCompletion(prompt_id);
    if (!result.success) {
        await freeMemory({ unloadModels: true, freeMemory: true });
        throw new Error(`ComfyUI generation failed: ${result.error}`);
    }
    const outputs = await getOutputImages(result.outputs);
    const imageOutput = outputs.find(o => !o.isVideo);
    if (!imageOutput) {
        await freeMemory({ unloadModels: true, freeMemory: true });
        throw new Error('No image output from ComfyUI');
    }
    if (options.savePath) {
        await downloadOutput(imageOutput.url, options.savePath);
        logger.info('comfyuiGenerators', `[COMFYUI] Image saved: ${options.savePath}`);
    }
    await freeMemory({ unloadModels: true, freeMemory: true });
    return { success: true, url: imageOutput.url, filename: imageOutput.filename, savePath: options.savePath };
}

async function generateImageToVideo(prompt, imagePath, options = {}) {
    logger.info('comfyuiGenerators', `[COMFYUI] Image-to-Video: "${prompt.substring(0, 80)}..."`);
    const workflow = buildImageToVideoWorkflow(prompt, imagePath, options);
    const { prompt_id } = await queuePrompt(workflow);
    logger.info('comfyuiGenerators', `[COMFYUI] Queued: ${prompt_id}`);
    const result = await waitForCompletion(prompt_id, 900000);
    if (!result.success) {
        await freeMemory({ unloadModels: true, freeMemory: true });
        throw new Error(`ComfyUI video generation failed: ${result.error}`);
    }
    const outputs = await getOutputImages(result.outputs);
    const videoOutput = outputs.find(o => o.isVideo) || outputs[0];
    if (!videoOutput) {
        await freeMemory({ unloadModels: true, freeMemory: true });
        throw new Error('No video output from ComfyUI');
    }
    if (options.savePath) {
        await downloadOutput(videoOutput.url, options.savePath);
        logger.info('comfyuiGenerators', `[COMFYUI] Video saved: ${options.savePath}`);
    }
    await freeMemory({ unloadModels: true, freeMemory: true });
    return { success: true, url: videoOutput.url, filename: videoOutput.filename, savePath: options.savePath };
}

async function generateLTX23RealisticVideo(prompt, options = {}) {
    logger.info('comfyuiGenerators', `[COMFYUI] LTX2.3 Realistic Video: "${prompt.substring(0, 80)}..."`);
    const workflow = buildLTX23RealisticVideoWorkflow(prompt, options);
    const { prompt_id } = await queuePrompt(workflow);
    logger.info('comfyuiGenerators', `[COMFYUI] Queued: ${prompt_id}`);
    const result = await waitForCompletion(prompt_id, 900000);
    if (!result.success) {
        await freeMemory({ unloadModels: true, freeMemory: true });
        throw new Error(`ComfyUI generation failed: ${result.error}`);
    }
    const outputs = await getOutputImages(result.outputs);
    const videoOutput = outputs.find(o => o.isVideo) || outputs[0];
    if (!videoOutput) {
        await freeMemory({ unloadModels: true, freeMemory: true });
        throw new Error('No output from ComfyUI');
    }
    if (options.savePath) {
        await downloadOutput(videoOutput.url, options.savePath);
        logger.info('comfyuiGenerators', `[COMFYUI] Video saved: ${options.savePath}`);
    }
    await freeMemory({ unloadModels: true, freeMemory: true });
    return { success: true, url: videoOutput.url, filename: videoOutput.filename, savePath: options.savePath };
}

async function generateWan22TextToVideo(prompt, options = {}) {
    logger.info('comfyuiGenerators', `[COMFYUI] Wan2.2 Text-to-Video: "${prompt.substring(0, 80)}..."`);
    const workflow = buildWan22TextToVideoWorkflow(prompt, options);
    const { prompt_id } = await queuePrompt(workflow);
    logger.info('comfyuiGenerators', `[COMFYUI] Wan2.2 Queued: ${prompt_id}`);
    const result = await waitForCompletion(prompt_id, 900000);
    if (!result.success) {
        await freeMemory({ unloadModels: true, freeMemory: true });
        throw new Error(`Wan2.2 generation failed: ${result.error}`);
    }
    const outputs = await getOutputImages(result.outputs);
    const output = outputs[0];
    if (!output) {
        await freeMemory({ unloadModels: true, freeMemory: true });
        throw new Error('No output from Wan2.2');
    }
    if (options.savePath) {
        await downloadOutput(output.url, options.savePath);
        logger.info('comfyuiGenerators', `[COMFYUI] Wan2.2 output saved: ${options.savePath}`);
    }
    await freeMemory({ unloadModels: true, freeMemory: true });
    return { success: true, url: output.url, filename: output.filename, savePath: options.savePath, isVideo: output.isVideo };
}

async function generateWan22ImageToVideo(prompt, imagePath, options = {}) {
    logger.info('comfyuiGenerators', `[COMFYUI] Wan2.2 Image-to-Video: "${prompt.substring(0, 80)}..."`);
    const workflow = buildWan22ImageToVideoWorkflow(prompt, imagePath, options);
    const { prompt_id } = await queuePrompt(workflow);
    logger.info('comfyuiGenerators', `[COMFYUI] Wan2.2 i2v Queued: ${prompt_id}`);
    const result = await waitForCompletion(prompt_id, 900000);
    if (!result.success) {
        await freeMemory({ unloadModels: true, freeMemory: true });
        throw new Error(`Wan2.2 i2v failed: ${result.error}`);
    }
    const outputs = await getOutputImages(result.outputs);
    const output = outputs[0];
    if (!output) {
        await freeMemory({ unloadModels: true, freeMemory: true });
        throw new Error('No output from Wan2.2 i2v');
    }
    if (options.savePath) {
        await downloadOutput(output.url, options.savePath);
        logger.info('comfyuiGenerators', `[COMFYUI] Wan2.2 i2v saved: ${options.savePath}`);
    }
    await freeMemory({ unloadModels: true, freeMemory: true });
    return { success: true, url: output.url, filename: output.filename, savePath: options.savePath, isVideo: output.isVideo };
}

module.exports = {
    generateTextToImage, generateImageToVideo,
    generateLTX23RealisticVideo,
    generateWan22TextToVideo, generateWan22ImageToVideo
};
