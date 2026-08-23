import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { genreDebugApi } from '../../services/api';

const STALE_TIME_GENRES = 5 * 60 * 1000;
const STALE_TIME_MODULES = 10 * 60 * 1000;
const SAVE_STATUS_TIMEOUT = 3000;

export default function useGenreDebugState() {
    const [selectedGenreId, setSelectedGenreId] = useState(null);
    const [expandedAgent, setExpandedAgent] = useState(null);
    const [activeTab, setActiveTab] = useState('constraints');
    const [editData, setEditData] = useState(null);
    const [saveStatus, setSaveStatus] = useState(null);
    const [expandedModule, setExpandedModule] = useState(null);
    const queryClient = useQueryClient();

    const genresQuery = useQuery({
        queryKey: ['genre-debug', 'list'],
        queryFn: () => genreDebugApi.listGenres().then(r => r.data?.data || r.data || []),
        staleTime: STALE_TIME_GENRES,
    });

    const genreAgentsQuery = useQuery({
        queryKey: ['genre-debug', selectedGenreId, 'agents'],
        queryFn: () => genreDebugApi.getGenreAgents(selectedGenreId).then(r => r.data?.data || r.data),
        enabled: !!selectedGenreId,
    });

    const promptQuery = useQuery({
        queryKey: ['genre-debug', selectedGenreId, expandedAgent, 'prompt'],
        queryFn: () => genreDebugApi.getAgentPrompt(selectedGenreId, expandedAgent).then(r => r.data?.data || r.data),
        enabled: !!selectedGenreId && !!expandedAgent,
    });

    const constraintsQuery = useQuery({
        queryKey: ['genre-debug', selectedGenreId, 'constraints'],
        queryFn: () => genreDebugApi.getConstraints(selectedGenreId).then(r => r.data?.data || r.data),
        enabled: !!selectedGenreId,
    });

    const constraintModulesQuery = useQuery({
        queryKey: ['genre-debug', 'constraint-modules'],
        queryFn: () => genreDebugApi.getConstraintModules().then(r => r.data?.data || r.data),
        staleTime: STALE_TIME_MODULES,
    });

    const saveMutation = useMutation({
        mutationFn: (data) => genreDebugApi.updateConstraints(selectedGenreId, data),
        onSuccess: () => {
            setSaveStatus({ type: 'success', message: '保存成功！约束词已更新到内存，无需重启服务器。' });
            queryClient.invalidateQueries({ queryKey: ['genre-debug', selectedGenreId, 'constraints'] });
            setTimeout(() => setSaveStatus(null), SAVE_STATUS_TIMEOUT);
        },
        onError: (err) => {
            setSaveStatus({ type: 'error', message: `保存失败: ${err.response?.data?.error || err.message}` });
        },
    });

    const genres = genresQuery.data || [];
    const agents = genreAgentsQuery.data?.agents || [];
    const genreInfo = genreAgentsQuery.data?.genre || null;
    const materialFocus = genreAgentsQuery.data?.materialFocus || {};
    const requiredConstraints = genreAgentsQuery.data?.requiredConstraints || [];
    const incompatibleConstraints = genreAgentsQuery.data?.incompatibleConstraints || [];

    const constraintsData = constraintsQuery.data;
    const constraints = useMemo(() => constraintsData?.constraints || [], [constraintsData?.constraints]);
    const foundationRules = useMemo(() => constraintsData?.foundationRules || [], [constraintsData?.foundationRules]);
    const styleProfile = useMemo(() => constraintsData?.styleProfile || {}, [constraintsData?.styleProfile]);
    const pacingConfig = constraintsData?.pacingConfig || {};
    const requiredIds = constraintsData?.requiredConstraints || [];
    const incompatibleIds = constraintsData?.incompatibleConstraints || [];

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (constraintsData) {
            setEditData({
                constraints: (constraintsData.constraints || []).map(c => ({ ...c })),
                foundationRules: [...(constraintsData.foundationRules || [])],
                styleProfile: { ...(constraintsData.styleProfile || {}) },
            });
        }
    }, [constraintsData]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleSelectGenre = useCallback((genreId) => {
        setSelectedGenreId(prev => prev === genreId ? prev : genreId);
        setExpandedAgent(null);
        setEditData(null);
        setSaveStatus(null);
    }, []);

    const handleToggleAgent = useCallback((agentType) => {
        setExpandedAgent(prev => prev === agentType ? null : agentType);
    }, []);

    const handleConstraintChange = useCallback((index, field, value) => {
        setEditData(prev => {
            if (!prev) return prev;
            return { ...prev, constraints: prev.constraints.map((c, i) => i === index ? { ...c, [field]: value } : c) };
        });
    }, []);

    const handleAddConstraint = useCallback(() => {
        setEditData(prev => {
            if (!prev) return prev;
            return { ...prev, constraints: [...prev.constraints, { id: `custom-${Date.now()}`, label: '新约束', desc: '请填写约束描述' }] };
        });
    }, []);

    const handleRemoveConstraint = useCallback((index) => {
        setEditData(prev => {
            if (!prev) return prev;
            return { ...prev, constraints: prev.constraints.filter((_, i) => i !== index) };
        });
    }, []);

    const handleFoundationRuleChange = useCallback((index, value) => {
        setEditData(prev => {
            if (!prev) return prev;
            return { ...prev, foundationRules: prev.foundationRules.map((r, i) => i === index ? value : r) };
        });
    }, []);

    const handleAddFoundationRule = useCallback(() => {
        setEditData(prev => {
            if (!prev) return prev;
            return { ...prev, foundationRules: [...prev.foundationRules, '- 新增基础规则'] };
        });
    }, []);

    const handleRemoveFoundationRule = useCallback((index) => {
        setEditData(prev => {
            if (!prev) return prev;
            return { ...prev, foundationRules: prev.foundationRules.filter((_, i) => i !== index) };
        });
    }, []);

    const handleStyleChange = useCallback((field, value) => {
        setEditData(prev => {
            if (!prev) return prev;
            return { ...prev, styleProfile: { ...prev.styleProfile, [field]: value } };
        });
    }, []);

    const handleSave = useCallback(() => {
        if (!editData) return;
        saveMutation.mutate({
            constraints: editData.constraints,
            foundationRules: editData.foundationRules,
            styleProfile: editData.styleProfile,
        });
    }, [editData, saveMutation]);

    const handleReset = useCallback(() => {
        setEditData({
            constraints: constraints.map(c => ({ ...c })),
            foundationRules: [...foundationRules],
            styleProfile: { ...styleProfile },
        });
        setSaveStatus(null);
    }, [constraints, foundationRules, styleProfile]);

    return {
        selectedGenreId, activeTab, expandedAgent, expandedModule,
        editData, saveStatus,
        genres, agents, genreInfo, materialFocus,
        requiredConstraints, incompatibleConstraints,
        constraints, foundationRules, styleProfile, pacingConfig,
        requiredIds, incompatibleIds,
        genresQuery, promptQuery, constraintsQuery, constraintModulesQuery,
        saveMutation,
        setActiveTab, setExpandedModule,
        handleSelectGenre, handleToggleAgent,
        handleConstraintChange, handleAddConstraint, handleRemoveConstraint,
        handleFoundationRuleChange, handleAddFoundationRule, handleRemoveFoundationRule,
        handleStyleChange, handleSave, handleReset,
    };
}
