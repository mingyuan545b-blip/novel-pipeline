import { useState, useEffect, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import { comicApi } from '../services/api';

const STATUS_MAP = {
    draft: { label: '草稿', color: 'var(--text-muted)' },
    ready: { label: '待渲染', color: 'var(--neon-blue)' },
    rendering: { label: '渲染中', color: 'var(--neon-orange)' },
    done: { label: '已完成', color: 'var(--neon-green)' },
    failed: { label: '失败', color: 'var(--neon-red)' }
};

const DEFAULT_VOICES = [
    { key: 'zh-CN-XiaoxiaoNeural', name: '晓晓（女·温柔）' },
    { key: 'zh-CN-YunxiNeural', name: '云希（男·阳光）' },
    { key: 'zh-CN-YunjianNeural', name: '云健（男·沉稳）' },
    { key: 'zh-CN-XiaoyiNeural', name: '晓依（女·活泼）' },
    { key: 'zh-CN-YunyangNeural', name: '云扬（男·新闻）' }
];

export default function ComicStoryboardPage() {
    const { currentProject, chapters } = useAppStore();
    const [storyboards, setStoryboards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newBoard, setNewBoard] = useState({
        chapterId: '', sceneIndex: 0, description: '', prompt: '',
        negativePrompt: '', workflowId: '', width: 768, height: 512,
        dialogue: '', voice: '', duration: 5
    });
    const [voices, setVoices] = useState(DEFAULT_VOICES);
    const [exporting, setExporting] = useState(false);
    const [exportResult, setExportResult] = useState(null);

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
    const [workflowParams, setWorkflowParams] = useState({
        steps: 20, cfg: 3.0, maxShift: 2.05, baseShift: 0.95,
        sampler: 'euler', videoLength: 25, strength: 1.0
    });
    const [framePreview, setFramePreview] = useState(null);
    const [frameIndex, setFrameIndex] = useState(0);
    const [converting, setConverting] = useState(false);
    const [freeingMemory, setFreeingMemory] = useState(false);
    const [autoFreeConfig, setAutoFreeConfigState] = useState({ enabled: true, idleSeconds: 120, vramThreshold: 0.75 });
    const fileInputRef = useRef(null);
    const frameAnimRef = useRef(null);

    useEffect(() => { loadStoryboards(); }, [currentProject]);
    useEffect(() => {
        comicApi.getTTSVoices().then(res => { if (res.data?.length) setVoices(res.data); }).catch(() => {});
    }, []);
    useEffect(() => {
        if (comfyuiMode) {
            comicApi.comfyuiSystemInfo().then(res => setComfyuiStatus(res.data)).catch(() => setComfyuiStatus(null));
            comicApi.comfyuiGetAutoFreeConfig().then(res => setAutoFreeConfigState(res.data || autoFreeConfig)).catch(() => {});
            const interval = setInterval(() => {
                comicApi.comfyuiSystemInfo().then(res => setComfyuiStatus(res.data)).catch(() => setComfyuiStatus(null));
            }, 15000);
            return () => clearInterval(interval);
        }
    }, [comfyuiMode]);
    useEffect(() => {
        if (framePreview?.frames?.length > 1 && framePreview.playing) {
            frameAnimRef.current = setInterval(() => {
                setFrameIndex(prev => (prev + 1) % framePreview.frames.length);
            }, 1000 / (framePreview.fps || 8));
            return () => clearInterval(frameAnimRef.current);
        }
        return () => { if (frameAnimRef.current) clearInterval(frameAnimRef.current); };
    }, [framePreview?.playing, framePreview?.frames?.length]);

    const loadStoryboards = async () => {
        if (!currentProject) return;
        setLoading(true);
        try {
            const res = await comicApi.getStoryboards(currentProject.id);
            setStoryboards(res.data || []);
        } catch { setStoryboards([]); }
        finally { setLoading(false); }
    };

    const handleCreate = async () => {
        if (!newBoard.description.trim()) { alert('请输入分镜描述'); return; }
        setLoading(true);
        try {
            await comicApi.createStoryboard({ ...newBoard, projectId: currentProject.id });
            setNewBoard({ chapterId: '', sceneIndex: 0, description: '', prompt: '', negativePrompt: '', workflowId: '', width: 768, height: 512, dialogue: '', voice: '', duration: 5 });
            setShowCreate(false);
            await loadStoryboards();
        } catch (e) { alert('创建失败: ' + e.message); }
        finally { setLoading(false); }
    };

    const handleRender = async (id) => {
        try { await comicApi.renderStoryboard(id); await loadStoryboards(); }
        catch (e) { alert('渲染失败: ' + e.message); }
    };

    const handleBatchRender = async () => {
        const readyBoards = storyboards.filter(s => s.status === 'ready');
        if (readyBoards.length === 0) { alert('没有待渲染的分镜'); return; }
        try { await comicApi.batchRender(readyBoards.map(s => s.id)); await loadStoryboards(); }
        catch (e) { alert('批量渲染失败: ' + e.message); }
    };

    const handleExportEpisode = async () => {
        if (!currentProject) return;
        const doneBoards = storyboards.filter(s => s.status === 'done' && s.imageUrl);
        if (doneBoards.length === 0) { alert('没有已完成的分镜可导出'); return; }
        setExporting(true);
        setExportResult(null);
        try {
            const scenes = doneBoards.map((sb) => ({
                imagePath: sb.imageUrl || '',
                videoPath: sb.videoUrl || '',
                dialogue: sb.dialogue || '',
                voice: sb.voice || '',
                duration: sb.duration || 5
            }));
            const res = await comicApi.exportEpisode({
                projectId: currentProject.id,
                episode: 1,
                title: `EP01-${currentProject.name || '漫剧'}`,
                scenes,
                defaultVoice: 'zh-CN-YunxiNeural',
                burnSubtitles: true
            });
            setExportResult(res.data);
        } catch (e) {
            setExportResult({ success: false, error: e.response?.data?.error || e.message });
        } finally { setExporting(false); }
    };

    const handleTTSPreview = async (text, voice) => {
        if (!text || !currentProject) return;
        try {
            await comicApi.synthesizeTTS({
                text, voice: voice || 'zh-CN-YunxiNeural',
                projectId: currentProject.id,
                fileName: `preview_${Date.now()}.mp3`
            });
            alert('语音已生成');
        } catch (e) { alert('TTS失败: ' + e.message); }
    };

    const handleTextToImage = async () => {
        if (!t2iPrompt.trim()) { alert('请输入提示词'); return; }
        setT2iGenerating(true);
        setT2iResult(null);
        try {
            const savePath = currentProject
                ? `output/${currentProject.id}/characters/char_${Date.now()}.png`
                : `output/comfyui/t2i_${Date.now()}.png`;
            const res = await comicApi.comfyuiTextToImage({
                prompt: t2iPrompt,
                width: newBoard.width || 768,
                height: newBoard.height || 512,
                steps: workflowParams.steps,
                cfg: workflowParams.cfg,
                maxShift: workflowParams.maxShift,
                baseShift: workflowParams.baseShift,
                sampler: workflowParams.sampler,
                savePath
            });
            setT2iResult(res.data);
            if (res.data?.savePath) {
                setCharacterBackups(prev => [...prev, {
                    path: res.data.savePath,
                    url: res.data.url,
                    prompt: t2iPrompt,
                    timestamp: new Date().toLocaleString()
                }]);
            }
        } catch (e) {
            setT2iResult({ success: false, error: e.response?.data?.error || e.message });
        } finally { setT2iGenerating(false); }
    };

    const handleImageToVideo = async () => {
        if (!i2vPrompt.trim() || !i2vImage) { alert('请输入提示词和选择图片'); return; }
        setI2vGenerating(true);
        setI2vResult(null);
        try {
            const savePath = currentProject
                ? `output/${currentProject.id}/videos/vid_${Date.now()}.mp4`
                : `output/comfyui/i2v_${Date.now()}.mp4`;
            const res = await comicApi.comfyuiImageToVideo({
                prompt: i2vPrompt,
                imagePath: i2vImage,
                width: newBoard.width || 768,
                height: newBoard.height || 512,
                length: workflowParams.videoLength,
                steps: workflowParams.steps,
                cfg: workflowParams.cfg,
                strength: workflowParams.strength,
                maxShift: workflowParams.maxShift,
                baseShift: workflowParams.baseShift,
                sampler: workflowParams.sampler,
                savePath
            });
            setI2vResult(res.data);
            if (res.data?.frames?.length > 1) {
                setFramePreview({ frames: res.data.frames, playing: false, fps: 8 });
                setFrameIndex(0);
            }
        } catch (e) {
            setI2vResult({ success: false, error: e.response?.data?.error || e.message });
        } finally { setI2vGenerating(false); }
    };

    const handleUploadImage = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append('image', file);
            const res = await comicApi.comfyuiUploadImage(formData);
            if (res.data?.name) {
                setI2vImage(res.data.name);
            }
        } catch (e) { alert('上传失败: ' + e.message); }
    };

    const selectCharacterBackup = (backup) => {
        setI2vImage(backup.path);
        setT2iPrompt(backup.prompt);
    };

    const handleFreeMemory = async () => {
        setFreeingMemory(true);
        try {
            const res = await comicApi.comfyuiFreeMemory({ unloadModels: true, freeMemory: true });
            if (res.data?.success) {
                const stats = await comicApi.comfyuiSystemInfo();
                if (stats.data) setComfyuiStatus(stats.data);
            }
        } catch (e) { console.error('Free memory error:', e); }
        finally { setFreeingMemory(false); }
    };

    const handleUpdateAutoFree = async (key, value) => {
        const newConfig = { ...autoFreeConfig, [key]: value };
        setAutoFreeConfigState(newConfig);
        try {
            await comicApi.comfyuiSetAutoFreeConfig(newConfig);
        } catch (e) { console.error('Update auto-free config error:', e); }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">分镜管理</h1>
                <p className="page-subtitle">管理漫剧分镜，配置画面提示词+台词语音，渲染后导出完整剧集</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(STATUS_MAP).map(([key, val]) => {
                        const count = storyboards.filter(s => s.status === key).length;
                        return (
                            <span key={key} className="cyber-badge" style={{ borderColor: val.color, color: val.color }}>
                                {val.label} ({count})
                            </span>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="cyber-btn" onClick={() => setComfyuiMode(!comfyuiMode)}
                        style={{ color: comfyuiMode ? 'var(--neon-green)' : 'var(--neon-purple)' }}>
                        {comfyuiMode ? '◈ ComfyUI模式 ON' : '◇ ComfyUI模式'}
                    </button>
                    <button className="cyber-btn" onClick={handleBatchRender}>▶ 批量渲染</button>
                    <button className="cyber-btn" style={{ color: 'var(--neon-purple)' }} onClick={handleExportEpisode} disabled={exporting}>
                        {exporting ? <><span className="cyber-loading"></span> 导出中</> : '▲ 导出剧集'}
                    </button>
                    <button className="cyber-btn cyber-btn-primary" onClick={() => setShowCreate(!showCreate)}>
                        {showCreate ? '✕ 取消' : '+ 新建分镜'}
                    </button>
                </div>
            </div>

            {comfyuiMode && (
                <div className="cyber-card" style={{ marginBottom: 20, borderColor: 'var(--neon-purple)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div className="cyber-section-title" style={{ color: 'var(--neon-purple)', margin: 0 }}>
                            ComfyUI LTX 2.3 工作流
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {comfyuiStatus && comfyuiStatus.devices?.[0] && (() => {
                                const dev = comfyuiStatus.devices[0];
                                const used = dev.vram_total - dev.vram_free;
                                const pct = (used / dev.vram_total * 100).toFixed(0);
                                const usedGB = (used / 1073741824).toFixed(1);
                                const totalGB = (dev.vram_total / 1073741824).toFixed(1);
                                const barColor = pct > 80 ? 'var(--neon-red)' : pct > 60 ? 'var(--neon-orange)' : 'var(--neon-green)';
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>VRAM</span>
                                        <div style={{ width: 120, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.5s ease' }} />
                                        </div>
                                        <span style={{ fontSize: 10, color: barColor, fontWeight: 600 }}>{usedGB}/{totalGB}GB ({pct}%)</span>
                                    </div>
                                );
                            })()}
                            {!comfyuiStatus && <span style={{ fontSize: 11, color: 'var(--neon-red)' }}>● 未连接</span>}
                            <button className="cyber-btn" onClick={handleFreeMemory} disabled={freeingMemory}
                                style={{ fontSize: 10, padding: '2px 10px', color: freeingMemory ? 'var(--neon-orange)' : 'var(--neon-red)' }}>
                                {freeingMemory ? '⟳ 释放中' : '♻ 释放显存'}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: 16, padding: '6px 12px', background: 'rgba(0,240,255,0.03)', borderRadius: 6, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>自动回收</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10 }}>
                            <input type="checkbox" checked={autoFreeConfig.enabled}
                                onChange={e => handleUpdateAutoFree('enabled', e.target.checked)}
                                style={{ width: 12, height: 12 }} />
                            <span style={{ color: autoFreeConfig.enabled ? 'var(--neon-green)' : 'var(--text-muted)' }}>
                                {autoFreeConfig.enabled ? 'ON' : 'OFF'}
                            </span>
                        </label>
                        {autoFreeConfig.enabled && (
                            <>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>空闲</span>
                                <input className="cyber-input" type="number" value={autoFreeConfig.idleSeconds}
                                    onChange={e => handleUpdateAutoFree('idleSeconds', parseInt(e.target.value) || 120)}
                                    min={30} max={600} step={30}
                                    style={{ width: 50, padding: '2px 4px', fontSize: 10, textAlign: 'center' }} />
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>秒后回收</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>VRAM阈值</span>
                                <input className="cyber-input" type="number" value={(autoFreeConfig.vramThreshold * 100).toFixed(0)}
                                    onChange={e => handleUpdateAutoFree('vramThreshold', (parseInt(e.target.value) || 75) / 100)}
                                    min={30} max={95} step={5}
                                    style={{ width: 40, padding: '2px 4px', fontSize: 10, textAlign: 'center' }} />
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>%</span>
                            </>
                        )}
                    </div>

                    <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(0,240,255,0.03)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>工作流参数</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                            {[
                                { key: 'steps', label: '步数', type: 'number', min: 1, max: 50 },
                                { key: 'cfg', label: 'CFG', type: 'number', min: 0.5, max: 10, step: 0.5 },
                                { key: 'maxShift', label: 'MaxShift', type: 'number', min: 0.1, max: 5, step: 0.05 },
                                { key: 'baseShift', label: 'BaseShift', type: 'number', min: 0.1, max: 3, step: 0.05 },
                                { key: 'videoLength', label: '帧数', type: 'number', min: 1, max: 257 },
                                { key: 'strength', label: '强度', type: 'number', min: 0.1, max: 1.5, step: 0.1 },
                            ].map(p => (
                                <div key={p.key}>
                                    <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{p.label}</label>
                                    <input className="cyber-input" type={p.type} value={workflowParams[p.key]}
                                        onChange={e => setWorkflowParams(prev => ({ ...prev, [p.key]: parseFloat(e.target.value) || prev[p.key] }))}
                                        min={p.min} max={p.max} step={p.step || 1}
                                        style={{ width: '100%', padding: '4px 6px', fontSize: 11, boxSizing: 'border-box' }} />
                                </div>
                            ))}
                            <div>
                                <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>采样器</label>
                                <select className="cyber-input" value={workflowParams.sampler}
                                    onChange={e => setWorkflowParams(prev => ({ ...prev, sampler: e.target.value }))}
                                    style={{ width: '100%', padding: '4px 6px', fontSize: 11, boxSizing: 'border-box' }}>
                                    {['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpmpp_2m', 'dpmpp_sde', 'dpmpp_2m_sde'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--neon-blue)', marginBottom: 12, fontSize: 13 }}>
                                📷 文生图 (Text-to-Image)
                            </div>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">提示词</label>
                                <textarea className="cyber-textarea" value={t2iPrompt}
                                    onChange={e => setT2iPrompt(e.target.value)}
                                    rows={3} placeholder="A young warrior standing on a mountain, cinematic lighting, detailed face..." />
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">宽度</label>
                                    <input className="cyber-input" type="number" value={newBoard.width}
                                        onChange={e => setNewBoard(prev => ({ ...prev, width: parseInt(e.target.value) || 768 }))}
                                        min={256} max={2048} step={64} style={{ width: '100%', boxSizing: 'border-box' }} />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">高度</label>
                                    <input className="cyber-input" type="number" value={newBoard.height}
                                        onChange={e => setNewBoard(prev => ({ ...prev, height: parseInt(e.target.value) || 512 }))}
                                        min={256} max={2048} step={64} style={{ width: '100%', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <button className="cyber-btn cyber-btn-primary" onClick={handleTextToImage} disabled={t2iGenerating}
                                style={{ width: '100%' }}>
                                {t2iGenerating ? <><span className="cyber-loading"></span> 生成中...</> : '📷 生成图片'}
                            </button>
                            {t2iResult && (
                                <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: t2iResult.success ? 'rgba(0,255,136,0.05)' : 'rgba(255,0,68,0.05)', border: `1px solid ${t2iResult.success ? 'var(--neon-green)' : 'var(--neon-red)'}` }}>
                                    {t2iResult.success ? (
                                        <div>
                                            <div style={{ color: 'var(--neon-green)', fontSize: 12, marginBottom: 4 }}>✓ 图片已生成</div>
                                            {t2iResult.savePath && <div style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{t2iResult.savePath}</div>}
                                            {t2iResult.url && <img src={t2iResult.url} alt="generated" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4, marginTop: 8 }} />}
                                        </div>
                                    ) : (
                                        <div style={{ color: 'var(--neon-red)', fontSize: 12 }}>✗ {t2iResult.error}</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--neon-orange)', marginBottom: 12, fontSize: 13 }}>
                                🎬 图生视频 (Image-to-Video)
                            </div>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">图片来源</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input className="cyber-input" value={i2vImage}
                                        onChange={e => setI2vImage(e.target.value)}
                                        placeholder="输入图片文件名或路径" style={{ flex: 1, boxSizing: 'border-box' }} />
                                    <button className="cyber-btn" onClick={() => fileInputRef.current?.click()}
                                        style={{ whiteSpace: 'nowrap', padding: '0 12px' }}>
                                        📁 上传
                                    </button>
                                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                                        onChange={handleUploadImage} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">运动提示词</label>
                                <textarea className="cyber-textarea" value={i2vPrompt}
                                    onChange={e => setI2vPrompt(e.target.value)}
                                    rows={3} placeholder="Camera slowly zooms in, character turns head, wind blowing hair..." />
                            </div>
                            <button className="cyber-btn cyber-btn-primary" onClick={handleImageToVideo} disabled={i2vGenerating}
                                style={{ width: '100%', background: 'linear-gradient(135deg, rgba(255,145,0,0.12), rgba(231,76,60,0.08))' }}>
                                {i2vGenerating ? <><span className="cyber-loading"></span> 生成视频中...</> : '🎬 生成视频'}
                            </button>
                            {i2vResult && (
                                <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: i2vResult.success ? 'rgba(0,255,136,0.05)' : 'rgba(255,0,68,0.05)', border: `1px solid ${i2vResult.success ? 'var(--neon-green)' : 'var(--neon-red)'}` }}>
                                    {i2vResult.success ? (
                                        <div>
                                            <div style={{ color: 'var(--neon-green)', fontSize: 12, marginBottom: 4 }}>✓ 视频已生成</div>
                                            {i2vResult.savePath && <div style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{i2vResult.savePath}</div>}
                                        </div>
                                    ) : (
                                        <div style={{ color: 'var(--neon-red)', fontSize: 12 }}>✗ {i2vResult.error}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {characterBackups.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <div className="cyber-section-title" style={{ fontSize: 13, color: 'var(--neon-green)', marginBottom: 12 }}>
                                🗂️ 人物形象备份（确保一致性）
                            </div>
                            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                                {characterBackups.map((backup, i) => (
                                    <div key={i} className="cyber-card" style={{
                                        minWidth: 140, cursor: 'pointer', padding: 8,
                                        borderColor: i2vImage === backup.path ? 'var(--neon-green)' : undefined
                                    }} onClick={() => selectCharacterBackup(backup)}>
                                        {backup.url && (
                                            <img src={backup.url} alt={`char ${i+1}`} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, marginBottom: 4 }} />
                                        )}
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                            人物 {i + 1}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                                            {backup.prompt.substring(0, 30)}...
                                        </div>
                                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                                            {backup.timestamp}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {framePreview?.frames?.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <div className="cyber-section-title" style={{ fontSize: 13, color: 'var(--neon-orange)', marginBottom: 12 }}>
                                🎞️ 帧预览 ({framePreview.frames.length} 帧)
                            </div>
                            <div style={{ position: 'relative', background: 'rgba(0,0,0,0.3)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                                <img src={framePreview.frames[frameIndex]} alt={`frame ${frameIndex}`}
                                    style={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
                                <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                                    {frameIndex + 1}/{framePreview.frames.length}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button className="cyber-btn" style={{ padding: '4px 12px', fontSize: 11 }}
                                    onClick={() => setFramePreview(prev => ({ ...prev, playing: !prev.playing }))}>
                                    {framePreview.playing ? '⏸ 暂停' : '▶ 播放'}
                                </button>
                                <input type="range" min={0} max={framePreview.frames.length - 1} value={frameIndex}
                                    onChange={e => { setFrameIndex(parseInt(e.target.value)); setFramePreview(prev => ({ ...prev, playing: false })); }}
                                    style={{ flex: 1 }} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {exportResult && (
                <div className="cyber-card" style={{
                    marginBottom: 20,
                    borderColor: exportResult.success ? 'var(--neon-green)' : 'var(--neon-red)',
                    background: exportResult.success ? 'rgba(0,255,136,0.05)' : 'rgba(255,0,68,0.05)'
                }}>
                    <div style={{ color: exportResult.success ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 600, marginBottom: 8 }}>
                        {exportResult.success ? '✓ 导出成功' : '✗ 导出失败'}
                    </div>
                    {exportResult.success ? (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                            <div>标题: {exportResult.episodeTitle} | 场景: {exportResult.sceneCount} | 语音: {exportResult.ttsGenerated}段</div>
                            <div>输出: <code style={{ fontFamily: 'monospace' }}>{exportResult.outputPath}</code></div>
                            {exportResult.subtitlePath && <div>字幕: <code style={{ fontFamily: 'monospace' }}>{exportResult.subtitlePath}</code></div>}
                            <div>大小: {(exportResult.fileSize / 1048576).toFixed(1)} MB</div>
                        </div>
                    ) : (
                        <div style={{ fontSize: 12, color: 'var(--neon-red)' }}>{exportResult.error}</div>
                    )}
                </div>
            )}

            {showCreate && (
                <div className="cyber-card" style={{ marginBottom: 20, borderColor: 'var(--neon-green)' }}>
                    <h4 style={{ color: 'var(--neon-green)', marginBottom: 16 }}>新建分镜</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">关联章节</label>
                            <select className="cyber-input" value={newBoard.chapterId}
                                onChange={e => setNewBoard(prev => ({ ...prev, chapterId: e.target.value }))}
                                style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}>
                                <option value="">不关联章节</option>
                                {chapters.map(ch => (
                                    <option key={ch.id} value={ch.id}>第{ch.chapterNumber}章: {ch.title}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">场景序号</label>
                            <input className="cyber-input" type="number" value={newBoard.sceneIndex}
                                onChange={e => setNewBoard(prev => ({ ...prev, sceneIndex: parseInt(e.target.value) || 0 }))}
                                min={0} style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">分镜描述</label>
                        <textarea className="cyber-textarea" value={newBoard.description}
                            onChange={e => setNewBoard(prev => ({ ...prev, description: e.target.value }))}
                            rows={2} placeholder="描述这个分镜的画面内容..." />
                    </div>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">正向提示词 (Prompt)</label>
                        <textarea className="cyber-textarea" value={newBoard.prompt}
                            onChange={e => setNewBoard(prev => ({ ...prev, prompt: e.target.value }))}
                            rows={2} placeholder="masterpiece, best quality, 1girl, ..." />
                    </div>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">反向提示词 (Negative Prompt)</label>
                        <textarea className="cyber-textarea" value={newBoard.negativePrompt}
                            onChange={e => setNewBoard(prev => ({ ...prev, negativePrompt: e.target.value }))}
                            rows={2} placeholder="lowres, bad anatomy, bad hands, ..." />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">宽度</label>
                            <input className="cyber-input" type="number" value={newBoard.width}
                                onChange={e => setNewBoard(prev => ({ ...prev, width: parseInt(e.target.value) || 768 }))}
                                min={256} max={4096} step={64} style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">高度</label>
                            <input className="cyber-input" type="number" value={newBoard.height}
                                onChange={e => setNewBoard(prev => ({ ...prev, height: parseInt(e.target.value) || 512 }))}
                                min={256} max={4096} step={64} style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>
                    <div className="cyber-section-title" style={{ fontSize: 13, marginTop: 8 }}>台词 & 语音</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">台词/旁白</label>
                            <textarea className="cyber-textarea" value={newBoard.dialogue}
                                onChange={e => setNewBoard(prev => ({ ...prev, dialogue: e.target.value }))}
                                rows={2} placeholder="角色台词或旁白文字..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">语音角色</label>
                            <select className="cyber-input" value={newBoard.voice}
                                onChange={e => setNewBoard(prev => ({ ...prev, voice: e.target.value }))}
                                style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}>
                                <option value="">默认</option>
                                {voices.map(v => <option key={v.key} value={v.key}>{v.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">时长(秒)</label>
                            <input className="cyber-input" type="number" value={newBoard.duration}
                                onChange={e => setNewBoard(prev => ({ ...prev, duration: parseInt(e.target.value) || 5 }))}
                                min={1} max={60} style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="cyber-btn cyber-btn-primary" onClick={handleCreate} disabled={loading}>
                            {loading ? <><span className="cyber-loading"></span> 创建中</> : '◈ 创建分镜'}
                        </button>
                        {newBoard.dialogue && (
                            <button className="cyber-btn" onClick={() => handleTTSPreview(newBoard.dialogue, newBoard.voice)}>
                                ♪ 试听语音
                            </button>
                        )}
                    </div>
                </div>
            )}

            {storyboards.length === 0 && !loading ? (
                <div className="cyber-card" style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>▦</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>暂无分镜数据，点击"新建分镜"开始创作</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {storyboards.map(sb => {
                        const statusInfo = STATUS_MAP[sb.status] || STATUS_MAP.draft;
                        return (
                            <div key={sb.id} className="cyber-card">
                                <div style={{
                                    width: '100%', height: 160, borderRadius: 'var(--radius-md)',
                                    background: sb.imageUrl ? `url(${sb.imageUrl}) center/cover` : 'rgba(0,240,255,0.03)',
                                    border: '1px solid var(--border-color)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: 12, overflow: 'hidden'
                                }}>
                                    {!sb.imageUrl && <span style={{ fontSize: 40, opacity: 0.2 }}>▦</span>}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <span className="cyber-badge" style={{ borderColor: statusInfo.color, color: statusInfo.color, fontSize: 10 }}>
                                        {statusInfo.label}
                                    </span>
                                    {sb.status === 'ready' && (
                                        <button className="cyber-btn" style={{ color: 'var(--neon-green)', fontSize: 11, padding: '2px 8px' }}
                                            onClick={() => handleRender(sb.id)}>▶ 渲染</button>
                                    )}
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4, fontWeight: 600 }}>
                                    {sb.description?.substring(0, 60) || '未命名分镜'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {sb.width}x{sb.height} | 场景{sb.sceneIndex}
                                    {sb.dialogue && <span style={{ marginLeft: 8, color: 'var(--neon-blue)' }}>♪ 有台词</span>}
                                </div>
                                {sb.dialogue && (
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {sb.dialogue.substring(0, 50)}{sb.dialogue.length > 50 ? '...' : ''}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
