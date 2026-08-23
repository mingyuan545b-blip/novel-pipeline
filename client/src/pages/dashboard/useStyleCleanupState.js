import { useState, useCallback } from 'react';
import { projectsApi } from '../../services/api';

export function useStyleCleanupState(setProjects, _showError) {
    const [cleanupModal, setCleanupModal] = useState(null);
    const [cleanupStats, setCleanupStats] = useState(null);
    const [cleanupTargets, setCleanupTargets] = useState([]);
    const [cleanupKeepLocked, setCleanupKeepLocked] = useState(true);
    const [cleanupLoading, setCleanupLoading] = useState(false);
    const [cleanupResult, setCleanupResult] = useState(null);

    const openCleanupModal = useCallback(async (proj) => {
        setCleanupModal(proj); setCleanupTargets([]); setCleanupKeepLocked(true);
        setCleanupResult(null); setCleanupLoading(true);
        try { const res = await projectsApi.getCleanupStats(proj.id); setCleanupStats(res.data); }
        catch { setCleanupStats(null); }
        setCleanupLoading(false);
    }, []);

    const executeCleanup = useCallback(async () => {
        if (!cleanupModal || cleanupTargets.length === 0) return;
        if (!confirm(`确定清理「${cleanupModal.name}」的选中项目？\n\n此操作不可撤销！`)) return;
        setCleanupLoading(true);
        try {
            const res = await projectsApi.cleanup(cleanupModal.id, cleanupTargets, cleanupKeepLocked);
            setCleanupResult(res.data);
            const projRes = await projectsApi.list();
            setProjects(projRes.data);
            try { const statsRes = await projectsApi.getCleanupStats(cleanupModal.id); setCleanupStats(statsRes.data); } catch { /* stats optional */ }
        } catch (err) { alert('清理失败: ' + (err.message || '未知错误')); }
        setCleanupLoading(false);
    }, [cleanupModal, cleanupTargets, cleanupKeepLocked, setProjects]);

    return {
        cleanupModal, setCleanupModal, cleanupStats, cleanupTargets, setCleanupTargets,
        cleanupKeepLocked, setCleanupKeepLocked, cleanupLoading, cleanupResult,
        openCleanupModal, executeCleanup,
    };
}
