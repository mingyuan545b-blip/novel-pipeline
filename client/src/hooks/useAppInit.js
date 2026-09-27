import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import useAppStore from '../store/useAppStore';
import { projectsApi, settingsApi, pipelineApi, licenseApi, versionApi } from '../services/api';
import { PROJECT_KEYS } from '../hooks/queries/useProjects';
import { SETTINGS_KEYS } from '../hooks/queries/useSettings';
import { PIPELINE_KEYS } from '../hooks/queries/usePipeline';
import wsManager from '../services/wsClient';
import { fetchAuthToken } from '../services/api/authInterceptor';

export default function useAppInit() {
    const { setMembership, setUpdateInfo } = useAppStore();
    const [dismissed, setDismissed] = useState(false);

    const { data: projects, error: projectsError, refetch: refetchProjects } = useQuery({
        queryKey: PROJECT_KEYS.lists(),
        queryFn: async () => {
            await fetchAuthToken(false);
            return projectsApi.list().then(r => r.data);
        },
        staleTime: 60_000,
        retry: 3,
        retryDelay: 3000,
        refetchOnReconnect: true,
    });

    const initError = useMemo(() =>
        (!dismissed && projectsError) ? '项目数据加载失败，请检查服务器是否正常运行' : null,
        [projectsError, dismissed]
    );
    const clearInitError = () => setDismissed(true);
    const retryInit = async () => {
        setDismissed(false);
        await fetchAuthToken(true);
        refetchProjects();
    };

    const { data: settings } = useQuery({
        queryKey: SETTINGS_KEYS.detail(),
        queryFn: () => settingsApi.get().then(r => r.data),
        staleTime: 60_000,
        retry: 1,
    });

    const { data: agents } = useQuery({
        queryKey: PIPELINE_KEYS.agents(),
        queryFn: () => pipelineApi.getAgents().then(r => r.data),
        staleTime: 60_000,
        retry: 1,
    });

    useEffect(() => {
        if (projects) {
            useAppStore.getState().setProjects(projects);
            const savedId = localStorage.getItem('app-current-project-id');
            const { currentProject } = useAppStore.getState();
            if (savedId && !currentProject) {
                const found = projects.find(p => p.id === savedId);
                if (found) useAppStore.getState().setCurrentProject(found);
            }
            // 深链接友好：新会话直接打开 /chapters 等页面时，若无记忆项目则默认选中第一个，
            // 与仪表盘 loadProjects 的自动选中规则保持一致，避免"请先在仪表盘选择项目"空状态
            if (!useAppStore.getState().currentProject && projects.length > 0) {
                useAppStore.getState().setCurrentProject(projects[0]);
            }
        }
    }, [projects]);

    useEffect(() => {
        if (settings) useAppStore.getState().setSettings(settings);
    }, [settings]);

    useEffect(() => {
        if (agents) useAppStore.getState().setAgents(agents);
    }, [agents]);

    useEffect(() => {
        const checkLicense = async () => {
            try {
                const res = await licenseApi.getStatus().catch(() => ({ data: { level: 'free', licensed: false } }));
                setMembership(res.data || { level: 'free', licensed: false });
            } catch { /* license check optional */ }
        };
        checkLicense();

        const checkUpdate = async () => {
            try {
                const res = await versionApi.getInfo().catch(() => null);
                if (res?.data) setUpdateInfo(res.data);
            } catch { /* license check optional */ }
        };
        checkUpdate();

        return () => {
            wsManager.clearAll();
        };
    }, [setMembership, setUpdateInfo]);

    return { initError, clearInitError, retryInit };
}
