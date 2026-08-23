export default function MaterialGenerator({ currentProject, generating, onGenerate, prompt, setPrompt }) {
    if (!currentProject) return null;

    return (
        <>
            <div className="cyber-card">
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--neon-blue)' }}>需求描述</h3>
                <textarea className="cyber-textarea" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="输入你的小说需求、目标、选题...（AI将据此生成素材库和章节大纲）" rows={4} />
            </div>

            <button className="cyber-btn cyber-btn-success cyber-btn-lg" onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
                {generating ? '生成素材库中(1-3分钟)...' : '⬡ 生成素材库'}
            </button>
        </>
    );
}
