import { useState, useCallback } from 'react';
import logger from '../../shared/logger';

const CRITICAL_FIELDS = ['position', 'personality', 'genreId'];
const ALL_DISPLAY_FIELDS = ['position', 'factionName', 'personality', 'speakingTone', 'signatureDetail', 'craftStyle', 'genreId'];

function DataHealthBanner({ adapted, projectId, onRepaired }) {
    const [repairing, setRepairing] = useState(false);
    const [deepRepairing, setDeepRepairing] = useState(false);
    const emptyCritical = CRITICAL_FIELDS.filter(f => !adapted[f]);
    const emptyAll = ALL_DISPLAY_FIELDS.filter(f => !adapted[f]);

    const handleRepair = useCallback(async () => {
        if (!projectId || repairing) return;
        setRepairing(true);
        try {
            const api = (await import('../../services/api')).default;
            await api.post(`/entity-center/repair-registry/${projectId}`);
            if (onRepaired) onRepaired();
        } catch (e) {
            logger.error('DataHealthBanner', 'Repair failed:', e.message);
        } finally {
            setRepairing(false);
        }
    }, [projectId, repairing, onRepaired]);

    const handleDeepRepair = useCallback(async () => {
        if (!projectId || deepRepairing) return;
        setDeepRepairing(true);
        try {
            const api = (await import('../../services/api')).default;
            await api.post(`/entity-center/deep-repair/${projectId}`);
            if (onRepaired) onRepaired();
        } catch (e) {
            logger.error('DataHealthBanner', 'Deep repair failed:', e.message);
        } finally {
            setDeepRepairing(false);
        }
    }, [projectId, deepRepairing, onRepaired]);

    if (emptyCritical.length === 0) return null;

    return (
        <div className="cyber-card ec-border-yellow">
            <div className="ec-flex ec-items-center ec-gap-8 ec-mb-8">
                <span className="ec-text-14" aria-hidden="true">⚠️</span>
                <span className="ec-text-13 ec-font-600">数据不完整</span>
                <span className="ec-badge ec-badge-muted">{emptyAll.length}个字段空</span>
            </div>
            <div className="ec-text-12 ec-text-muted ec-mb-8">
                缺失关键字段: {emptyCritical.join('、')}
            </div>
            <div className="ec-flex ec-gap-8">
                <button className="cyber-btn ec-btn-sm" onClick={handleRepair} disabled={repairing || deepRepairing} aria-label="快速修复同步">
                    {repairing ? '同步中...' : '快速同步'}
                </button>
                <button className="cyber-btn ec-btn-sm" onClick={handleDeepRepair} disabled={repairing || deepRepairing} aria-label="AI深度修复">
                    {deepRepairing ? 'AI修复中...' : 'AI深度修复'}
                </button>
            </div>
        </div>
    );
}

export default DataHealthBanner;
