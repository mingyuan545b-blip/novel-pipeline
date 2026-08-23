import { useState, useCallback } from 'react';
import { franchiseApi } from '../../services/api';
import logger from '../../shared/logger';

export function useFranchiseImportState() {
    const [importSourceProjectId, setImportSourceProjectId] = useState('');
    const [importOverview, setImportOverview] = useState(null);
    const [importCategories, setImportCategories] = useState([]);
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [fileParsedData, setFileParsedData] = useState(null);
    const [fileCategories, setFileCategories] = useState([]);
    const [uploadingFile, setUploadingFile] = useState(false);

    const loadProjectOverview = useCallback(async (projectId) => {
        if (!projectId) { setImportOverview(null); setImportCategories([]); return; }
        setLoadingOverview(true);
        try {
            const res = await franchiseApi.getProjectOverview(projectId);
            const overview = res.data?.data;
            setImportOverview(overview);
            if (overview?.categories) setImportCategories(overview.categories.map(c => c.key));
        } catch (e) { logger.error('Franchise', 'Load project overview failed:', e.message); setImportOverview(null); }
        setLoadingOverview(false);
    }, []);

    const toggleImportCategory = useCallback((key) => {
        setImportCategories(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }, []);

    const handleFileUpload = useCallback(async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadingFile(true);
        try {
            const formData = new FormData();
            for (const file of files) formData.append('files', file);
            const res = await franchiseApi.parseFile(formData);
            const data = res.data?.data;
            if (data) {
                setFileParsedData(data.parsedData);
                setFileCategories(data.categories.map(c => c.key));
                setImportSourceProjectId('');
                setImportOverview(null);
            }
        } catch (err) { alert('文件解析失败: ' + (err.response?.data?.error || err.message)); }
        setUploadingFile(false);
    }, []);

    const toggleFileCategory = useCallback((key) => {
        setFileCategories(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }, []);

    const resetImportState = useCallback(() => {
        setImportSourceProjectId(''); setImportOverview(null); setImportCategories([]);
        setFileParsedData(null); setFileCategories([]);
    }, []);

    return {
        importSourceProjectId, setImportSourceProjectId,
        importOverview, importCategories, setImportCategories,
        loadingOverview, loadProjectOverview, toggleImportCategory,
        fileParsedData, setFileParsedData, fileCategories, setFileCategories,
        uploadingFile, handleFileUpload, toggleFileCategory,
        resetImportState,
    };
}
