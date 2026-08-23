import useComicExportState from '../comic/useComicExportState';
import s from './ComicExportPage.module.css';

export default function ComicExportPage() {
    const {
        voices, defaultVoice, setDefaultVoice,
        episodeNumber, setEpisodeNumber, episodeTitle, setEpisodeTitle,
        scenes, addScene, removeScene, updateScene,
        exporting, exportResult, episodes, burnSubtitles, setBurnSubtitles,
        handleExport, handleTTSPreview
    } = useComicExportState();

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">漫剧导出</h1>
                <p className="page-subtitle">TTS语音合成 + 视频合成 + 字幕导出</p>
            </div>

            <div className="cyber-section-title">剧集配置</div>
            <div className={`cyber-card ${s.configCard}`}>
                <div className={s.configGrid}>
                    <div className="form-group">
                        <label className="form-label">集数</label>
                        <input className={`cyber-input ${s.fullWidth}`} type="number" value={episodeNumber}
                            onChange={e => setEpisodeNumber(parseInt(e.target.value) || 1)} min={1} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">标题</label>
                        <input className={`cyber-input ${s.fullWidth}`} value={episodeTitle}
                            onChange={e => setEpisodeTitle(e.target.value)}
                            placeholder="例：第一章 初遇" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">默认语音</label>
                        <select className={`cyber-input ${s.selectFullWidth}`} value={defaultVoice}
                            onChange={e => setDefaultVoice(e.target.value)}>
                            {voices.map(v => (
                                <option key={v.key} value={v.key}>{v.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className={s.subtitleRow}>
                    <label className={s.subtitleLabel}>
                        <input type="checkbox" checked={burnSubtitles}
                            onChange={e => setBurnSubtitles(e.target.checked)}
                            className={s.subtitleCheckbox} />
                        烧录字幕到视频（硬字幕）
                    </label>
                </div>
            </div>

            <div className="cyber-section-title">场景列表</div>
            {scenes.map((scene, idx) => (
                <div key={idx} className={`cyber-card ${s.sceneCard}`}>
                    <div className={s.sceneHeader}>
                        <span className={s.sceneTitle}>场景 {idx + 1}</span>
                        <button className={`cyber-btn ${s.deleteSceneBtn}`}
                            onClick={() => removeScene(idx)}>删除</button>
                    </div>
                    <div className={s.sceneGrid}>
                        <div className={`form-group ${s.sceneFormGroup}`}>
                            <label className="form-label">图片路径</label>
                            <input className={`cyber-input ${s.fullWidth}`} value={scene.imagePath}
                                onChange={e => updateScene(idx, 'imagePath', e.target.value)}
                                placeholder="output/xxx/images/第01章-标题-场景.png" />
                        </div>
                        <div className={`form-group ${s.sceneFormGroup}`}>
                            <label className="form-label">视频路径（可选，优先于图片）</label>
                            <input className={`cyber-input ${s.fullWidth}`} value={scene.videoPath}
                                onChange={e => updateScene(idx, 'videoPath', e.target.value)}
                                placeholder="output/xxx/video/scene.mp4" />
                        </div>
                        <div className={`form-group ${s.sceneFormGroup}`}>
                            <label className="form-label">台词/旁白（TTS语音合成）</label>
                            <textarea className={`cyber-input ${s.fullWidth}`} value={scene.dialogue}
                                onChange={e => updateScene(idx, 'dialogue', e.target.value)}
                                placeholder="角色台词或旁白文字..." rows={2} />
                        </div>
                        <div className={s.sceneSubGrid}>
                            <div className={`form-group ${s.sceneFormGroup}`}>
                                <label className="form-label">语音</label>
                                <select className={`cyber-input ${s.voiceSelect}`} value={scene.voice || defaultVoice}
                                    onChange={e => updateScene(idx, 'voice', e.target.value)}>
                                    <option value="">使用默认</option>
                                    {voices.map(v => (
                                        <option key={v.key} value={v.key}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={`form-group ${s.sceneFormGroup}`}>
                                <label className="form-label">时长(秒)</label>
                                <input className={`cyber-input ${s.fullWidth}`} type="number" value={scene.duration}
                                    onChange={e => updateScene(idx, 'duration', parseInt(e.target.value) || 5)}
                                    min={1} max={60} />
                            </div>
                        </div>
                    </div>
                    {scene.dialogue && (
                        <button className={`cyber-btn ${s.ttsPreviewBtn}`}
                            onClick={() => handleTTSPreview(scene.dialogue, scene.voice)}>
                            ♪ 试听语音
                        </button>
                    )}
                </div>
            ))}

            <div className={s.actionBar}>
                <button className="cyber-btn" onClick={addScene}>+ 添加场景</button>
                <button className="cyber-btn cyber-btn-primary" onClick={handleExport} disabled={exporting}>
                    {exporting ? <><span className="cyber-loading"></span> 导出中</> : '▶ 导出剧集'}
                </button>
            </div>

            {exportResult && (
                <div className={`cyber-card ${s.resultCard} ${exportResult.success ? s.resultSuccess : s.resultError}`}>
                    <div className={exportResult.success ? s.resultTitleSuccess : s.resultTitleError}>
                        {exportResult.success ? '✓ 导出成功' : '✗ 导出失败'}
                    </div>
                    {exportResult.success ? (
                        <div className={s.resultDetails}>
                            <div>标题: {exportResult.episodeTitle}</div>
                            <div>场景数: {exportResult.sceneCount}</div>
                            <div>语音生成: {exportResult.ttsGenerated} 段</div>
                            <div>输出路径: <span className={s.mono}>{exportResult.outputPath}</span></div>
                            {exportResult.subtitlePath && <div>字幕文件: <span className={s.mono}>{exportResult.subtitlePath}</span></div>}
                            <div>文件大小: {(exportResult.fileSize / 1048576).toFixed(1)} MB</div>
                        </div>
                    ) : (
                        <div className={s.resultErrorText}>{exportResult.error}</div>
                    )}
                </div>
            )}

            <div className="cyber-section-title">已导出剧集</div>
            <div className="cyber-card">
                {episodes.length === 0 ? (
                    <div className={s.emptyEpisodes}>暂无已导出的剧集</div>
                ) : (
                    episodes.map(ep => (
                        <div key={ep.name} className={s.episodeItem}>
                            <div className={s.episodeName}>{ep.name}</div>
                            <div className={s.episodeMeta}>
                                {ep.videos.map(v => (
                                    <span key={v} className={s.episodeVideo}>{v}</span>
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
