import { useState, useEffect, useCallback } from 'react';
import logger from '../../shared/logger';
import { useQueryClient } from '@tanstack/react-query';
import {
    useMaterials, useCreateMaterial, useDeleteMaterial,
    useDialects, useSpeechStyles, useNamingStyles, useSystemPersonas,
    MATERIAL_KEYS,
} from '../../hooks/queries';
import { materialsApi } from '../../services/api';
import { useMaterialsIntegrityState } from './useMaterialsIntegrityState';

export default function useMaterialsState(currentProject, materials, setMaterials) {
    const qc = useQueryClient();
    const { data: materialsData } = useMaterials(currentProject?.id);
    const { data: dialectsData = [] } = useDialects();
    const { data: stylesData = [] } = useSpeechStyles();
    const { data: namingData = [] } = useNamingStyles();
    const { data: archetypesData = [] } = useSystemPersonas();
    const createMaterialMut = useCreateMaterial();
    const deleteMaterialMut = useDeleteMaterial();

    const [filterType, setFilterType] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [selectedMaterialId, setSelectedMaterialId] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const [activeView, setActiveView] = useState('active');
    const [showHistoryFor, setShowHistoryFor] = useState(null);
    const [collapsedTypes, setCollapsedTypes] = useState(new Set());
    const [expandedPlanes, setExpandedPlanes] = useState(new Set());
    const [flavorPreview, setFlavorPreview] = useState(null);

    const refreshMaterials = useCallback(() => {
        if (currentProject?.id) {
            qc.invalidateQueries({ queryKey: MATERIAL_KEYS.lists(currentProject.id) });
        }
    }, [qc, currentProject]);

    const integrityState = useMaterialsIntegrityState(currentProject, refreshMaterials);

    useEffect(() => {
        if (materialsData) setMaterials(materialsData);
    }, [materialsData, setMaterials]);

    const selectMaterial = useCallback((matId) => {
        setSelectedMaterialId(matId);
        setIsEditing(false);
    }, []);

    const startEdit = useCallback((material) => {
        setEditingMaterial(material.id);
        setSelectedMaterialId(material.id);
        setIsEditing(true);
        setFlavorPreview(null);
        setEditForm({
            name: material.name,
            type: material.type,
            currentContent: material.currentContent || '',
            changeReason: '',
            dialectRegion: material.dialectRegion || '',
            dialectIntensity: material.dialectIntensity || 'medium',
            speechStyle: material.speechStyle || '',
            speechStyleIntensity: material.speechStyleIntensity || 'medium',
            archetype: material.archetype || '',
        });
    }, []);

    const saveEdit = async () => {
        if (!editingMaterial) return;
        try { await materialsApi.update(editingMaterial, editForm); setIsEditing(false); refreshMaterials(); }
        catch (e) { logger.error('useMaterialsState', 'Save error:', e.message); }
    };

    const createMaterial = async (formData) => {
        if (!currentProject) return;
        try { await createMaterialMut.mutateAsync({ ...formData, projectId: currentProject.id }); setShowCreate(false); }
        catch (e) { logger.error('useMaterialsState', 'Create error:', e.message); }
    };

    const deleteMaterial = async (id) => {
        if (!confirm('确定删除此素材？')) return;
        try { await deleteMaterialMut.mutateAsync({ id, _projectId: currentProject?.id }); }
        catch (e) { alert('删除失败: ' + (e.response?.data?.error || e.message)); }
    };

    const activeMaterials = materials.filter(m => !m.archived);
    const archivedMaterials = materials.filter(m => m.archived);

    const filteredMaterials = (activeView === 'archived' ? archivedMaterials : activeMaterials).filter(m => {
        if (filterType !== 'all' && m.type !== filterType) return false;
        if (searchTerm && !m.name.toLowerCase().includes(searchTerm.toLowerCase())
            && !m.currentContent?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    return {
        filterType, setFilterType, searchTerm, setSearchTerm,
        editingMaterial, selectedMaterialId, showCreate, setShowCreate,
        editForm, setEditForm, isEditing, setIsEditing,
        activeView, setActiveView, showHistoryFor, setShowHistoryFor,
        collapsedTypes, setCollapsedTypes, expandedPlanes, setExpandedPlanes,
        flavorPreview, setFlavorPreview,
        selectMaterial, startEdit, saveEdit, createMaterial, deleteMaterial,
        refreshMaterials,
        activeMaterials, archivedMaterials, filteredMaterials,
        dialectsData, stylesData, namingData, archetypesData,
        ...integrityState,
    };
}
