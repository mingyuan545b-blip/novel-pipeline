import { useState } from 'react';
import { knowledgeApi } from '../../services/api';
import './knowledge.css';

const LAYER_INFO = [
    { key: 'core', label: 'L0 核心设定', desc: '世界观规则、战力体系框架、核心人物 — 永远包含', color: '#ff6b6b' },
    { key: 'active', label: 'L1 活跃状态', desc: '当前角色位置/状态/战力、关系强度、装备归属', color: '#ffa502' },
    { key: 'recent', label: 'L2 近期上下文', desc: '近5章摘要、活跃任务、未回收伏笔', color: '#2ed573' },
    { key: 'archive', label: 'L3 归档检索', desc: '按关键词相关性检索的历史章节和已归档素材', color: '#1e90ff' },
    { key: 'compressed', label: 'L4 压缩摘要', desc: '卷级摘要(每30章一卷)，跨卷一致性参考', color: '#a55eea' }
];

export default function MemoryPanel({ layers, onBuild, projectId }) {
    const [assembledContext, setAssembledContext] = useState(null);

    const handleAssemble = async () => {
        if (!projectId) return;
        try {
            const res = await knowledgeApi.getFormattedContext(projectId, { chapterNumber: 1, model: 'default' });
            setAssembledContext(res.data || res);
        } catch (e) { alert('组装失败: ' + e.message); }
    };

    return (
        <div>
            <div className="memory-section">
                <h3 className="memory-section-title">记忆金字塔架构</h3>
                <div className="memory-layer-list">
                    {LAYER_INFO.map(l => (
                        <div key={l.key} className="memory-layer-item" style={{ borderLeft: `4px solid ${l.color}` }}>
                            <div className="memory-layer-info">
                                <div className="memory-layer-label" style={{ color: l.color }}>{l.label}</div>
                                <div className="memory-layer-desc">{l.desc}</div>
                            </div>
                            <div className="memory-layer-tokens">
                                {layers?.[l.key] ? `${layers[l.key].totalTokenEstimate || '?'} tokens` : '未构建'}
                            </div>
                            <button className="memory-build-btn" onClick={() => onBuild(l.key)}>构建</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="memory-section">
                <h3 className="memory-section-title">智能上下文组装器</h3>
                <p className="memory-assemble-desc">
                    根据当前章节自动从五层记忆中提取最相关内容，在LLM上下文预算内组装最优上下文
                </p>
                <button className="memory-assemble-btn" onClick={handleAssemble}>模拟组装上下文</button>
                {assembledContext && (
                    <div className="memory-context-result">
                        <div className="memory-context-meta">
                            <span className="memory-context-layers">
                                包含层级: {assembledContext.layersIncluded?.join(' → ')}
                            </span>
                            <span className="memory-context-budget">
                                预算: {assembledContext.budgetUsed}/{assembledContext.budgetTotal} tokens
                            </span>
                        </div>
                        <pre className="memory-context-pre">{assembledContext.formatted}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}
