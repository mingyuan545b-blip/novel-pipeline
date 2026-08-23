import { useState, useCallback } from 'react';
import { franchiseApi, projectsApi } from '../../services/api';

export function useFranchiseProductState(loadProjects, loadFranchises, selectProject, showError) {
    const [showCreateProduct, setShowCreateProduct] = useState(null);
    const [productForm, setProductForm] = useState({ name: '', targetChapters: 100, newSeriesFocus: '', importWorldview: true });
    const [availableCharacters, setAvailableCharacters] = useState([]);
    const [selectedCharacters, setSelectedCharacters] = useState([]);
    const [loadingChars, setLoadingChars] = useState(false);
    const [creatingProduct, setCreatingProduct] = useState(false);

    const openCreateProduct = useCallback(async (franchiseId) => {
        setShowCreateProduct(franchiseId);
        setLoadingChars(true);
        setSelectedCharacters([]);
        setProductForm({ name: '', targetChapters: 100, newSeriesFocus: '', importWorldview: true });
        try {
            const res = await franchiseApi.getCharacters(franchiseId);
            setAvailableCharacters(res.data?.data?.characters || res.data?.characters || []);
        } catch { setAvailableCharacters([]); }
        setLoadingChars(false);
    }, []);

    const toggleCharacter = useCallback((charId) => {
        setSelectedCharacters(prev => prev.includes(charId) ? prev.filter(id => id !== charId) : [...prev, charId]);
    }, []);

    const selectAllCharacters = useCallback(() => {
        setSelectedCharacters(prev => {
            if (prev.length === availableCharacters.length) return [];
            return availableCharacters.map(c => c.id);
        });
    }, [availableCharacters]);

    const createProduct = useCallback(async () => {
        if (!productForm.name.trim()) return;
        setCreatingProduct(true);
        try {
            const res = await franchiseApi.createProduct(showCreateProduct, {
                name: productForm.name, targetChapters: productForm.targetChapters,
                newSeriesFocus: productForm.newSeriesFocus, inheritCharacterIds: selectedCharacters,
                importWorldview: productForm.importWorldview
            });
            setShowCreateProduct(null);
            loadProjects();
            loadFranchises();
            if (res.data?.id) {
                const projRes = await projectsApi.list();
                const newProj = projRes.data?.find(p => p.id === res.data.id);
                if (newProj) selectProject(newProj);
            }
        } catch (e) { showError('创建产品失败: ' + (e.response?.data?.error || e.message)); }
        setCreatingProduct(false);
    }, [productForm, showCreateProduct, selectedCharacters, loadProjects, loadFranchises, selectProject, showError]);

    return {
        showCreateProduct, setShowCreateProduct, openCreateProduct, createProduct,
        productForm, setProductForm, availableCharacters, selectedCharacters,
        loadingChars, toggleCharacter, selectAllCharacters, creatingProduct,
    };
}
