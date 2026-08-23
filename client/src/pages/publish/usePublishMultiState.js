import { useState, useEffect, useRef } from 'react';
import { publishApi } from '../../services/api';
import logger from '../../shared/logger';
import { MULTI_PLATFORMS, LOGIN_STATUS_MAP, DEFAULT_LOGIN_BADGE, defaultConfig } from './publishConstants';

export function usePublishMultiState() {
    const [multiConfigs, setMultiConfigs] = useState(() => {
        const c = {};
        MULTI_PLATFORMS.forEach(p => {
            const saved = localStorage.getItem(`publish_config_${p.key}`);
            c[p.key] = saved ? { ...defaultConfig, ...JSON.parse(saved) } : { ...defaultConfig };
        });
        return c;
    });

    useEffect(() => {
        for (const [key, cfg] of Object.entries(multiConfigs)) {
            localStorage.setItem(`publish_config_${key}`, JSON.stringify(cfg));
        }
    }, [multiConfigs]);

    const [multiStatuses, setMultiStatuses] = useState({});
    const [expandedPlatform, setExpandedPlatform] = useState('fanqie');
    const [multiLogs, setMultiLogs] = useState({});
    const [loginChecking] = useState({});
    const [loginResults, setLoginResults] = useState({});
    const pollRef = useRef(null);

    useEffect(() => {
        const pollAll = async () => {
            try {
                const res = await publishApi.multiGetAllStatus();
                const statuses = res.data || {};
                setMultiStatuses(prev => {
                    for (const [platform, status] of Object.entries(statuses)) {
                        const prevStatus = prev[platform];
                        if (prevStatus?.running && !status.running && (status.completedChapters > 0 || status.failedChapters > 0)) {
                            const pName = MULTI_PLATFORMS.find(p => p.key === platform)?.name || platform;
                            setTimeout(() => alert(`${pName} 发布完成！成功: ${status.completedChapters}章, 失败: ${status.failedChapters}章`), 100);
                        }
                    }
                    return statuses;
                });
                const logs = {};
                for (const [platform, status] of Object.entries(statuses)) {
                    if (status.logs) logs[platform] = status.logs;
                    if (status.loginStatus) {
                        const mapped = status.loginStatus === 'logged-in' ? 'logged-in' : status.loginStatus === 'waiting' ? 'waiting' : status.loginStatus;
                        setLoginResults(prev => ({ ...prev, [platform]: mapped }));
                    }
                }
                setMultiLogs(prev => ({ ...prev, ...logs }));
            } catch (err) { logger.warn('Publish', 'Poll error:', err.message); }
        };
        pollAll();
        pollRef.current = setInterval(pollAll, 3000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    const getLoginStatusBadge = (platformKey) => {
        const status = loginResults[platformKey];
        const stateStatus = multiStatuses[platformKey]?.loginStatus;
        const effective = status || stateStatus;
        return LOGIN_STATUS_MAP[effective] || DEFAULT_LOGIN_BADGE;
    };

    return {
        multiConfigs, setMultiConfigs, multiStatuses, multiLogs,
        expandedPlatform, setExpandedPlatform,
        loginChecking, loginResults,
        getLoginStatusBadge,
    };
}
