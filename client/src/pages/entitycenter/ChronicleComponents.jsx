/**
 * ChronicleComponents.jsx — 编年史筛选控件
 * （原 StanceTimeline/Quotes/Deeds/Highlights 已由 ChronicleDims.jsx 的多维视图替代）
 */
import { useState, useEffect } from 'react';
import { pipelineApi } from '../../services/api';

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
