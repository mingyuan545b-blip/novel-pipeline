const path = require('path');

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const OUTPUT_BASE = path.join(__dirname, '..', '..', 'output');

const DEFAULTS = {
    LTX: {
        modelPath: 'LTX-2.3-distilled-Q8_0.gguf',
        textEncoder: 'gemma_3_12B_it_fp8_e4m3fn.safetensors',
        textEncoder2: 'ltx-2.3_text_projection_bf16.safetensors',
        vaeName: 'LTX23_video_vae_bf16.safetensors',
        sampler: 'euler',
        cfg: 3.0,
        maxShift: 2.05,
        baseShift: 0.95,
        width: 768,
        height: 512,
        steps: 20
    },
    LTX_REALISTIC: {
        width: 1280,
        height: 720,
        length: 25,
        steps: 35,
        cfg: 4.5,
        maxShift: 2.5,
        baseShift: 1.0,
        sampler: 'euler_ancestral'
    },
    WAN22: {
        modelPath: 'wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors',
        t5Path: 'umt5_xxl_fp16.safetensors',
        clipPath: 'ViT-L-14-TEXT-detail-improved-hiT-GmP-TE-only-HF.safetensors',
        vaeName: 'wan_2.1_vae.safetensors',
        width: 832,
        height: 480,
        length: 81,
        steps: 20,
        cfg: 5.0,
        shift: 5.0,
        scheduler: 'unipc'
    },
    NEGATIVE_PROMPT: 'low quality, blurry, distorted, deformed, ugly, bad anatomy, watermark, text, logo',
    VIDEO_NEGATIVE: 'low quality, blurry, distorted, deformed, ugly, bad anatomy, watermark, text, logo, static, noise, jitter, cartoon, anime'
};

const AUTO_FREE_DEFAULTS = {
    enabled: true,
    idleSeconds: 120,
    vramThreshold: 0.75
};

module.exports = { COMFYUI_URL, OUTPUT_BASE, DEFAULTS, AUTO_FREE_DEFAULTS };
