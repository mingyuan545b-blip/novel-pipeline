import { useState, useEffect } from 'react';
import { pipelineApi } from '../../services/api';

function StanceTimeline({ chronicleData }) {
    if (!chronicleData || chronicleData.length === 0) {
        return <div className="chr-timeline-empty">暂无立场数据，Pipeline运行后将自动提取</div>;
    }
    return (
        <div className="chr-timeline">
            {chronicleData.map((c, i) => (
                <div key={c.id || i} className="chr-entry">
                    <div className="chr-entry-header">
                        <span className="chr-entry-chapter">第{c.chapterNumber}章 · {c.entityName}</span>
                        {c.stanceShiftReason && <span className="chr-entry-shift">立场转变</span>}
                    </div>
                    {c.stance && <div className="chr-entry-stance">立场: {c.stance}</div>}
                    {c.innerConflict && <div className="chr-entry-conflict">内心矛盾: {c.innerConflict}</div>}
                    {c.stanceShiftReason && (
                        <div className="chr-entry-reason">转变原因: {c.stanceShiftReason}</div>
                    )}
                </div>
            ))}
        </div>
    );
}

function QuotesSection({ chronicleData }) {
    const allQuotes = chronicleData?.filter(c => c.quotes && c.quotes.length > 0) || [];
    if (allQuotes.length === 0) return null;
    return (
        <div className="chr-section">
            <div className="chr-section-title-cyan">语录</div>
            {allQuotes.map((c, i) => (
                <div key={c.id || i} className="chr-quote-group">
                    <div className="chr-quote-chapter">第{c.chapterNumber}章 · {c.entityName}</div>
                    {c.quotes.map((q, qi) => (
                        <div key={qi} className="chr-quote-item">"{q}"</div>
                    ))}
                </div>
            ))}
        </div>
    );
}

function DeedsSection({ chronicleData }) {
    const allDeeds = chronicleData?.filter(c => c.deeds && c.deeds.length > 0) || [];
    if (allDeeds.length === 0) return null;
    return (
        <div className="chr-section">
            <div className="chr-section-title-orange">事迹</div>
            {allDeeds.map((c, i) => (
                <div key={c.id || i} className="chr-deed-group">
                    <div className="chr-deed-chapter">第{c.chapterNumber}章 · {c.entityName}</div>
                    {c.deeds.map((d, di) => (
                        <div key={di} className="chr-deed-item">▸ {d}</div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export { StanceTimeline, QuotesSection, DeedsSection };

function EntityFilter({ entities, selectedEntityId, onChange }) {
    if (!entities || entities.length === 0) return null;
    return (
        <select className="chr-filter-select" value={selectedEntityId || ''} onChange={e => onChange(e.target.value || null)}>
            <option value="">全部角色</option>
            {entities.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
            ))}
        </select>
    );
}

function WorldFilter({ projectId, selectedWorldId, onChange }) {
    const [worlds, setWorlds] = useState([]);
    const [fetched, setFetched] = useState(false);
    useEffect(() => {
        if (fetched || !projectId) return;
        pipelineApi.getWorldScope(projectId)
            .then(res => { setWorlds(res.data?.data?.worlds || []); setFetched(true); })
            .catch(() => { setWorlds([]); setFetched(true); });
    }, [projectId, fetched]);
    if (worlds.length <= 1) return null;
    return (
        <select className="chr-filter-select" value={selectedWorldId || ''} onChange={e => onChange(e.target.value || null)}>
            <option value="">全部世界</option>
            {worlds.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
            ))}
        </select>
    );
}

export { EntityFilter, WorldFilter };
