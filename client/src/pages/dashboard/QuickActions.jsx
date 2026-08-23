import { useNavigate } from 'react-router-dom';

export default function QuickActions({ dragHandleProps, currentProject, prompt, setPrompt,
    genLoading, generateMaterials, generateOutlines, totalMaterials, totalChapters }) {
    const navigate = useNavigate();

    return (
        <div className="cyber-card">
            <div className="card-header" {...dragHandleProps}>
                <div className="card-title-row">
                    <span className="drag-handle">⋮⋮</span>
                    <h3 className="card-title card-title-green">⚡ 快速操作</h3>
                </div>
            </div>
            {currentProject ? (
                <div className="flex-col gap-12">
                    <div>
                        <h3 className="text-md font-semibold mb-12 text-blue">需求描述</h3>
                        <textarea className="cyber-textarea" value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="输入你的小说需求、目标、选题...（AI将据此生成素材库和章节大纲）"
                            rows={4} />
                    </div>
                    <button className="cyber-btn cyber-btn-success cyber-btn-lg w-full"
                        onClick={generateMaterials} disabled={genLoading.materials}>
                        {genLoading.materials ? '生成素材库中(1-3分钟)...' : '⬡ 生成素材库'}
                    </button>
                    <button className="cyber-btn cyber-btn-lg w-full"
                        onClick={generateOutlines} disabled={genLoading.outlines || totalMaterials === 0}>
                        {genLoading.outlines ? '生成大纲中(1-3分钟)...' : '▦ 生成章节大纲'}
                    </button>
                    {totalMaterials > 0 && totalChapters > 0 && (
                        <button className="cyber-btn cyber-btn-primary cyber-btn-lg w-full"
                            onClick={() => navigate('/pipeline')}>⟐ 启动流水线</button>
                    )}
                    <div className="grid-2" style={{ gap: 8 }}>
                        <button className="cyber-btn" onClick={() => navigate('/materials')}>素材库 →</button>
                        <button className="cyber-btn" onClick={() => navigate('/chapters')}>章节管理 →</button>
                    </div>
                </div>
            ) : (
                <div className="cyber-empty">
                    <div className="cyber-empty-icon">◈</div>
                    <div>请先选择或创建一个产品</div>
                </div>
            )}
        </div>
    );
}
