import useStoryboardState from '../comic/useStoryboardState';
import ComfyUIPanel from '../comic/ComfyUIPanel';
import StoryboardPanel from '../comic/StoryboardPanel';

export default function ComicStoryboardPage() {
    const state = useStoryboardState();
    const { storyboards, comfyuiMode, setComfyuiMode, exporting, showCreate, setShowCreate,
        handleBatchRender, handleExportEpisode, exportResult, STATUS_MAP } = state;

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">分镜管理</h1>
                <p className="page-subtitle">管理漫剧分镜，配置画面提示词+台词语音，渲染后导出完整剧集</p>
            </div>

            <div className="flex-between mb-20 flex-wrap gap-8">
                <div className="flex flex-wrap gap-8">
                    {Object.entries(STATUS_MAP).map(([key, val]) => {
                        const count = storyboards.filter(s => s.status === key).length;
                        return (
                            <span key={key} className="cyber-badge" style={{ borderColor: val.color, color: val.color }}>
                                {val.label} ({count})
                            </span>
                        );
                    })}
                </div>
                <div className="flex gap-8">
                    <button className="cyber-btn" onClick={() => setComfyuiMode(!comfyuiMode)}
                        style={{ color: comfyuiMode ? 'var(--neon-green)' : 'var(--neon-purple)' }}>
                        {comfyuiMode ? '◈ ComfyUI模式 ON' : '◇ ComfyUI模式'}
                    </button>
                    <button className="cyber-btn" onClick={handleBatchRender}>▶ 批量渲染</button>
                    <button className="cyber-btn text-purple" onClick={handleExportEpisode} disabled={exporting}>
                        {exporting ? <><span className="cyber-loading"></span> 导出中</> : '▲ 导出剧集'}
                    </button>
                    <button className="cyber-btn cyber-btn-primary" onClick={() => setShowCreate(!showCreate)}>
                        {showCreate ? '✕ 取消' : '+ 新建分镜'}
                    </button>
                </div>
            </div>

            {comfyuiMode && <ComfyUIPanel state={state} />}

            {exportResult && (
                <div className="cyber-card mb-20" style={{
                    borderColor: exportResult.success ? 'var(--neon-green)' : 'var(--neon-red)',
                    background: exportResult.success ? 'rgba(0,255,136,0.05)' : 'rgba(255,0,68,0.05)'
                }}>
                    <div className="font-semibold mb-8" style={{ color: exportResult.success ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                        {exportResult.success ? '✓ 导出成功' : '✗ 导出失败'}
                    </div>
                    {exportResult.success ? (
                        <div className="text-sm text-secondary lh-1-8">
                            <div>标题: {exportResult.episodeTitle} | 场景: {exportResult.sceneCount} | 语音: {exportResult.ttsGenerated}段</div>
                            <div>输出: <code className="font-mono">{exportResult.outputPath}</code></div>
                            {exportResult.subtitlePath && <div>字幕: <code className="font-mono">{exportResult.subtitlePath}</code></div>}
                            <div>大小: {(exportResult.fileSize / 1048576).toFixed(1)} MB</div>
                        </div>
                    ) : <div className="text-sm text-red">{exportResult.error}</div>}
                </div>
            )}

            <StoryboardPanel state={state} />
        </div>
    );
}
