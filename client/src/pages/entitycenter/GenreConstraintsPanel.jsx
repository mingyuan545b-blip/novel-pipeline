import { useState, useEffect } from 'react';
import { projectsApi } from '../../services/api';

export default function GenreConstraintsPanel({ projectId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!projectId) return;
        setLoading(true);
        projectsApi.getGenreConstraints(projectId)
            .then(r => setData(r.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [projectId]);
    /* eslint-enable react-hooks/set-state-in-effect */

    if (loading) return <div className="ec-text-12 ec-text-muted">加载约束配置...</div>;
    if (!data || !data.genreId) return <div className="ec-text-12 ec-text-muted">未检测到题材约束</div>;

    return (
        <div className="cyber-card ec-border-cyan">
            <button className="ec-constraints-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
                <h4 className="ec-section-title ec-color-cyan" style={{ margin: 0 }}>
                    <span aria-hidden="true">📋</span> 题材约束配置
                    <span className="ec-badge ec-badge-cyan ec-ml-8">{data.genreLabel}</span>
                    <span className="ec-text-11 ec-text-muted ec-font-normal ec-ml-8">{expanded ? '收起' : '展开详情'}</span>
                </h4>
            </button>

            {expanded && (
                <div className="ec-constraints-detail ec-mt-8">
                    <div className="ec-constraints-summary">
                        <div className="ec-constraint-stat">
                            <span className="ec-constraint-stat-value">{data.requiredConstraints?.length || 0}</span>
                            <span className="ec-constraint-stat-label">必选约束</span>
                        </div>
                        <div className="ec-constraint-stat">
                            <span className="ec-constraint-stat-value">{data.foundationConstraints?.length || 0}</span>
                            <span className="ec-constraint-stat-label">基础约束</span>
                        </div>
                        <div className="ec-constraint-stat">
                            <span className="ec-constraint-stat-value">{data.behaviorTemplate ? '已定义' : '未定义'}</span>
                            <span className="ec-constraint-stat-label">行为模板</span>
                        </div>
                        <div className="ec-constraint-stat">
                            <span className="ec-constraint-stat-value">{data.reviewFocus ? '已定义' : '未定义'}</span>
                            <span className="ec-constraint-stat-label">审核焦点</span>
                        </div>
                    </div>

                    {data.reviewFocus && (
                        <div className="ec-mb-8">
                            <div className="ec-constraint-section-title">审核焦点</div>
                            <div className="ec-constraint-review-focus">{data.reviewFocus}</div>
                            <div className="ec-text-10 ec-text-muted ec-mt-4">fast-review/初审/复审/定稿均加载此焦点</div>
                        </div>
                    )}

                    {data.behaviorTemplate && (
                        <div className="ec-mb-8">
                            <div className="ec-constraint-section-title">行为约束模板</div>
                            <div className="ec-text-12 ec-text-secondary">已注入到所有角色的behaviorRules中，按角色等级(protagonist/supporting/npc)分级加载</div>
                            <details className="ec-source-details ec-mt-4">
                                <summary className="ec-source-summary">查看完整模板 ({data.behaviorTemplate.length}字)</summary>
                                <div className="ec-source-content">{data.behaviorTemplate}</div>
                            </details>
                        </div>
                    )}

                    {data.requiredConstraints?.length > 0 && (
                        <div className="ec-mb-8">
                            <div className="ec-constraint-section-title">必选约束 ({data.requiredConstraints.length})</div>
                            <div className="ec-flex ec-flex-wrap ec-gap-4 ec-mt-4">
                                {data.requiredConstraints.map(id => {
                                    const preset = data.constraintPresets?.[id];
                                    return (
                                        <span key={id} className="ec-badge ec-badge-orange" title={preset?.desc || ''}>
                                            {preset?.label || id}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {data.foundationConstraints?.length > 0 && (
                        <div>
                            <div className="ec-constraint-section-title">基础约束 ({data.foundationConstraints.length})</div>
                            <div className="ec-flex-col ec-gap-4 ec-mt-4">
                                {data.foundationConstraints.map(c => (
                                    <div key={c.id} className="ec-schema-field-item">
                                        <span className="ec-text-12 ec-font-500">{c.label}</span>
                                        <span className="ec-text-11 ec-text-muted ec-ml-8">{c.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
