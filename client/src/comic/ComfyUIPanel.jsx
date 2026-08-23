import { VramStatusBar, AutoFreeBar, WorkflowParams } from './ComfyUIParts';

export default function ComfyUIPanel({ state }) {
    const {
        comfyuiStatus, t2iPrompt, setT2iPrompt, t2iGenerating, t2iResult, i2vPrompt,
        setI2vPrompt, i2vImage, setI2vImage, i2vGenerating, i2vResult, characterBackups,
        workflowParams, setWorkflowParams, framePreview, setFramePreview, frameIndex,
        setFrameIndex, freeingMemory, autoFreeConfig, handleUpdateAutoFree, newBoard,
        setNewBoard, handleTextToImage, handleImageToVideo, handleUploadImage,
        selectCharacterBackup, handleFreeMemory, fileInputRef
    } = state;

    return (
        <div className="cyber-card mb-20" style={{ borderColor: 'var(--neon-purple)' }}>
            <div className="flex-between mb-16">
                <div className="cyber-section-title text-purple" style={{ margin: 0 }}>ComfyUI LTX 2.3 工作流</div>
                <VramStatusBar comfyuiStatus={comfyuiStatus} handleFreeMemory={handleFreeMemory} freeingMemory={freeingMemory} />
            </div>

            <AutoFreeBar autoFreeConfig={autoFreeConfig} handleUpdateAutoFree={handleUpdateAutoFree} />
            <WorkflowParams workflowParams={workflowParams} setWorkflowParams={setWorkflowParams} />

            <div className="grid-2 gap-20">
                <div>
                    <div className="font-semibold text-blue mb-12 text-base">📷 文生图 (Text-to-Image)</div>
                    <div className="form-group mb-12">
                        <label className="form-label">提示词</label>
                        <textarea className="cyber-textarea" value={t2iPrompt} onChange={e => setT2iPrompt(e.target.value)} rows={3} placeholder="A young warrior standing on a mountain, cinematic lighting, detailed face..." />
                    </div>
                    <div className="flex gap-8 mb-12">
                        <div className="form-group flex-1"><label className="form-label">宽度</label><input className="cyber-input input-sm" type="number" value={newBoard.width} onChange={e => setNewBoard(prev => ({ ...prev, width: parseInt(e.target.value) || 768 }))} min={256} max={2048} step={64} /></div>
                        <div className="form-group flex-1"><label className="form-label">高度</label><input className="cyber-input input-sm" type="number" value={newBoard.height} onChange={e => setNewBoard(prev => ({ ...prev, height: parseInt(e.target.value) || 512 }))} min={256} max={2048} step={64} /></div>
                    </div>
                    <button className="cyber-btn cyber-btn-primary w-full" onClick={handleTextToImage} disabled={t2iGenerating}>
                        {t2iGenerating ? <><span className="cyber-loading"></span> 生成中...</> : '📷 生成图片'}
                    </button>
                    {t2iResult && (
                        <div className={`result-panel mt-12 ${t2iResult.success ? 'result-panel-success' : 'result-panel-error'}`}>
                            {t2iResult.success ? (
                                <div><div className="text-sm text-green mb-4">✓ 图片已生成</div>
                                    {t2iResult.savePath && <div className="text-sm text-secondary word-break-all">{t2iResult.savePath}</div>}
                                    {t2iResult.url && <img src={t2iResult.url} alt="generated" className="max-h-200 rounded mt-8" style={{ maxWidth: '100%' }} />}
                                </div>
                            ) : <div className="text-sm text-red">✗ {t2iResult.error}</div>}
                        </div>
                    )}
                </div>

                <div>
                    <div className="font-semibold text-orange mb-12 text-base">🎬 图生视频 (Image-to-Video)</div>
                    <div className="form-group mb-12">
                        <label className="form-label">图片来源</label>
                        <div className="flex gap-8">
                            <input className="cyber-input input-sm flex-1" value={i2vImage} onChange={e => setI2vImage(e.target.value)} placeholder="输入图片文件名或路径" />
                            <button className="cyber-btn whitespace-nowrap" onClick={() => fileInputRef.current?.click()} style={{ padding: '0 12px' }}>📁 上传</button>
                            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadImage} />
                        </div>
                    </div>
                    <div className="form-group mb-12">
                        <label className="form-label">运动提示词</label>
                        <textarea className="cyber-textarea" value={i2vPrompt} onChange={e => setI2vPrompt(e.target.value)} rows={3} placeholder="Camera slowly zooms in, character turns head, wind blowing hair..." />
                    </div>
                    <button className="cyber-btn cyber-btn-primary w-full" onClick={handleImageToVideo} disabled={i2vGenerating}
                        style={{ background: 'linear-gradient(135deg, rgba(255,145,0,0.12), rgba(231,76,60,0.08))' }}>
                        {i2vGenerating ? <><span className="cyber-loading"></span> 生成视频中...</> : '🎬 生成视频'}
                    </button>
                    {i2vResult && (
                        <div className={`result-panel mt-12 ${i2vResult.success ? 'result-panel-success' : 'result-panel-error'}`}>
                            {i2vResult.success ? (
                                <div><div className="text-sm text-green mb-4">✓ 视频已生成</div>
                                    {i2vResult.savePath && <div className="text-sm text-secondary word-break-all">{i2vResult.savePath}</div>}
                                </div>
                            ) : <div className="text-sm text-red">✗ {i2vResult.error}</div>}
                        </div>
                    )}
                </div>
            </div>

            {characterBackups.length > 0 && (
                <div className="mt-20">
                    <div className="cyber-section-title text-base text-green mb-12">🗂️ 人物形象备份（确保一致性）</div>
                    <div className="char-backup-scroll">
                        {characterBackups.map((backup, i) => (
                            <div key={i} className={`cyber-card char-backup-card ${i2vImage === backup.path ? 'border-green' : ''}`}
                                style={{ borderColor: i2vImage === backup.path ? 'var(--neon-green)' : undefined }}
                                onClick={() => selectCharacterBackup(backup)}>
                                {backup.url && <img src={backup.url} alt={`char ${i+1}`} className="char-backup-img" />}
                                <div className="text-sm text-secondary mb-4">人物 {i + 1}</div>
                                <div className="text-xs text-muted truncate" style={{ maxWidth: 120 }}>{backup.prompt.substring(0, 30)}...</div>
                                <div className="text-xs text-muted mt-4">{backup.timestamp}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {framePreview?.frames?.length > 0 && (
                <div className="mt-20">
                    <div className="cyber-section-title text-base text-orange mb-12">🎞️ 帧预览 ({framePreview.frames.length} 帧)</div>
                    <div className="frame-preview-container">
                        <img src={framePreview.frames[frameIndex]} alt={`frame ${frameIndex}`} className="w-full max-h-300 object-contain" style={{ display: 'block' }} />
                        <div className="frame-preview-badge">{frameIndex + 1}/{framePreview.frames.length}</div>
                    </div>
                    <div className="flex gap-8 items-start">
                        <button className="cyber-btn text-sm" style={{ padding: '4px 12px' }}
                            onClick={() => setFramePreview(prev => ({ ...prev, playing: !prev.playing }))}>
                            {framePreview.playing ? '⏸ 暂停' : '▶ 播放'}
                        </button>
                        <input type="range" min={0} max={framePreview.frames.length - 1} value={frameIndex}
                            onChange={e => { setFrameIndex(parseInt(e.target.value)); setFramePreview(prev => ({ ...prev, playing: false })); }}
                            className="flex-1" />
                    </div>
                </div>
            )}
        </div>
    );
}
