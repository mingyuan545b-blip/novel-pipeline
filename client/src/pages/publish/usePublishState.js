import { useState, useEffect } from 'react';
import useAppStore from '../../store/useAppStore';
import { useChapters } from '../../hooks/queries/useChapters';
import { publishApi } from '../../services/api';
import logger from '../../shared/logger';
import { DEFAULT_ACCOUNT, DEFAULT_INTERACTION, STATUS_LABELS } from './publishConstants';
import { STATUS_VALUES } from '../pipeline/pipelineConstants';
import { usePublishMultiState } from './usePublishMultiState';
import { usePublishUpdateState } from './usePublishUpdateState';

export function usePublishState() {
    const currentProject = useAppStore(s => s.currentProject);
    const { data: chapters = [] } = useChapters(currentProject?.id);
    const [platforms, setPlatforms] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [queue, setQueue] = useState([]);
    const [interactions, setInteractions] = useState([]);
    const [publishStats, setPublishStats] = useState(null);
    const [interactionStats, setInteractionStats] = useState(null);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [showAddInteraction, setShowAddInteraction] = useState(false);
    const [newAccount, setNewAccount] = useState({ ...DEFAULT_ACCOUNT });
    const [newInteraction, setNewInteraction] = useState({ ...DEFAULT_INTERACTION });
    const [batchConfig, setBatchConfig] = useState({ platformAccountId: '', scheduleInterval: 30 });

    const multiState = usePublishMultiState();
    const updateState = usePublishUpdateState();

    useEffect(() => {
        publishApi.getPlatforms().then(res => setPlatforms(res.data || [])).catch(e => logger.warn('Publish', 'Load platforms failed:', e.message));
    }, []);

    const refreshData = () => {
        if (!currentProject) return;
        publishApi.getAccounts(currentProject.id).then(res => setAccounts(res.data || [])).catch(e => logger.warn('Publish', 'Load accounts failed:', e.message));
        publishApi.getQueue(currentProject.id).then(res => setQueue(res.data || [])).catch(e => logger.warn('Publish', 'Load queue failed:', e.message));
        publishApi.getInteractions(currentProject.id).then(res => setInteractions(res.data || [])).catch(e => logger.warn('Publish', 'Load interactions failed:', e.message));
        publishApi.getPublishStats(currentProject.id).then(res => setPublishStats(res.data || null)).catch(e => logger.warn('Publish', 'Load publish stats failed:', e.message));
        publishApi.getInteractionStats(currentProject.id).then(res => setInteractionStats(res.data || null)).catch(e => logger.warn('Publish', 'Load interaction stats failed:', e.message));
    };

    useEffect(() => { if (currentProject) refreshData(); }, [currentProject]); // eslint-disable-line react-hooks/exhaustive-deps

    const getStatusLabel = (status) => STATUS_LABELS[status] || status;
    const approvedCount = chapters.filter(ch => ch.status === STATUS_VALUES.APPROVED || ch.status === STATUS_VALUES.MATERIAL_UPDATED).length;

    return {
        currentProject, chapters, platforms, accounts, queue, interactions,
        publishStats, interactionStats, approvedCount,
        showAddAccount, setShowAddAccount, newAccount, setNewAccount,
        showAddInteraction, setShowAddInteraction, newInteraction, setNewInteraction,
        batchConfig, setBatchConfig,
        refreshData, getStatusLabel,
        ...multiState,
        ...updateState,
    };
}
