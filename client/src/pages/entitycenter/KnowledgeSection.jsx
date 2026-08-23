import { useState, useEffect } from 'react';
import { knowledgeAccessApi } from '../../services/api';
import { CONFIDENCE_LABELS, CONFIDENCE_COLORS, SOURCE_HOW_LABELS } from './constants';
import s from './knowledgeSection.module.css';

export default function KnowledgeSection({ entityId, projectId }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!entityId || !projectId) return;
        setLoading(true);
        knowledgeAccessApi.getByEntity(projectId, entityId)
            .then(res => setRecords(res.data || []))
            .catch(() => setRecords([]))
            .finally(() => setLoading(false));
    }, [entityId, projectId]);

    if (!entityId || !projectId) return null;
    if (loading) return <div className={s.ksLoading}>加载限知数据...</div>;
    if (records.length === 0) return null;

    return (
        <div className={`cyber-card ${s.ksCard}`}>
            <h4 className={s.ksTitle}>限知认知 ({records.length})</h4>
            <div className="ec-flex ec-flex-col ec-gap-4">
                {records.map(r => (
                    <div key={r.id} className={`ec-flex ec-items-center ec-gap-6 ${s.ksRow}`}>
                        <span className={s.ksFact}>{r.factId}</span>
                        <span className={s.ksConfidence} style={{ color: CONFIDENCE_COLORS[r.confidence] || '#888' }}>
                            [{CONFIDENCE_LABELS[r.confidence] || r.confidence}]
                        </span>
                        <span className={s.ksSource}>({SOURCE_HOW_LABELS[r.sourceHow] || r.sourceHow})</span>
                        {r.sinceChapter > 0 && <span className={s.ksChapter}>Ch{r.sinceChapter}</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}
