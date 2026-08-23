const { DEFAULTS } = require('./comfyuiConstants');

function buildTextToImageWorkflow(prompt, options = {}) {
    const width = options.width || DEFAULTS.LTX.width;
    const height = options.height || DEFAULTS.LTX.height;
    const steps = options.steps || DEFAULTS.LTX.steps;
    const seed = options.seed || Math.floor(Math.random() * 2147483647);
    const cfg = options.cfg || DEFAULTS.LTX.cfg;
    const maxShift = options.maxShift || DEFAULTS.LTX.maxShift;
    const baseShift = options.baseShift || DEFAULTS.LTX.baseShift;
    const samplerName = options.sampler || DEFAULTS.LTX.sampler;
    const modelPath = options.modelPath || DEFAULTS.LTX.modelPath;
    const textEncoder = options.textEncoder || DEFAULTS.LTX.textEncoder;
    const textEncoder2 = options.textEncoder2 || DEFAULTS.LTX.textEncoder2;
    const vaeName = options.vaeName || DEFAULTS.LTX.vaeName;

    return {
        "1": { "class_type": "UnetLoaderGGUF", "inputs": { "unet_name": modelPath } },
        "2": { "class_type": "DualCLIPLoader", "inputs": { "clip_name1": textEncoder, "clip_name2": textEncoder2, "type": "ltxv" } },
        "3": { "class_type": "VAELoader", "inputs": { "vae_name": vaeName } },
        "4": { "class_type": "CLIPTextEncode", "inputs": { "text": prompt, "clip": ["2", 0] } },
        "5": { "class_type": "CLIPTextEncode", "inputs": { "text": DEFAULTS.NEGATIVE_PROMPT, "clip": ["2", 0] } },
        "6": { "class_type": "EmptyLTXVLatentVideo", "inputs": { "width": width, "height": height, "length": 9, "batch_size": 1 } },
        "7": { "class_type": "LTXVConditioning", "inputs": { "positive": ["4", 0], "negative": ["5", 0], "frame_rate": 25.0 } },
        "8": { "class_type": "ModelSamplingLTXV", "inputs": { "model": ["1", 0], "max_shift": maxShift, "base_shift": baseShift } },
        "9": { "class_type": "LTXVScheduler", "inputs": { "steps": steps, "max_shift": maxShift, "base_shift": baseShift, "stretch": true, "terminal": 0.1 } },
        "10": { "class_type": "SamplerCustomAdvanced", "inputs": { "noise": ["11", 0], "guider": ["12", 0], "sampler": ["13", 0], "sigmas": ["9", 0], "latent_image": ["6", 0] } },
        "11": { "class_type": "RandomNoise", "inputs": { "noise_seed": seed } },
        "12": { "class_type": "CFGGuider", "inputs": { "model": ["8", 0], "positive": ["7", 0], "negative": ["7", 1], "cfg": cfg } },
        "13": { "class_type": "KSamplerSelect", "inputs": { "sampler_name": samplerName } },
        "14": { "class_type": "VAEDecode", "inputs": { "samples": ["10", 0], "vae": ["3", 0] } },
        "15": { "class_type": "SaveImage", "inputs": { "filename_prefix": "ltx_t2i", "images": ["14", 0] } }
    };
}

function buildImageToVideoWorkflow(prompt, imagePath, options = {}) {
    const width = options.width || DEFAULTS.LTX.width;
    const height = options.height || DEFAULTS.LTX.height;
    const length = options.length || 25;
    const steps = options.steps || DEFAULTS.LTX.steps;
    const seed = options.seed || Math.floor(Math.random() * 2147483647);
    const strength = options.strength || 1.0;
    const cfg = options.cfg || DEFAULTS.LTX.cfg;
    const maxShift = options.maxShift || DEFAULTS.LTX.maxShift;
    const baseShift = options.baseShift || DEFAULTS.LTX.baseShift;
    const samplerName = options.sampler || DEFAULTS.LTX.sampler;
    const modelPath = options.modelPath || DEFAULTS.LTX.modelPath;
    const textEncoder = options.textEncoder || DEFAULTS.LTX.textEncoder;
    const textEncoder2 = options.textEncoder2 || DEFAULTS.LTX.textEncoder2;
    const vaeName = options.vaeName || DEFAULTS.LTX.vaeName;

    return {
        "1": { "class_type": "UnetLoaderGGUF", "inputs": { "unet_name": modelPath } },
        "2": { "class_type": "DualCLIPLoader", "inputs": { "clip_name1": textEncoder, "clip_name2": textEncoder2, "type": "ltxv" } },
        "3": { "class_type": "VAELoader", "inputs": { "vae_name": vaeName } },
        "4": { "class_type": "CLIPTextEncode", "inputs": { "text": prompt, "clip": ["2", 0] } },
        "5": { "class_type": "CLIPTextEncode", "inputs": { "text": DEFAULTS.NEGATIVE_PROMPT + ", static", "clip": ["2", 0] } },
        "6": { "class_type": "LoadImage", "inputs": { "image": imagePath } },
        "7": { "class_type": "LTXVImgToVideo", "inputs": { "positive": ["4", 0], "negative": ["5", 0], "vae": ["3", 0], "image": ["6", 0], "width": width, "height": height, "length": length, "batch_size": 1, "strength": strength } },
        "8": { "class_type": "ModelSamplingLTXV", "inputs": { "model": ["1", 0], "max_shift": maxShift, "base_shift": baseShift } },
        "9": { "class_type": "LTXVScheduler", "inputs": { "steps": steps, "max_shift": maxShift, "base_shift": baseShift, "stretch": true, "terminal": 0.1 } },
        "10": { "class_type": "SamplerCustomAdvanced", "inputs": { "noise": ["11", 0], "guider": ["12", 0], "sampler": ["13", 0], "sigmas": ["9", 0], "latent_image": ["7", 2] } },
        "11": { "class_type": "RandomNoise", "inputs": { "noise_seed": seed } },
        "12": { "class_type": "CFGGuider", "inputs": { "model": ["8", 0], "positive": ["7", 0], "negative": ["7", 1], "cfg": cfg } },
        "13": { "class_type": "KSamplerSelect", "inputs": { "sampler_name": samplerName } },
        "14": { "class_type": "VAEDecode", "inputs": { "samples": ["10", 0], "vae": ["3", 0] } },
        "15": { "class_type": "SaveImage", "inputs": { "filename_prefix": "ltx_i2v", "images": ["14", 0] } }
    };
}

function buildLTX23RealisticVideoWorkflow(prompt, options = {}) {
    const width = options.width || DEFAULTS.LTX_REALISTIC.width;
    const height = options.height || DEFAULTS.LTX_REALISTIC.height;
    const length = options.length || DEFAULTS.LTX_REALISTIC.length;
    const steps = options.steps || DEFAULTS.LTX_REALISTIC.steps;
    const seed = options.seed || Math.floor(Math.random() * 2147483647);
    const strength = options.strength || 1.0;
    const cfg = options.cfg || DEFAULTS.LTX_REALISTIC.cfg;
    const maxShift = options.maxShift || DEFAULTS.LTX_REALISTIC.maxShift;
    const baseShift = options.baseShift || DEFAULTS.LTX_REALISTIC.baseShift;
    const samplerName = options.sampler || DEFAULTS.LTX_REALISTIC.sampler;
    const modelPath = options.modelPath || DEFAULTS.LTX.modelPath;
    const textEncoder = options.textEncoder || DEFAULTS.LTX.textEncoder;
    const textEncoder2 = options.textEncoder2 || DEFAULTS.LTX.textEncoder2;
    const vaeName = options.vaeName || DEFAULTS.LTX.vaeName;
    const imagePath = options.imagePath || null;

    const realisticPrompt = `cinematic, photorealistic, 4K, detailed skin texture, natural lighting, depth of field, professional cinematography, ${prompt}`;
    const negativePrompt = DEFAULTS.VIDEO_NEGATIVE + ', painting, illustration, 3d render, oversaturated, unnatural colors, flat lighting, amateur, phone camera, vhs, grainy';

    const nodes = {
        "1": { "class_type": "UnetLoaderGGUF", "inputs": { "unet_name": modelPath } },
        "2": { "class_type": "DualCLIPLoader", "inputs": { "clip_name1": textEncoder, "clip_name2": textEncoder2, "type": "ltxv" } },
        "3": { "class_type": "VAELoader", "inputs": { "vae_name": vaeName } },
        "4": { "class_type": "CLIPTextEncode", "inputs": { "text": realisticPrompt, "clip": ["2", 0] } },
        "5": { "class_type": "CLIPTextEncode", "inputs": { "text": negativePrompt, "clip": ["2", 0] } },
        "8": { "class_type": "ModelSamplingLTXV", "inputs": { "model": ["1", 0], "max_shift": maxShift, "base_shift": baseShift } },
        "9": { "class_type": "LTXVScheduler", "inputs": { "steps": steps, "max_shift": maxShift, "base_shift": baseShift, "stretch": true, "terminal": 0.1 } },
        "11": { "class_type": "RandomNoise", "inputs": { "noise_seed": seed } },
        "13": { "class_type": "KSamplerSelect", "inputs": { "sampler_name": samplerName } }
    };

    if (imagePath) {
        nodes["6"] = { "class_type": "LoadImage", "inputs": { "image": imagePath } };
        nodes["7"] = { "class_type": "LTXVImgToVideo", "inputs": { "positive": ["4", 0], "negative": ["5", 0], "vae": ["3", 0], "image": ["6", 0], "width": width, "height": height, "length": length, "batch_size": 1, "strength": strength } };
        nodes["10"] = { "class_type": "SamplerCustomAdvanced", "inputs": { "noise": ["11", 0], "guider": ["12", 0], "sampler": ["13", 0], "sigmas": ["9", 0], "latent_image": ["7", 2] } };
        nodes["12"] = { "class_type": "CFGGuider", "inputs": { "model": ["8", 0], "positive": ["7", 0], "negative": ["7", 1], "cfg": cfg } };
    } else {
        nodes["6"] = { "class_type": "EmptyLTXVLatentVideo", "inputs": { "width": width, "height": height, "length": length, "batch_size": 1 } };
        nodes["7"] = { "class_type": "LTXVConditioning", "inputs": { "positive": ["4", 0], "negative": ["5", 0], "frame_rate": 25.0 } };
        nodes["10"] = { "class_type": "SamplerCustomAdvanced", "inputs": { "noise": ["11", 0], "guider": ["12", 0], "sampler": ["13", 0], "sigmas": ["9", 0], "latent_image": ["6", 0] } };
        nodes["12"] = { "class_type": "CFGGuider", "inputs": { "model": ["8", 0], "positive": ["7", 0], "negative": ["7", 1], "cfg": cfg } };
    }

    nodes["14"] = { "class_type": "VAEDecode", "inputs": { "samples": ["10", 0], "vae": ["3", 0] } };
    nodes["15"] = { "class_type": "VHS_VideoCombine", "inputs": { "images": ["14", 0], "filename_prefix": "ltx_realistic", "format": "video/h264-mp4", "frame_rate": 25, "loop_count": 0, "pingpong": false, "save_output": true } };

    return nodes;
}

module.exports = { buildTextToImageWorkflow, buildImageToVideoWorkflow, buildLTX23RealisticVideoWorkflow };
