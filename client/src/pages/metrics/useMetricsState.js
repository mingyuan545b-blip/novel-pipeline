import { useState, useEffect, useCallback } from 'react';
import { healthApi } from '../../services/api';
import logger from '../../shared/logger';

const REFRESH_INTERVAL_MS = 30000;

export default function useMetricsState() {
    const [metrics, setMetrics] = useState(null);
    const [snapshots, setSnapshots] = useState([]);
    const [quotaPrediction, setQuotaPrediction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await healthApi.getMetrics();
            setMetrics(res.data || res);
            setError(null);
        } catch (e) {
            logger.warn('Metrics', 'Failed to fetch metrics:', e.message);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchSnapshots = useCallback(async () => {
        try {
            const res = await healthApi.getSnapshots(24);
            setSnapshots(res.data?.snapshots || res.snapshots || []);
        } catch (e) {
            logger.warn('Metrics', 'Failed to fetch snapshots:', e.message);
        }
    }, []);

    const fetchQuotaPrediction = useCallback(async () => {
        try {
            // 从当前 metrics 推算 hourlyTokenRate 与 quotaLimit
            const llmSummary = metrics?.llm?.summary;
            if (!llmSummary) return;
            // 简化：用 totalTokens / 24 作为小时速率估算（snapshots 是 24 小时窗口）
            const hourlyRate = Math.max(1, Math.round(llmSummary.totalTokens / 24));
            const quotaLimit = 1000000; // 默认配额上限，可由用户覆盖
            const res = await healthApi.getQuotaPrediction(hourlyRate, quotaLimit);
            setQuotaPrediction(res.data?.data || res.data || null);
        } catch (e) {
            logger.warn('Metrics', 'Failed to fetch quota prediction:', e.message);
        }
    }, [metrics]);

    const triggerSnapshot = useCallback(async () => {
        try {
            await healthApi.triggerSnapshot();
            await fetchSnapshots();
        } catch (e) {
            logger.warn('Metrics', 'Failed to trigger snapshot:', e.message);
        }
    }, [fetchSnapshots]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchMetrics(), fetchSnapshots()]);
        };
        load();
    }, [fetchMetrics, fetchSnapshots]);

    // metrics 加载完成后拉取配额预测（依赖 metrics，避免重复请求）
    useEffect(() => {
        if (metrics?.llm?.summary) {
            fetchQuotaPrediction();
        }
    }, [metrics, fetchQuotaPrediction]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchMetrics, REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchMetrics]);

    return {
        metrics, snapshots, quotaPrediction, loading, error,
        autoRefresh, setAutoRefresh,
        refresh: fetchMetrics, triggerSnapshot
    };
}
