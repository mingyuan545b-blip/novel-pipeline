import { useState, useCallback } from 'react';
import { franchiseApi } from '../../services/api';
import logger from '../../shared/logger';
import { useFranchiseImportState } from './useFranchiseImportState';
import { useFranchiseProductState } from './useFranchiseProductState';

export default function useFranchiseState({ loadProjects, selectProject, showError }) {
    const [franchises, setFranchises] = useState([]);
    const [showCreateFranchise, setShowCreateFranchise] = useState(false);
    const [franchiseForm, setFranchiseForm] = useState({ name: '', description: '', genre: '' });
    const [expandedFranchises, setExpandedFranchises] = useState({});

    const importState = useFranchiseImportState();

    const loadFranchises = useCallback(async () => {
        try {
            const res = await franchiseApi.list();
            setFranchises(res.data?.data || res.data || []);
        } catch (e) { logger.error('Franchise', 'Load franchises failed:', e.message); }
    }, []);

    const productState = useFranchiseProductState(loadProjects, loadFranchises, selectProject, showError);

    const toggleFranchise = useCallback((id) => {
        setExpandedFranchises(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    const deleteFranchise = useCallback(async (e, id) => {
        e.stopPropagation();
        if (!confirm('确定删除此世界观？需先删除旗下所有产品')) return;
        try { await franchiseApi.delete(id); loadFranchises(); }
        catch (err) { showError('删除失败: ' + (err.response?.data?.error || err.message)); }
    }, [loadFranchises, showError]);

    const createFranchise = useCallback(async () => {
        if (!franchiseForm.name.trim()) return;
        try {
            const payload = { ...franchiseForm };
            if (importState.importSourceProjectId && importState.importCategories.length > 0) {
                payload.importFromProjectId = importState.importSourceProjectId;
                payload.importCategories = importState.importCategories;
            }
            const res = await franchiseApi.create(payload);
            const franchiseId = res.data?.data?.id;
            const counts = res.data?.importCounts;
            let projectId = null;
            if (franchiseId) {
                const frRes = await franchiseApi.get(franchiseId);
                const frData = frRes.data?.data;
                if (frData?.projects && frData.projects.length > 0) {
                    projectId = frData.projects[0].id;
                } else {
                    try {
                        const prodRes = await franchiseApi.createProduct(franchiseId, {
                            name: franchiseForm.name + ' 第一部', targetChapters: 100,
                            newSeriesFocus: franchiseForm.description || '', importWorldview: true
                        });
                        projectId = prodRes.data?.data?.id;
                    } catch (e) { logger.error('Franchise', 'Auto-create product error:', e.message); }
                }
            }
            if (importState.fileParsedData && importState.fileCategories.length > 0 && (franchiseId || projectId)) {
                try {
                    const importPayload = { parsedData: importState.fileParsedData, importCategories: importState.fileCategories };
                    if (projectId) importPayload.projectId = projectId;
                    if (franchiseId) importPayload.franchiseId = franchiseId;
                    const importRes = await franchiseApi.importParsed(importPayload);
                    const fileCounts = importRes.data?.importCounts;
                    if (fileCounts) {
                        const allCounts = { ...counts };
                        for (const [k, v] of Object.entries(fileCounts)) allCounts[k] = (allCounts[k] || 0) + v;
                        const imported = Object.entries(allCounts).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(', ');
                        if (imported) alert(`导入完成: ${imported}`);
                    }
                } catch (e) { alert('文件导入失败: ' + (e.response?.data?.error || e.message)); }
            } else if (counts) {
                const imported = Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(', ');
                if (imported) alert(`导入完成: ${imported}`);
            }
            setFranchiseForm({ name: '', description: '', genre: '' });
            importState.resetImportState();
            setShowCreateFranchise(false);
            loadFranchises();
        } catch (e) { showError('创建世界观失败: ' + (e.response?.data?.error || e.message)); }
    }, [franchiseForm, importState, loadFranchises, showError]);

    return {
        franchises, loadFranchises, showCreateFranchise, setShowCreateFranchise,
        franchiseForm, setFranchiseForm, createFranchise, deleteFranchise,
        toggleFranchise, expandedFranchises,
        ...importState,
        ...productState,
    };
}
