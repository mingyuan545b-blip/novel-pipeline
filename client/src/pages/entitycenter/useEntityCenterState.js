import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import useAppStore from '../../store/useAppStore';
import { useMaterials } from '../../hooks/queries/useMaterials';
import {
    useEntityRegistry,
    useItemDefinitions,
    useCharacterBinds,
    useCharacterRelations,
    usePetEntities,
    useServantEntities,
} from '../../hooks/queries/useEntityCenter';
import {
    useCharacterList,
    useKVIndex,
    useStateSummary,
    useCharacterStates,
    useStateMeta,
    useCharacterHistory,
    useStateSync,
} from '../../hooks/queries/useCharacterStates';
import { useChapters } from '../../hooks/queries/useChapters';
import { adaptEntity, adaptPet, adaptServant, adaptRelation, adaptList, buildNameToIdMap } from '../../services/adapters';
import { characterStateApi } from '../../services/api';

export default function useEntityCenterState() {
    const { currentProject } = useAppStore();
    const projectId = currentProject?.id;
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    const activeTab = searchParams.get('tab') || 'characters';
    const setActiveTab = useCallback((key) => {
        setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('tab', key); return next; }, { replace: true });
    }, [setSearchParams]);

    const [selectedCharId, setSelectedCharId] = useState(null);
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [descLevel, setDescLevel] = useState({});
    const [kvScopeFilter, setKvScopeFilter] = useState('all');
    const [historyCharId, setHistoryCharId] = useState(null);
    const [summaryCharId, setSummaryCharId] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [syncFrom, setSyncFrom] = useState('');
    const [syncTo, setSyncTo] = useState('');

    const { data: registryData, isLoading: regLoading } = useEntityRegistry(projectId);
    const { data: definitionsData } = useItemDefinitions(projectId);
    const { data: bindsData } = useCharacterBinds(projectId);
    const { data: relationsData } = useCharacterRelations(projectId);
    const { data: petsData } = usePetEntities(projectId);
    const { data: servantsData } = useServantEntities(projectId);
    const { data: materialsData } = useMaterials(projectId, { type: 'character' });

    const { data: csCharactersData } = useCharacterList(projectId, selectedChapter);
    const { data: kvData } = useKVIndex(projectId, kvScopeFilter !== 'all' ? { scope: kvScopeFilter } : {});
    const { data: summaryData } = useStateSummary(projectId, selectedChapter, summaryCharId);
    const { data: statesData } = useCharacterStates(projectId, selectedChapter);
    const { data: csMeta } = useStateMeta(projectId);
    const { data: historyData } = useCharacterHistory(projectId, historyCharId, 20);
    const syncMut = useStateSync();
    const { data: chaptersData } = useChapters(projectId);

    const materialsMap = useMemo(() => {
        const map = {};
        (materialsData || []).forEach(m => { map[m.id] = m; });
        return map;
    }, [materialsData]);

    const characters = useMemo(() => adaptList((registryData || []).filter(e => e.entityType === 'character'), adaptEntity, materialsMap), [registryData, materialsMap]);
    const equipment = useMemo(() => (definitionsData || []).filter(d => d.defType === 'equipment'), [definitionsData]);
    const techniques = useMemo(() => (definitionsData || []).filter(d => d.defType === 'technique'), [definitionsData]);
    const pets = useMemo(() => adaptList(petsData || [], adaptPet), [petsData]);
    const servants = useMemo(() => adaptList(servantsData || [], adaptServant), [servantsData]);
    const allBinds = useMemo(() => bindsData || [], [bindsData]);

    const nameToIdMap = useMemo(() => buildNameToIdMap(
        (registryData || []).filter(e => e.entityType === 'character'),
        materialsData || []
    ), [registryData, materialsData]);

    const allRelations = useMemo(() => adaptList(relationsData || [], adaptRelation, nameToIdMap), [relationsData, nameToIdMap]);

    const charNameMap = useMemo(() => {
        const map = {};
        (materialsData || []).forEach(m => { map[m.id] = m.name; });
        characters.forEach(c => {
            const cName = c._adapted?.name || c.name || c.id;
            map[c.id] = cName;
            if (cName !== c.id) map[cName] = cName;
        });
        return map;
    }, [materialsData, characters]);

    const getCharName = useCallback((id) => charNameMap[id] || id, [charNameMap]);

    const maxChapter = chaptersData?.length ? Math.max(...chaptersData.map(c => c.chapterNumber || 0)) : 0;
    const chapterOptions = [];
    if (maxChapter > 0) { for (let i = 1; i <= maxChapter; i++) chapterOptions.push(i); }

    const toBeijingTime = (isoStr) => {
        if (!isoStr) return '未知';
        return new Date(isoStr).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const handleSync = async () => {
        if (!projectId) return;
        await syncMut.mutateAsync({
            projectId,
            fromChapter: syncFrom ? parseInt(syncFrom) : undefined,
            toChapter: syncTo ? parseInt(syncTo) : undefined,
        });
    };

    const handleMigrateChineseKeys = async () => {
        if (!projectId) return;
        try {
            const res = await characterStateApi.migrateChineseKeys(projectId);
            await queryClient.invalidateQueries({ queryKey: ['character-states'] });
            await queryClient.invalidateQueries({ queryKey: ['entities'] });
            alert(`迁移完成！KV条目: ${res.data.migrated}, 删除旧条目: ${res.data.deleted}, 状态记录: ${res.data.statesMigrated}`);
        } catch (e) {
            alert('迁移失败: ' + (e.response?.data?.error || e.message));
        }
    };

    const handleCreateRelation = useCallback(async (data) => {
        if (!projectId) return;
        try {
            const { characterRelationsApi } = await import('../../services/api');
            await characterRelationsApi.create({ ...data, projectId });
            await queryClient.invalidateQueries({ queryKey: ['character-relations'] });
        } catch (e) {
            alert('创建关系失败: ' + (e.response?.data?.error || e.message));
        }
    }, [projectId, queryClient]);

    const selectedChar = characters.find(c => c.id === selectedCharId);
    const charBinds = useMemo(() => allBinds.filter(b => b.characterId === selectedCharId), [allBinds, selectedCharId]);
    const charRelations = useMemo(() => allRelations.filter(r => r.fromCharacterId === selectedCharId), [allRelations, selectedCharId]);

    const toggleExpand = useCallback((id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const toggleDesc = useCallback((id) => {
        setDescLevel(prev => ({ ...prev, [id]: prev[id] === 'detail' ? 'brief' : 'detail' }));
    }, []);

    const handleRepaired = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: ['entity-registry'] });
        await queryClient.invalidateQueries({ queryKey: ['entities'] });
    }, [queryClient]);

    const statsValues = useMemo(() => ({
        characters: characters.length,
        equipment: equipment.length,
        techniques: techniques.length,
        pets: pets.length,
        servants: servants.length,
    }), [characters, equipment, techniques, pets, servants]);

    return {
        currentProject, projectId, activeTab, setActiveTab,
        selectedCharId, setSelectedCharId, expandedIds, descLevel,
        kvScopeFilter, setKvScopeFilter, historyCharId, setHistoryCharId,
        summaryCharId, setSummaryCharId, selectedChapter, setSelectedChapter,
        syncFrom, setSyncFrom, syncTo, setSyncTo,
        regLoading, characters, equipment, techniques, pets, servants,
        allBinds, allRelations, csCharactersData, kvData, summaryData,
        statesData, csMeta, historyData, syncMut, chapterOptions,
        getCharName, toBeijingTime, handleSync, handleMigrateChineseKeys,
        handleCreateRelation, handleRepaired,
        selectedChar, charBinds, charRelations, toggleExpand, toggleDesc,
        statsValues,
    };
}
