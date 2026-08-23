import { useState } from 'react';
import useAppStore from '../../store/useAppStore';
import { useCharacterList, useKVIndex, useStateSummary, useCharacterStates, useStateMeta, useCharacterHistory, useStateSync } from '../../hooks/queries/useCharacterStates';
import { useChapters } from '../../hooks/queries/useChapters';

export default function useCharacterState() {
    const { currentProject } = useAppStore();
    const [activeTab, setActiveTab] = useState('characters');
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [selectedCharacter, setSelectedCharacter] = useState(null);
    const [kvScopeFilter, setKvScopeFilter] = useState('all');
    const [historyCharId, setHistoryCharId] = useState(null);
    const [syncFrom, setSyncFrom] = useState('');
    const [syncTo, setSyncTo] = useState('');

    const projectId = currentProject?.id;
    const { data: meta } = useStateMeta(projectId);
    const { data: charactersData } = useCharacterList(projectId, selectedChapter);
    const { data: kvData } = useKVIndex(projectId, kvScopeFilter !== 'all' ? { scope: kvScopeFilter } : {});
    const { data: summaryData } = useStateSummary(projectId, selectedChapter);
    const { data: statesData } = useCharacterStates(projectId, selectedChapter);
    const { data: chaptersData } = useChapters(projectId);
    const { data: historyData } = useCharacterHistory(projectId, historyCharId, 20);
    const syncMut = useStateSync();

    const maxChapter = chaptersData?.length ? Math.max(...chaptersData.map(c => c.chapterNumber || 0)) : 0;
    const chapterOptions = [];
    if (maxChapter > 0) { for (let i = 1; i <= maxChapter; i++) chapterOptions.push(i); }

    const toBeijingTime = (isoStr) => {
        if (!isoStr) return '未知';
        return new Date(isoStr).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const handleSync = async () => {
        if (!projectId) return;
        await syncMut.mutateAsync({ projectId, fromChapter: syncFrom ? parseInt(syncFrom) : undefined, toChapter: syncTo ? parseInt(syncTo) : undefined });
    };

    return {
        currentProject, activeTab, setActiveTab, selectedChapter, setSelectedChapter,
        selectedCharacter, setSelectedCharacter, kvScopeFilter, setKvScopeFilter,
        historyCharId, setHistoryCharId, syncFrom, setSyncFrom, syncTo, setSyncTo,
        projectId, meta, charactersData, kvData, summaryData, statesData, chaptersData,
        historyData, syncMut, chapterOptions, toBeijingTime, handleSync,
    };
}
