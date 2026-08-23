const { buildTextToImageWorkflow, buildImageToVideoWorkflow, buildLTX23RealisticVideoWorkflow } = require('./comfyuiWorkflowsLtx');
const { buildWan22TextToVideoWorkflow, buildWan22ImageToVideoWorkflow } = require('./comfyuiWorkflowsWan');
const { queuePrompt, waitForCompletion, getOutputImages, downloadOutput, uploadImage } = require('./comfyuiApi');
const { getSystemInfo, freeMemory, setAutoFreeConfig, getAutoFreeConfig, touchAutoFreeTimer } = require('./comfyuiSystem');
const { generateTextToImage, generateImageToVideo, generateLTX23RealisticVideo, generateWan22TextToVideo, generateWan22ImageToVideo } = require('./comfyuiGenerators');

module.exports = {
    generateTextToImage,
    generateImageToVideo,
    generateWan22TextToVideo,
    generateWan22ImageToVideo,
    generateLTX23RealisticVideo,
    getSystemInfo,
    freeMemory,
    uploadImage,
    queuePrompt,
    waitForCompletion,
    getOutputImages,
    downloadOutput,
    buildTextToImageWorkflow,
    buildImageToVideoWorkflow,
    buildWan22TextToVideoWorkflow,
    buildWan22ImageToVideoWorkflow,
    buildLTX23RealisticVideoWorkflow,
    setAutoFreeConfig,
    getAutoFreeConfig,
    touchAutoFreeTimer
};
