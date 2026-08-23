import { useState, useEffect, useRef } from 'react';
import { comicApi } from '../services/api';
import logger from '../shared/logger';

const DEFAULT_WORKFLOW_PARAMS = {
    steps: 20, cfg: 3.0, maxShift: 2.05, baseShift: 0.95,
    sampler: 'euler', videoLength: 25, strength: 1.0
};

const DEFAULT_AUTO_FREE = { enabled: true, idleSeconds: 120, vramThreshold: 0.75 };

export function useStoryboardComfyuiState(currentProject, newBoard, _loadStoryboards) {
    const [comfyuiMode, setComfyuiMode] = useState(false);
    const [comfyuiStatus, setComfyuiStatus] = useState(null);
    const [t2iPrompt, setT2iPrompt] = useState('');
    const [t2iGenerating, setT2iGenerating] = useState(false);
    const [t2iResult, setT2iResult] = useState(null);
    const [i2vPrompt, setI2vPrompt] = useState('');
    const [i2vImage, setI2vImage] = useState('');
    const [i2vGenerating, setI2vGenerating] = useState(false);
    const [i2vResult, setI2vResult] = useState(null);
    const [characterBackups, setCharacterBackups] = useState([]);
    const [workflowParams, setWorkflowParams] = useState({ ...DEFAULT_WORKFLOW_PARAMS });
    const [framePreview, setFramePreview] = useState(null);
    const [frameIndex, setFrameIndex] = useState(0);
    const [freeingMemory, setFreeingMemory] = useState(false);
    const [autoFreeConfig, setAutoFreeConfigState] = useState({ ...DEFAULT_AUTO_FREE });
    const fileInputRef = useRef(null);
    const frameAnimRef = useRef(null);

    useEffect(() => {
        if (comfyuiMode) {
            comicApi.comfyuiSystemInfo().then(res => setComfyuiStatus(res.data)).catch(() => setComfyuiStatus(null));
            comicApi.comfyuiGetAutoFreeConfig().then(res => setAutoFreeConfigState(res.data || DEFAULT_AUTO_FREE)).catch(() => {});
            const interval = setInterval(() => { comicApi.comfyuiSystemInfo().then(res => setComfyuiStatus(res.data)).catch(() => setComfyuiStatus(null)); }, 15000);
            return () => clearInterval(interval);
        }
    }, [comfyuiMode]);

    useEffect(() => {
        if (framePreview?.frames?.length > 1 && framePreview.playing) {
            frameAnimRef.current = setInterval(() => { setFrameIndex(prev => (prev + 1) % framePreview.frames.length); }, 1000 / (framePreview.fps || 8));
            return () => clearInterval(frameAnimRef.current);
        }
        return () => { if (frameAnimRef.current) clearInterval(frameAnimRef.current); };
    }, [framePreview?.playing, framePreview?.frames?.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleTextToImage = async () => {
        if (!t2iPrompt.trim()) { alert('请输入提示词'); return; }
        setT2iGenerating(true); setT2iResult(null);
        try {
            const savePath = currentProject ? `output/${currentProject.id}/characters/char_${Date.now()}.png` : `output/comfyui/t2i_${Date.now()}.png`;
            const res = await comicApi.comfyuiTextToImage({ prompt: t2iPrompt, width: newBoard.width || 768, height: newBoard.height || 512, steps: workflowParams.steps, cfg: workflowParams.cfg, maxShift: workflowParams.maxShift, baseShift: workflowParams.baseShift, sampler: workflowParams.sampler, savePath });
            setT2iResult(res.data);
            if (res.data?.savePath) setCharacterBackups(prev => [...prev, { path: res.data.savePath, url: res.data.url, prompt: t2iPrompt, timestamp: new Date().toLocaleString() }]);
        } catch (e) { setT2iResult({ success: false, error: e.response?.data?.error || e.message }); } finally { setT2iGenerating(false); }
    };

    const handleImageToVideo = async () => {
        if (!i2vPrompt.trim() || !i2vImage) { alert('请输入提示词和选择图片'); return; }
        setI2vGenerating(true); setI2vResult(null);
        try {
            const savePath = currentProject ? `output/${currentProject.id}/videos/vid_${Date.now()}.mp4` : `output/comfyui/i2v_${Date.now()}.mp4`;
            const res = await comicApi.comfyuiImageToVideo({ prompt: i2vPrompt, imagePath: i2vImage, width: newBoard.width || 768, height: newBoard.height || 512, length: workflowParams.videoLength, steps: workflowParams.steps, cfg: workflowParams.cfg, strength: workflowParams.strength, maxShift: workflowParams.maxShift, baseShift: workflowParams.baseShift, sampler: workflowParams.sampler, savePath });
            setI2vResult(res.data);
            if (res.data?.frames?.length > 1) { setFramePreview({ frames: res.data.frames, playing: false, fps: 8 }); setFrameIndex(0); }
        } catch (e) { setI2vResult({ success: false, error: e.response?.data?.error || e.message }); } finally { setI2vGenerating(false); }
    };

    const handleUploadImage = async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        try { const formData = new FormData(); formData.append('image', file); const res = await comicApi.comfyuiUploadImage(formData); if (res.data?.name) setI2vImage(res.data.name); } catch (e) { alert('上传失败: ' + e.message); }
    };

    const selectCharacterBackup = (backup) => { setI2vImage(backup.path); setT2iPrompt(backup.prompt); };

    const handleFreeMemory = async () => {
        setFreeingMemory(true);
        try { const res = await comicApi.comfyuiFreeMemory({ unloadModels: true, freeMemory: true }); if (res.data?.success) { const stats = await comicApi.comfyuiSystemInfo(); if (stats.data) setComfyuiStatus(stats.data); } } catch (e) { logger.error('Storyboard', 'Free memory error:', e.message); } finally { setFreeingMemory(false); }
    };

    const handleUpdateAutoFree = async (key, value) => {
        const newConfig = { ...autoFreeConfig, [key]: value }; setAutoFreeConfigState(newConfig);
        try { await comicApi.comfyuiSetAutoFreeConfig(newConfig); } catch (e) { logger.error('Storyboard', 'Update auto-free config error:', e.message); }
    };

    return {
        comfyuiMode, setComfyuiMode, comfyuiStatus, t2iPrompt, setT2iPrompt,
        t2iGenerating, t2iResult, i2vPrompt, setI2vPrompt, i2vImage, setI2vImage,
        i2vGenerating, i2vResult, characterBackups, workflowParams, setWorkflowParams,
        framePreview, setFramePreview, frameIndex, setFrameIndex, freeingMemory,
        autoFreeConfig, fileInputRef, handleTextToImage, handleImageToVideo,
        handleUploadImage, selectCharacterBackup, handleFreeMemory, handleUpdateAutoFree,
    };
}
