const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const OUTPUT_BASE = path.join(__dirname, '..', '..', 'output');

function buildTextToImageWorkflow(prompt, options = {}) {
    const width = options.width || 768;
    const height = options.height || 512;
    const steps = options.steps || 20;
    const seed = options.seed || Math.floor(Math.random() * 2147483647);
    const cfg = options.cfg || 3.0;
    const maxShift = options.maxShift || 2.05;
    const baseShift = options.baseShift || 0.95;
    const samplerName = options.sampler || 'euler';
    const modelPath = options.modelPath || 'LTX-2.3-distilled-Q8_0.gguf';
    const textEncoder = options.textEncoder || 'gemma_3_12B_it_fp8_e4m3fn.safetensors';
    const textEncoder2 = options.textEncoder2 || 'ltx-2.3_text_projection_bf16.safetensors';
    const vaeName = options.vaeName || 'LTX23_video_vae_bf16.safetensors';

    return {
        "1": {
            "class_type": "UnetLoaderGGUF",
            "inputs": { "unet_name": modelPath }
        },
        "2": {
            "class_type": "DualCLIPLoader",
            "inputs": {
                "clip_name1": textEncoder,
                "clip_name2": textEncoder2,
                "type": "ltxv"
            }
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": { "vae_name": vaeName }
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt,
                "clip": ["2", 0]
            }
        },
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "low quality, blurry, distorted, deformed, ugly, bad anatomy, watermark, text, logo",
                "clip": ["2", 0]
            }
        },
        "6": {
            "class_type": "EmptyLTXVLatentVideo",
            "inputs": {
                "width": width,
                "height": height,
                "length": 9,
                "batch_size": 1
            }
        },
        "7": {
            "class_type": "LTXVConditioning",
            "inputs": {
                "positive": ["4", 0],
                "negative": ["5", 0],
                "frame_rate": 25.0
            }
        },
        "8": {
            "class_type": "ModelSamplingLTXV",
            "inputs": {
                "model": ["1", 0],
                "max_shift": maxShift,
                "base_shift": baseShift
            }
        },
        "9": {
            "class_type": "LTXVScheduler",
            "inputs": {
                "steps": steps,
                "max_shift": maxShift,
                "base_shift": baseShift,
                "stretch": true,
                "terminal": 0.1
            }
        },
        "10": {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "noise": ["11", 0],
                "guider": ["12", 0],
                "sampler": ["13", 0],
                "sigmas": ["9", 0],
                "latent_image": ["6", 0]
            }
        },
        "11": {
            "class_type": "RandomNoise",
            "inputs": { "noise_seed": seed }
        },
        "12": {
            "class_type": "CFGGuider",
            "inputs": {
                "model": ["8", 0],
                "positive": ["7", 0],
                "negative": ["7", 1],
                "cfg": cfg
            }
        },
        "13": {
            "class_type": "KSamplerSelect",
            "inputs": { "sampler_name": samplerName }
        },
        "14": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["10", 0],
                "vae": ["3", 0]
            }
        },
        "15": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": "ltx_t2i",
                "images": ["14", 0]
            }
        }
    };
}

function buildImageToVideoWorkflow(prompt, imagePath, options = {}) {
    const width = options.width || 768;
    const height = options.height || 512;
    const length = options.length || 25;
    const steps = options.steps || 20;
    const seed = options.seed || Math.floor(Math.random() * 2147483647);
    const strength = options.strength || 1.0;
    const cfg = options.cfg || 3.0;
    const maxShift = options.maxShift || 2.05;
    const baseShift = options.baseShift || 0.95;
    const samplerName = options.sampler || 'euler';
    const modelPath = options.modelPath || 'LTX-2.3-distilled-Q8_0.gguf';
    const textEncoder = options.textEncoder || 'gemma_3_12B_it_fp8_e4m3fn.safetensors';
    const textEncoder2 = options.textEncoder2 || 'ltx-2.3_text_projection_bf16.safetensors';
    const vaeName = options.vaeName || 'LTX23_video_vae_bf16.safetensors';

    return {
        "1": {
            "class_type": "UnetLoaderGGUF",
            "inputs": { "unet_name": modelPath }
        },
        "2": {
            "class_type": "DualCLIPLoader",
            "inputs": {
                "clip_name1": textEncoder,
                "clip_name2": textEncoder2,
                "type": "ltxv"
            }
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": { "vae_name": vaeName }
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt,
                "clip": ["2", 0]
            }
        },
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "low quality, blurry, distorted, deformed, ugly, bad anatomy, watermark, text, logo, static",
                "clip": ["2", 0]
            }
        },
        "6": {
            "class_type": "LoadImage",
            "inputs": { "image": imagePath }
        },
        "7": {
            "class_type": "LTXVImgToVideo",
            "inputs": {
                "positive": ["4", 0],
                "negative": ["5", 0],
                "vae": ["3", 0],
                "image": ["6", 0],
                "width": width,
                "height": height,
                "length": length,
                "batch_size": 1,
                "strength": strength
            }
        },
        "8": {
            "class_type": "ModelSamplingLTXV",
            "inputs": {
                "model": ["1", 0],
                "max_shift": maxShift,
                "base_shift": baseShift
            }
        },
        "9": {
            "class_type": "LTXVScheduler",
            "inputs": {
                "steps": steps,
                "max_shift": maxShift,
                "base_shift": baseShift,
                "stretch": true,
                "terminal": 0.1
            }
        },
        "10": {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "noise": ["11", 0],
                "guider": ["12", 0],
                "sampler": ["13", 0],
                "sigmas": ["9", 0],
                "latent_image": ["7", 2]
            }
        },
        "11": {
            "class_type": "RandomNoise",
            "inputs": { "noise_seed": seed }
        },
        "12": {
            "class_type": "CFGGuider",
            "inputs": {
                "model": ["8", 0],
                "positive": ["7", 0],
                "negative": ["7", 1],
                "cfg": cfg
            }
        },
        "13": {
            "class_type": "KSamplerSelect",
            "inputs": { "sampler_name": samplerName }
        },
        "14": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["10", 0],
                "vae": ["3", 0]
            }
        },
        "15": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": "ltx_i2v",
                "images": ["14", 0]
            }
        }
    };
}

function buildWan22TextToVideoWorkflow(prompt, options = {}) {
    const width = options.width || 832;
    const height = options.height || 480;
    const numFrames = options.length || 81;
    const steps = options.steps || 20;
    const seed = options.seed || Math.floor(Math.random() * 2147483647);
    const cfg = options.cfg || 5.0;
    const shift = options.shift || 5.0;
    const scheduler = options.scheduler || 'unipc';
    const modelPath = options.modelPath || 'wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors';
    const t5Path = options.t5Path || 'umt5_xxl_fp16.safetensors';
    const clipPath = options.clipPath || 'ViT-L-14-TEXT-detail-improved-hiT-GmP-TE-only-HF.safetensors';
    const vaeName = options.vaeName || 'wan_2.1_vae.safetensors';
    const loraName = options.loraName || '';

    const extraNodes = {};
    let modelInput = ["1", 0];
    let nextId = 20;

    if (loraName) {
        const loraId = String(nextId++);
        extraNodes[loraId] = {
            "class_type": "WanVideoLoraSelectByName",
            "inputs": { "lora_name": loraName, "strength": 1.0 }
        };
        const setLoraId = String(nextId++);
        extraNodes[setLoraId] = {
            "class_type": "WanVideoSetLoRAs",
            "inputs": { "model": ["1", 0], "lora": [loraId, 0] }
        };
        modelInput = [setLoraId, 0];
    }

    return {
        "1": {
            "class_type": "WanVideoModelLoader",
            "inputs": { "model": modelPath, "base_precision": "bf16", "quantization": "disabled", "load_device": "offload_device" }
        },
        "2": {
            "class_type": "LoadWanVideoT5TextEncoder",
            "inputs": { "model_name": t5Path, "precision": "bf16" }
        },
        "3": {
            "class_type": "LoadWanVideoClipTextEncoder",
            "inputs": { "model_name": clipPath, "precision": "fp16" }
        },
        "4": {
            "class_type": "WanVideoVAELoader",
            "inputs": { "model_name": vaeName, "precision": "bf16" }
        },
        "5": {
            "class_type": "WanVideoTextEncode",
            "inputs": {
                "positive_prompt": prompt,
                "negative_prompt": "low quality, blurry, distorted, deformed, ugly, bad anatomy, watermark, text, logo, static, noise, jitter, cartoon, anime",
                "t5": ["2", 0],
                "force_offload": true,
                "model_to_offload": modelInput
            }
        },
        "6": {
            "class_type": "WanVideoImageToVideoEncode",
            "inputs": {
                "width": width,
                "height": height,
                "num_frames": numFrames,
                "noise_aug_strength": 0.0,
                "start_latent_strength": 1.0,
                "end_latent_strength": 1.0,
                "force_offload": true,
                "vae": ["4", 0]
            }
        },
        "7": {
            "class_type": "WanVideoSampler",
            "inputs": {
                "model": modelInput,
                "image_embeds": ["6", 0],
                "text_embeds": ["5", 0],
                "steps": steps,
                "cfg": cfg,
                "shift": shift,
                "seed": seed,
                "force_offload": true,
                "scheduler": scheduler,
                "riflex_freq_index": 0
            }
        },
        "8": {
            "class_type": "WanVideoDecode",
            "inputs": {
                "vae": ["4", 0],
                "samples": ["7", 0],
                "enable_vae_tiling": false,
                "tile_x": 272,
                "tile_y": 272,
                "tile_stride_x": 144,
                "tile_stride_y": 128
            }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": { "filename_prefix": "wan_t2v", "images": ["8", 0] }
        },
        ...extraNodes
    };
}

function buildWan22ImageToVideoWorkflow(prompt, imagePath, options = {}) {
    const width = options.width || 832;
    const height = options.height || 480;
    const numFrames = options.length || 81;
    const steps = options.steps || 20;
    const seed = options.seed || Math.floor(Math.random() * 2147483647);
    const cfg = options.cfg || 5.0;
    const shift = options.shift || 5.0;
    const scheduler = options.scheduler || 'unipc';
    const modelPath = options.modelPath || 'wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors';
    const t5Path = options.t5Path || 'umt5_xxl_fp16.safetensors';
    const clipPath = options.clipPath || 'ViT-L-14-TEXT-detail-improved-hiT-GmP-TE-only-HF.safetensors';
    const vaeName = options.vaeName || 'wan_2.1_vae.safetensors';

    return {
        "1": {
            "class_type": "WanVideoModelLoader",
            "inputs": { "model": modelPath, "base_precision": "bf16", "quantization": "disabled", "load_device": "offload_device" }
        },
        "2": {
            "class_type": "LoadWanVideoT5TextEncoder",
            "inputs": { "model_name": t5Path, "precision": "bf16" }
        },
        "3": {
            "class_type": "LoadWanVideoClipTextEncoder",
            "inputs": { "model_name": clipPath, "precision": "fp16" }
        },
        "4": {
            "class_type": "WanVideoVAELoader",
            "inputs": { "model_name": vaeName, "precision": "bf16" }
        },
        "5": {
            "class_type": "WanVideoTextEncode",
            "inputs": {
                "positive_prompt": prompt,
                "negative_prompt": "low quality, blurry, distorted, deformed, ugly, bad anatomy, watermark, text, logo, static, noise, jitter, cartoon, anime",
                "t5": ["2", 0],
                "force_offload": true,
                "model_to_offload": ["1", 0]
            }
        },
        "6": {
            "class_type": "LoadImage",
            "inputs": { "image": imagePath }
        },
        "7": {
            "class_type": "WanVideoImageToVideoEncode",
            "inputs": {
                "width": width,
                "height": height,
                "num_frames": numFrames,
                "noise_aug_strength": 0.0,
                "start_latent_strength": 1.0,
                "end_latent_strength": 1.0,
                "force_offload": true,
                "vae": ["4", 0],
                "start_image": ["6", 0]
            }
        },
        "8": {
            "class_type": "WanVideoSampler",
            "inputs": {
                "model": ["1", 0],
                "image_embeds": ["7", 0],
                "text_embeds": ["5", 0],
                "steps": steps,
                "cfg": cfg,
                "shift": shift,
                "seed": seed,
                "force_offload": true,
                "scheduler": scheduler,
                "riflex_freq_index": 0
            }
        },
        "9": {
            "class_type": "WanVideoDecode",
            "inputs": {
                "vae": ["4", 0],
                "samples": ["8", 0],
                "enable_vae_tiling": false,
                "tile_x": 272,
                "tile_y": 272,
                "tile_stride_x": 144,
                "tile_stride_y": 128
            }
        },
        "10": {
            "class_type": "SaveImage",
            "inputs": { "filename_prefix": "wan_i2v", "images": ["9", 0] }
        }
    };
}

function buildLTX23RealisticVideoWorkflow(prompt, options = {}) {
    const width = options.width || 1280;
    const height = options.height || 720;
    const length = options.length || 25;
    const steps = options.steps || 35;
    const seed = options.seed || Math.floor(Math.random() * 2147483647);
    const strength = options.strength || 1.0;
    const cfg = options.cfg || 4.5;
    const maxShift = options.maxShift || 2.5;
    const baseShift = options.baseShift || 1.0;
    const samplerName = options.sampler || 'euler_ancestral';
    const modelPath = options.modelPath || 'LTX-2.3-distilled-Q8_0.gguf';
    const textEncoder = options.textEncoder || 'gemma_3_12B_it_fp8_e4m3fn.safetensors';
    const textEncoder2 = options.textEncoder2 || 'ltx-2.3_text_projection_bf16.safetensors';
    const vaeName = options.vaeName || 'LTX23_video_vae_bf16.safetensors';
    const imagePath = options.imagePath || null;

    const realisticPrompt = `cinematic, photorealistic, 4K, detailed skin texture, natural lighting, depth of field, professional cinematography, ${prompt}`;
    const negativePrompt = 'low quality, blurry, distorted, deformed, ugly, bad anatomy, watermark, text, logo, static, noise, jitter, cartoon, anime, painting, illustration, 3d render, oversaturated, unnatural colors, flat lighting, amateur, phone camera, vhs, grainy';

    const nodes = {
        "1": {
            "class_type": "UnetLoaderGGUF",
            "inputs": { "unet_name": modelPath }
        },
        "2": {
            "class_type": "DualCLIPLoader",
            "inputs": {
                "clip_name1": textEncoder,
                "clip_name2": textEncoder2,
                "type": "ltxv"
            }
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": { "vae_name": vaeName }
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": realisticPrompt,
                "clip": ["2", 0]
            }
        },
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": negativePrompt,
                "clip": ["2", 0]
            }
        },
        "8": {
            "class_type": "ModelSamplingLTXV",
            "inputs": {
                "model": ["1", 0],
                "max_shift": maxShift,
                "base_shift": baseShift
            }
        },
        "9": {
            "class_type": "LTXVScheduler",
            "inputs": {
                "steps": steps,
                "max_shift": maxShift,
                "base_shift": baseShift,
                "stretch": true,
                "terminal": 0.1
            }
        },
        "11": {
            "class_type": "RandomNoise",
            "inputs": { "noise_seed": seed }
        },
        "13": {
            "class_type": "KSamplerSelect",
            "inputs": { "sampler_name": samplerName }
        }
    };

    if (imagePath) {
        nodes["6"] = {
            "class_type": "LoadImage",
            "inputs": { "image": imagePath }
        };
        nodes["7"] = {
            "class_type": "LTXVImgToVideo",
            "inputs": {
                "positive": ["4", 0],
                "negative": ["5", 0],
                "vae": ["3", 0],
                "image": ["6", 0],
                "width": width,
                "height": height,
                "length": length,
                "batch_size": 1,
                "strength": strength
            }
        };
        nodes["10"] = {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "noise": ["11", 0],
                "guider": ["12", 0],
                "sampler": ["13", 0],
                "sigmas": ["9", 0],
                "latent_image": ["7", 2]
            }
        };
        nodes["12"] = {
            "class_type": "CFGGuider",
            "inputs": {
                "model": ["8", 0],
                "positive": ["7", 0],
                "negative": ["7", 1],
                "cfg": cfg
            }
        };
    } else {
        nodes["6"] = {
            "class_type": "EmptyLTXVLatentVideo",
            "inputs": {
                "width": width,
                "height": height,
                "length": length,
                "batch_size": 1
            }
        };
        nodes["7"] = {
            "class_type": "LTXVConditioning",
            "inputs": {
                "positive": ["4", 0],
                "negative": ["5", 0],
                "frame_rate": 25.0
            }
        };
        nodes["10"] = {
            "class_type": "SamplerCustomAdvanced",
            "inputs": {
                "noise": ["11", 0],
                "guider": ["12", 0],
                "sampler": ["13", 0],
                "sigmas": ["9", 0],
                "latent_image": ["6", 0]
            }
        };
        nodes["12"] = {
            "class_type": "CFGGuider",
            "inputs": {
                "model": ["8", 0],
                "positive": ["7", 0],
                "negative": ["7", 1],
                "cfg": cfg
            }
        };
    }

    nodes["14"] = {
        "class_type": "VAEDecode",
        "inputs": {
            "samples": ["10", 0],
            "vae": ["3", 0]
        }
    };
    nodes["15"] = {
        "class_type": "VHS_VideoCombine",
        "inputs": {
            "images": ["14", 0],
            "filename_prefix": "ltx_realistic",
            "format": "video/h264-mp4",
            "frame_rate": 25,
            "loop_count": 0,
            "pingpong": false,
            "save_output": true
        }
    };

    return nodes;
}

async function generateLTX23RealisticVideo(prompt, options = {}) {
    console.log(`[COMFYUI] LTX2.3 Realistic Video: "${prompt.substring(0, 80)}..."`);
    const workflow = buildLTX23RealisticVideoWorkflow(prompt, options);
    const { prompt_id } = await queuePrompt(workflow);
    console.log(`[COMFYUI] Queued: ${prompt_id}`);
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
        console.log(`[COMFYUI] Video saved: ${options.savePath}`);
    }
    await freeMemory({ unloadModels: true, freeMemory: true });
    return { success: true, url: videoOutput.url, filename: videoOutput.filename, savePath: options.savePath };
}

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
        await new Promise(r => setTimeout(r, 2000));
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

async function generateTextToImage(prompt, options = {}) {
    console.log(`[COMFYUI] Text-to-Image: "${prompt.substring(0, 80)}..."`);
    const workflow = buildTextToImageWorkflow(prompt, options);
    const { prompt_id } = await queuePrompt(workflow);
    console.log(`[COMFYUI] Queued: ${prompt_id}`);
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
        console.log(`[COMFYUI] Image saved: ${options.savePath}`);
    }
    await freeMemory({ unloadModels: true, freeMemory: true });
    return { success: true, url: imageOutput.url, filename: imageOutput.filename, savePath: options.savePath };
}

async function generateImageToVideo(prompt, imagePath, options = {}) {
    console.log(`[COMFYUI] Image-to-Video: "${prompt.substring(0, 80)}..."`);
    const workflow = buildImageToVideoWorkflow(prompt, imagePath, options);
    const { prompt_id } = await queuePrompt(workflow);
    console.log(`[COMFYUI] Queued: ${prompt_id}`);
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
        console.log(`[COMFYUI] Video saved: ${options.savePath}`);
    }
    await freeMemory({ unloadModels: true, freeMemory: true });
    return { success: true, url: videoOutput.url, filename: videoOutput.filename, savePath: options.savePath };
}

async function getSystemInfo() {
    try {
        const resp = await axios.get(`${COMFYUI_URL}/system_stats`, { timeout: 5000 });
        return resp.data;
    } catch {
        return null;
    }
}

async function freeMemory(options = {}) {
    const unloadModels = options.unloadModels !== false;
    const freeMemory = options.freeMemory !== false;
    try {
        await axios.post(`${COMFYUI_URL}/free`, {
            unload_models: unloadModels,
            free_memory: freeMemory
        }, { timeout: 30000 });
        console.log(`[COMFYUI] Memory freed: unload_models=${unloadModels}, free_memory=${freeMemory}`);
        await new Promise(r => setTimeout(r, 3000));
        const stats = await getSystemInfo();
        const dev = stats?.devices?.[0];
        return {
            success: true,
            vramUsedGB: dev ? ((dev.vram_total - dev.vram_free) / 1073741824).toFixed(1) : null,
            vramTotalGB: dev ? (dev.vram_total / 1073741824).toFixed(1) : null,
            vramFreeGB: dev ? (dev.vram_free / 1073741824).toFixed(1) : null,
            ramFreeGB: stats ? (stats.system.ram_free / 1073741824).toFixed(1) : null
        };
    } catch (e) {
        console.error(`[COMFYUI] Free memory failed: ${e.message}`);
        return { success: false, error: e.message };
    }
}

let autoFreeTimer = null;
let autoFreeConfig = {
    enabled: true,
    idleSeconds: 120,
    vramThreshold: 0.75
};

function setAutoFreeConfig(config) {
    autoFreeConfig = { ...autoFreeConfig, ...config };
    resetAutoFreeTimer();
    return autoFreeConfig;
}

function getAutoFreeConfig() {
    return { ...autoFreeConfig };
}

function resetAutoFreeTimer() {
    if (autoFreeTimer) {
        clearTimeout(autoFreeTimer);
        autoFreeTimer = null;
    }
    if (!autoFreeConfig.enabled) return;
    autoFreeTimer = setTimeout(async () => {
        try {
            const stats = await getSystemInfo();
            const dev = stats?.devices?.[0];
            if (dev) {
                const usageRatio = (dev.vram_total - dev.vram_free) / dev.vram_total;
                if (usageRatio > autoFreeConfig.vramThreshold) {
                    console.log(`[COMFYUI] Auto-free triggered: VRAM usage ${(usageRatio * 100).toFixed(0)}% > ${(autoFreeConfig.vramThreshold * 100).toFixed(0)}%`);
                    await freeMemory({ unloadModels: true, freeMemory: true });
                }
            }
        } catch (e) {
            console.error(`[COMFYUI] Auto-free error: ${e.message}`);
        }
    }, autoFreeConfig.idleSeconds * 1000);
}

function touchAutoFreeTimer() {
    resetAutoFreeTimer();
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

async function generateWan22TextToVideo(prompt, options = {}) {
    console.log(`[COMFYUI] Wan2.2 Text-to-Video: "${prompt.substring(0, 80)}..."`);
    const workflow = buildWan22TextToVideoWorkflow(prompt, options);
    const { prompt_id } = await queuePrompt(workflow);
    console.log(`[COMFYUI] Wan2.2 Queued: ${prompt_id}`);
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
        console.log(`[COMFYUI] Wan2.2 output saved: ${options.savePath}`);
    }
    await freeMemory({ unloadModels: true, freeMemory: true });
    return { success: true, url: output.url, filename: output.filename, savePath: options.savePath, isVideo: output.isVideo };
}

async function generateWan22ImageToVideo(prompt, imagePath, options = {}) {
    console.log(`[COMFYUI] Wan2.2 Image-to-Video: "${prompt.substring(0, 80)}..."`);
    const workflow = buildWan22ImageToVideoWorkflow(prompt, imagePath, options);
    const { prompt_id } = await queuePrompt(workflow);
    console.log(`[COMFYUI] Wan2.2 i2v Queued: ${prompt_id}`);
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
        console.log(`[COMFYUI] Wan2.2 i2v saved: ${options.savePath}`);
    }
    await freeMemory({ unloadModels: true, freeMemory: true });
    return { success: true, url: output.url, filename: output.filename, savePath: options.savePath, isVideo: output.isVideo };
}

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
