import { useState, useEffect, useCallback } from 'react';
import { pipelineApi } from '../../services/api';
import logger from '../../shared/logger';
import s from './ConstraintsPanel.module.css';

export default function ConstraintsPanel({ projectId }) {
    const [constraints, setConstraints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchConstraints = useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const res = await pipelineApi.getConsistencyConstraints(projectId);
            setConstraints(res.data?.data || res.data || []);
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally { setLoading(false); }
    }, [projectId]);

    useEffect(() => { fetchConstraints(); }, [fetchConstraints]);

    const handleResolve = async (constraintId) => {
        try { await pipelineApi.resolveConsistencyConstraint(constraintId, 'user'); fetchConstraints(); }
        catch (e) { logger.error('Constraints', 'Failed to resolve constraint:', e.message); }
    };

    if (loading) return <div className={s.loading}>加载中...</div>;
    if (error) return <div className={s.error}>加载失败: {error}</div>;
    if (constraints.length === 0) return <div className={s.empty}>一致性约束由阅读者发现硬伤时自动生成。如无硬伤则无约束。</div>;

    const active = constraints.filter(c => !c.resolved);
    const resolved = constraints.filter(c => c.resolved);

    return (
        <div className={s.panel}>
            {active.length > 0 && (
                <div className={s.section}>
                    <div className={`${s.sectionTitle} ${s.sectionTitleActive}`}>活跃约束 ({active.length})</div>
                    {active.map(c => (
                        <div key={c.id} className={`${s.constraintCard} ${s.constraintCardActive}`}>
                            <div className={s.cardHeader}>
                                <span className={s.metaOrange}>第{c.sourceChapter}章reader发现 · 类型: {c.type}</span>
                                <button className={`cyber-btn cyber-btn-sm ${s.resolveBtn}`} onClick={() => handleResolve(c.id)}>标记解决</button>
                            </div>
                            <div className={s.constraintText}>{c.constraint}</div>
                            {c.description && <div className={s.constraintDesc}>{c.description}</div>}
                            <div className={s.constraintMeta}>生效: 第{c.activeFrom}章{c.activeUntil != null ? ` → 第${c.activeUntil}章` : ' → 永久'} · 创建: {c.createdAt?.substring(0, 16)}</div>
                        </div>
                    ))}
                </div>
            )}
            {resolved.length > 0 && (
                <div className={s.section}>
                    <div className={`${s.sectionTitle} ${s.sectionTitleResolved}`}>已解决 ({resolved.length})</div>
                    {resolved.map(c => (
                        <div key={c.id} className={`${s.constraintCard} ${s.constraintCardResolved}`}>
                            <span className={s.metaGreen}>第{c.sourceChapter}章 · {c.type}</span>
                            <div className={s.constraintResolvedText}>{c.constraint}</div>
                            <div className={s.constraintMeta}>解决: {c.resolvedBy} · {c.resolvedAt?.substring(0, 16)}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
