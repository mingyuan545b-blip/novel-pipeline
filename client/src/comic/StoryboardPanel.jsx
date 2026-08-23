export default function StoryboardPanel({ state }) {
    const {
        showCreate, newBoard, setNewBoard, voices, loading, chapters,
        handleCreate, handleTTSPreview, storyboards, STATUS_MAP, handleRender
    } = state;

    return (
        <>
            {showCreate && (
                <div className="cyber-card mb-20" style={{ borderColor: 'var(--neon-green)' }}>
                    <h4 className="text-green mb-16">新建分镜</h4>
                    <div className="grid-2-gap-16 mb-16">
                        <div className="form-group">
                            <label className="form-label">关联章节</label>
                            <select className="cyber-input input-sm" value={newBoard.chapterId} onChange={e => setNewBoard(prev => ({ ...prev, chapterId: e.target.value }))}>
                                <option value="">不关联章节</option>
                                {chapters.map(ch => <option key={ch.id} value={ch.id}>第{ch.chapterNumber}章: {ch.title}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">场景序号</label>
                            <input className="cyber-input input-sm" type="number" value={newBoard.sceneIndex} onChange={e => setNewBoard(prev => ({ ...prev, sceneIndex: parseInt(e.target.value) || 0 }))} min={0} />
                        </div>
                    </div>
                    <div className="form-group mb-16">
                        <label className="form-label">分镜描述</label>
                        <textarea className="cyber-textarea" value={newBoard.description} onChange={e => setNewBoard(prev => ({ ...prev, description: e.target.value }))} rows={2} placeholder="描述这个分镜的画面内容..." />
                    </div>
                    <div className="form-group mb-16">
                        <label className="form-label">正向提示词 (Prompt)</label>
                        <textarea className="cyber-textarea" value={newBoard.prompt} onChange={e => setNewBoard(prev => ({ ...prev, prompt: e.target.value }))} rows={2} placeholder="masterpiece, best quality, 1girl, ..." />
                    </div>
                    <div className="form-group mb-16">
                        <label className="form-label">反向提示词 (Negative Prompt)</label>
                        <textarea className="cyber-textarea" value={newBoard.negativePrompt} onChange={e => setNewBoard(prev => ({ ...prev, negativePrompt: e.target.value }))} rows={2} placeholder="lowres, bad anatomy, bad hands, ..." />
                    </div>
                    <div className="grid-2-gap-16 mb-16">
                        <div className="form-group"><label className="form-label">宽度</label><input className="cyber-input input-sm" type="number" value={newBoard.width} onChange={e => setNewBoard(prev => ({ ...prev, width: parseInt(e.target.value) || 768 }))} min={256} max={4096} step={64} /></div>
                        <div className="form-group"><label className="form-label">高度</label><input className="cyber-input input-sm" type="number" value={newBoard.height} onChange={e => setNewBoard(prev => ({ ...prev, height: parseInt(e.target.value) || 512 }))} min={256} max={4096} step={64} /></div>
                    </div>
                    <div className="cyber-section-title text-base mt-8">台词 & 语音</div>
                    <div className="grid-3-gap-16 mb-16" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                        <div className="form-group">
                            <label className="form-label">台词/旁白</label>
                            <textarea className="cyber-textarea" value={newBoard.dialogue} onChange={e => setNewBoard(prev => ({ ...prev, dialogue: e.target.value }))} rows={2} placeholder="角色台词或旁白文字..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">语音角色</label>
                            <select className="cyber-input input-sm" value={newBoard.voice} onChange={e => setNewBoard(prev => ({ ...prev, voice: e.target.value }))}>
                                <option value="">默认</option>
                                {voices.map(v => <option key={v.key} value={v.key}>{v.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">时长(秒)</label>
                            <input className="cyber-input input-sm" type="number" value={newBoard.duration} onChange={e => setNewBoard(prev => ({ ...prev, duration: parseInt(e.target.value) || 5 }))} min={1} max={60} />
                        </div>
                    </div>
                    <div className="flex gap-8">
                        <button className="cyber-btn cyber-btn-primary" onClick={handleCreate} disabled={loading}>
                            {loading ? <><span className="cyber-loading"></span> 创建中</> : '◈ 创建分镜'}
                        </button>
                        {newBoard.dialogue && (
                            <button className="cyber-btn" onClick={() => handleTTSPreview(newBoard.dialogue, newBoard.voice)}>♪ 试听语音</button>
                        )}
                    </div>
                </div>
            )}

            {storyboards.length === 0 && !loading ? (
                <div className="cyber-card text-center p-20">
                    <div className="text-2xl mb-16 opacity-50">▦</div>
                    <div className="text-muted text-md">暂无分镜数据，点击"新建分镜"开始创作</div>
                </div>
            ) : (
                <div className="grid-auto-300">
                    {storyboards.map(sb => {
                        const statusInfo = STATUS_MAP[sb.status] || STATUS_MAP.draft;
                        return (
                            <div key={sb.id} className="cyber-card">
                                <div className={`storyboard-image ${sb.imageUrl ? 'storyboard-image-bg' : ''}`}
                                    style={sb.imageUrl ? { backgroundImage: `url(${sb.imageUrl})` } : {}}>
                                    {!sb.imageUrl && <span className="text-2xl opacity-20">▦</span>}
                                </div>
                                <div className="flex-between mb-8">
                                    <span className="cyber-badge text-xs" style={{ borderColor: statusInfo.color, color: statusInfo.color }}>{statusInfo.label}</span>
                                    {sb.status === 'ready' && (
                                        <button className="cyber-btn text-green text-sm" style={{ padding: '2px 8px' }} onClick={() => handleRender(sb.id)}>▶ 渲染</button>
                                    )}
                                </div>
                                <div className="text-md font-semibold text-primary mb-4">{sb.description?.substring(0, 60) || '未命名分镜'}</div>
                                <div className="text-sm text-muted">
                                    {sb.width}x{sb.height} | 场景{sb.sceneIndex}
                                    {sb.dialogue && <span className="ml-8 text-blue">♪ 有台词</span>}
                                </div>
                                {sb.dialogue && (
                                    <div className="text-sm text-secondary mt-4 p-4 rounded" style={{ background: 'var(--bg-input)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {sb.dialogue.substring(0, 50)}{sb.dialogue.length > 50 ? '...' : ''}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}
