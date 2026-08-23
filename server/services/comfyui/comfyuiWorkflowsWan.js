const { DEFAULTS } = require('./comfyuiConstants');

function buildWan22TextToVideoWorkflow(prompt, options = {}) {
    const width = options.width || DEFAULTS.WAN22.width;
    const height = options.height || DEFAULTS.WAN22.height;
    const numFrames = options.length || DEFAULTS.WAN22.length;
    const steps = options.steps || DEFAULTS.WAN22.steps;
    const seed = options.seed || Math.floor(Math.random() * 2147483647);
    const cfg = options.cfg || DEFAULTS.WAN22.cfg;
    const shift = options.shift || DEFAULTS.WAN22.shift;
    const scheduler = options.scheduler || DEFAULTS.WAN22.scheduler;
    const modelPath = options.modelPath || DEFAULTS.WAN22.modelPath;
    const t5Path = options.t5Path || DEFAULTS.WAN22.t5Path;
    const clipPath = options.clipPath || DEFAULTS.WAN22.clipPath;
    const vaeName = options.vaeName || DEFAULTS.WAN22.vaeName;
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
        "1": { "class_type": "WanVideoModelLoader", "inputs": { "model": modelPath, "base_precision": "bf16", "quantization": "disabled", "load_device": "offload_device" } },
        "2": { "class_type": "LoadWanVideoT5TextEncoder", "inputs": { "model_name": t5Path, "precision": "bf16" } },
        "3": { "class_type": "LoadWanVideoClipTextEncoder", "inputs": { "model_name": clipPath, "precision": "fp16" } },
        "4": { "class_type": "WanVideoVAELoader", "inputs": { "model_name": vaeName, "precision": "bf16" } },
        "5": { "class_type": "WanVideoTextEncode", "inputs": { "positive_prompt": prompt, "negative_prompt": DEFAULTS.VIDEO_NEGATIVE, "t5": ["2", 0], "force_offload": true, "model_to_offload": modelInput } },
        "6": { "class_type": "WanVideoImageToVideoEncode", "inputs": { "width": width, "height": height, "num_frames": numFrames, "noise_aug_strength": 0.0, "start_latent_strength": 1.0, "end_latent_strength": 1.0, "force_offload": true, "vae": ["4", 0] } },
        "7": { "class_type": "WanVideoSampler", "inputs": { "model": modelInput, "image_embeds": ["6", 0], "text_embeds": ["5", 0], "steps": steps, "cfg": cfg, "shift": shift, "seed": seed, "force_offload": true, "scheduler": scheduler, "riflex_freq_index": 0 } },
        "8": { "class_type": "WanVideoDecode", "inputs": { "vae": ["4", 0], "samples": ["7", 0], "enable_vae_tiling": false, "tile_x": 272, "tile_y": 272, "tile_stride_x": 144, "tile_stride_y": 128 } },
        "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "wan_t2v", "images": ["8", 0] } },
        ...extraNodes
    };
}

function buildWan22ImageToVideoWorkflow(prompt, imagePath, options = {}) {
    const width = options.width || DEFAULTS.WAN22.width;
    const height = options.height || DEFAULTS.WAN22.height;
    const numFrames = options.length || DEFAULTS.WAN22.length;
    const steps = options.steps || DEFAULTS.WAN22.steps;
    const seed = options.seed || Math.floor(Math.random() * 2147483647);
    const cfg = options.cfg || DEFAULTS.WAN22.cfg;
    const shift = options.shift || DEFAULTS.WAN22.shift;
    const scheduler = options.scheduler || DEFAULTS.WAN22.scheduler;
    const modelPath = options.modelPath || DEFAULTS.WAN22.modelPath;
    const t5Path = options.t5Path || DEFAULTS.WAN22.t5Path;
    const clipPath = options.clipPath || DEFAULTS.WAN22.clipPath;
    const vaeName = options.vaeName || DEFAULTS.WAN22.vaeName;

    return {
        "1": { "class_type": "WanVideoModelLoader", "inputs": { "model": modelPath, "base_precision": "bf16", "quantization": "disabled", "load_device": "offload_device" } },
        "2": { "class_type": "LoadWanVideoT5TextEncoder", "inputs": { "model_name": t5Path, "precision": "bf16" } },
        "3": { "class_type": "LoadWanVideoClipTextEncoder", "inputs": { "model_name": clipPath, "precision": "fp16" } },
        "4": { "class_type": "WanVideoVAELoader", "inputs": { "model_name": vaeName, "precision": "bf16" } },
        "5": { "class_type": "WanVideoTextEncode", "inputs": { "positive_prompt": prompt, "negative_prompt": DEFAULTS.VIDEO_NEGATIVE, "t5": ["2", 0], "force_offload": true, "model_to_offload": ["1", 0] } },
        "6": { "class_type": "LoadImage", "inputs": { "image": imagePath } },
        "7": { "class_type": "WanVideoImageToVideoEncode", "inputs": { "width": width, "height": height, "num_frames": numFrames, "noise_aug_strength": 0.0, "start_latent_strength": 1.0, "end_latent_strength": 1.0, "force_offload": true, "vae": ["4", 0], "start_image": ["6", 0] } },
        "8": { "class_type": "WanVideoSampler", "inputs": { "model": ["1", 0], "image_embeds": ["7", 0], "text_embeds": ["5", 0], "steps": steps, "cfg": cfg, "shift": shift, "seed": seed, "force_offload": true, "scheduler": scheduler, "riflex_freq_index": 0 } },
        "9": { "class_type": "WanVideoDecode", "inputs": { "vae": ["4", 0], "samples": ["8", 0], "enable_vae_tiling": false, "tile_x": 272, "tile_y": 272, "tile_stride_x": 144, "tile_stride_y": 128 } },
        "10": { "class_type": "SaveImage", "inputs": { "filename_prefix": "wan_i2v", "images": ["9", 0] } }
    };
}

module.exports = { buildWan22TextToVideoWorkflow, buildWan22ImageToVideoWorkflow };
