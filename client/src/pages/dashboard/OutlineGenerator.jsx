import { useNavigate } from 'react-router-dom';

export default function OutlineGenerator({ currentProject, generating, onGenerate, totalMaterials, totalChapters }) {
    const navigate = useNavigate();

    if (!currentProject) return null;

    return (
        <>
            <button className="cyber-btn cyber-btn-lg" onClick={onGenerate} disabled={generating || totalMaterials === 0} style={{ width: '100%' }}>
                {generating ? '生成大纲中(1-3分钟)...' : '▦ 生成章节大纲'}
            </button>

            {totalMaterials > 0 && totalChapters > 0 && (
                <button className="cyber-btn cyber-btn-primary cyber-btn-lg" onClick={() => navigate('/pipeline')} style={{ width: '100%' }}>⟐ 启动流水线</button>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button className="cyber-btn" onClick={() => navigate('/materials')}>素材库 →</button>
                <button className="cyber-btn" onClick={() => navigate('/chapters')}>章节管理 →</button>
            </div>
        </>
    );
}
