import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../store/useAppStore';
import { comicApi } from '../services/api';

const DEFAULT_VOICES = [
    { key: 'zh-CN-XiaoxiaoNeural', name: '晓晓（女·温柔）' },
    { key: 'zh-CN-XiaoyiNeural', name: '晓依（女·活泼）' },
    { key: 'zh-CN-YunjianNeural', name: '云健（男·沉稳）' },
    { key: 'zh-CN-YunxiNeural', name: '云希（男·阳光）' },
    { key: 'zh-CN-YunxiaNeural', name: '云夏（男·少年）' },
    { key: 'zh-CN-YunyangNeural', name: '云扬（男·新闻）' }
];

export default function ComicExportPage() {
    const { currentProject } = useAppStore();
    const [voices, setVoices] = useState(DEFAULT_VOICES);
    const [defaultVoice, setDefaultVoice] = useState('zh-CN-YunxiNeural');
    const [episodeNumber, setEpisodeNumber] = useState(1);
    const [episodeTitle, setEpisodeTitle] = useState('');
    const [scenes, setScenes] = useState([
        { imagePath: '', videoPath: '', dialogue: '', voice: '', duration: 5 }
    ]);
    const [exporting, setExporting] = useState(false);
    const [exportResult, setExportResult] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [burnSubtitles, setBurnSubtitles] = useState(false);

    useEffect(() => {
        comicApi.getTTSVoices().then(res => {
            if (res.data?.length) setVoices(res.data);
        }).catch(() => {});
    }, []);

    const loadEpisodes = useCallback(async () => {
        if (!currentProject) return;
        try {
            const res = await comicApi.getExportStatus(currentProject.id);
            setEpisodes(res.data?.episodes || []);
        } catch {}
    }, [currentProject]);

    useEffect(() => { loadEpisodes(); }, [loadEpisodes]);

    const addScene = () => {
        setScenes([...scenes, { imagePath: '', videoPath: '', dialogue: '', voice: '', duration: 5 }]);
    };

    const removeScene = (idx) => {
        if (scenes.length <= 1) return;
        setScenes(scenes.filter((_, i) => i !== idx));
    };

    const updateScene = (idx, field, value) => {
        const updated = [...scenes];
        updated[idx] = { ...updated[idx], [field]: value };
        setScenes(updated);
    };

    const handleExport = async () => {
        if (!currentProject) return;
        setExporting(true);
        setExportResult(null);
        try {
            const res = await comicApi.exportEpisode({
                projectId: currentProject.id,
                episode: episodeNumber,
                title: episodeTitle || `EP${String(episodeNumber).padStart(2, '0')}`,
                scenes,
                defaultVoice,
                burnSubtitles
            });
            setExportResult(res.data);
            loadEpisodes();
        } catch (e) {
            setExportResult({ success: false, error: e.response?.data?.error || e.message });
        } finally {
            setExporting(false);
        }
    };

    const handleTTSPreview = async (text, voice) => {
        if (!text || !currentProject) return;
        try {
            await comicApi.synthesizeTTS({
                text,
                voice: voice || defaultVoice,
                projectId: currentProject.id,
                fileName: `preview_${Date.now()}.mp3`
            });
        } catch (e) {
            console.error('TTS preview error:', e);
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">漫剧导出</h1>
                <p className="page-subtitle">TTS语音合成 + 视频合成 + 字幕导出</p>
            </div>

            <div className="cyber-section-title">剧集配置</div>
            <div className="cyber-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">集数</label>
                        <input className="cyber-input" type="number" value={episodeNumber}
                            onChange={e => setEpisodeNumber(parseInt(e.target.value) || 1)} min={1}
                            style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">标题</label>
                        <input className="cyber-input" value={episodeTitle}
                            onChange={e => setEpisodeTitle(e.target.value)}
                            placeholder="例：第一章 初遇"
                            style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">默认语音</label>
                        <select className="cyber-input" value={defaultVoice}
                            onChange={e => setDefaultVoice(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', boxSizing: 'border-box' }}>
                            {voices.map(v => (
                                <option key={v.key} value={v.key}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div style={{ marginTop: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={burnSubtitles}
                            onChange={e => setBurnSubtitles(e.target.checked)}
                            style={{ accentColor: 'var(--neon-blue)' }} />
                        烧录字幕到视频（硬字幕）
                    </label>
                </div>
            </div>

            <div className="cyber-section-title">场景列表</div>
            {scenes.map((scene, idx) => (
                <div key={idx} className="cyber-card" style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, color: 'var(--neon-blue)' }}>场景 {idx + 1}</span>
                        <button className="cyber-btn" style={{ fontSize: 10, color: 'var(--neon-red)', padding: '2px 8px' }}
                            onClick={() => removeScene(idx)}>删除</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">图片路径</label>
                            <input className="cyber-input" value={scene.imagePath}
                                onChange={e => updateScene(idx, 'imagePath', e.target.value)}
                                placeholder="output/xxx/images/第01章-标题-场景.png"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">视频路径（可选，优先于图片）</label>
                            <input className="cyber-input" value={scene.videoPath}
                                onChange={e => updateScene(idx, 'videoPath', e.target.value)}
                                placeholder="output/xxx/video/scene.mp4"
                                style={{ width: '100%', boxSizing: 'border-box' }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">台词/旁白（TTS语音合成）</label>
                            <textarea className="cyber-input" value={scene.dialogue}
                                onChange={e => updateScene(idx, 'dialogue', e.target.value)}
                                placeholder="角色台词或旁白文字..."
                                rows={2}
                                style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">语音</label>
                                <select className="cyber-input" value={scene.voice || defaultVoice}
                                    onChange={e => updateScene(idx, 'voice', e.target.value)}
                                    style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box', fontSize: 12 }}>
                                    <option value="">使用默认</option>
                                    {voices.map(v => (
                                        <option key={v.key} value={v.key}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">时长(秒)</label>
                                <input className="cyber-input" type="number" value={scene.duration}
                                    onChange={e => updateScene(idx, 'duration', parseInt(e.target.value) || 5)}
                                    min={1} max={60}
                                    style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                    </div>
                    {scene.dialogue && (
                        <button className="cyber-btn" style={{ marginTop: 8, fontSize: 11, padding: '4px 12px' }}
                            onClick={() => handleTTSPreview(scene.dialogue, scene.voice)}>
                            ♪ 试听语音
                        </button>
                    )}
                </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <button className="cyber-btn" onClick={addScene}>+ 添加场景</button>
                <button className="cyber-btn cyber-btn-primary" onClick={handleExport} disabled={exporting}>
                    {exporting ? <><span className="cyber-loading"></span> 导出中</> : '▶ 导出剧集'}
                </button>
            </div>

            {exportResult && (
                <div className="cyber-card" style={{
                    marginBottom: 24,
                    borderColor: exportResult.success ? 'var(--neon-green)' : 'var(--neon-red)'
                }}>
                    <div style={{ color: exportResult.success ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: 600, marginBottom: 8 }}>
                        {exportResult.success ? '✓ 导出成功' : '✗ 导出失败'}
                    </div>
                    {exportResult.success ? (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                            <div>标题: {exportResult.episodeTitle}</div>
                            <div>场景数: {exportResult.sceneCount}</div>
                            <div>语音生成: {exportResult.ttsGenerated} 段</div>
                            <div>输出路径: <span style={{ fontFamily: 'monospace' }}>{exportResult.outputPath}</span></div>
                            {exportResult.subtitlePath && <div>字幕文件: <span style={{ fontFamily: 'monospace' }}>{exportResult.subtitlePath}</span></div>}
                            <div>文件大小: {(exportResult.fileSize / 1048576).toFixed(1)} MB</div>
                        </div>
                    ) : (
                        <div style={{ fontSize: 12, color: 'var(--neon-red)' }}>{exportResult.error}</div>
                    )}
                </div>
            )}

            <div className="cyber-section-title">已导出剧集</div>
            <div className="cyber-card">
                {episodes.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                        暂无已导出的剧集
                    </div>
                ) : (
                    episodes.map(ep => (
                        <div key={ep.name} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--neon-blue)', fontSize: 13 }}>{ep.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {ep.videos.map(v => (
                                    <span key={v} style={{ marginRight: 12, fontFamily: 'monospace' }}>{v}</span>
                                ))}
                                <span>({ep.totalFiles} 文件)</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
