import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { debugApi } from '../../services/api';
import { DEBUG_KEYS, TRACE_IDS_POLL_MS } from './keys';

/**
 * Trace 相关 hooks：useTraceIds / useTraceLogs / useLogStats / useClearLogs
 * 文件位置：client/src/hooks/useDebugLogs/traceHooks.js
 */

export function useTraceIds(opts = {}) {
    const level = opts.level;
    const includeArchive = opts.includeArchive === true;
    const refetchInterval = opts.polling === false ? false : TRACE_IDS_POLL_MS;
    return useQuery({
        queryKey: DEBUG_KEYS.traceIds(level, includeArchive),
        queryFn: async () => {
            const res = await debugApi.listTraceIds({ limit: 100, level, includeArchive });
            return res.data?.data || [];
        },
        refetchInterval,
        staleTime: 5000
    });
}

export function useTraceLogs(traceId, opts = {}) {
    const level = opts.level;
    return useQuery({
        queryKey: DEBUG_KEYS.logs(traceId, level),
        queryFn: async () => {
            if (!traceId) return null;
            const res = await debugApi.getLogs(traceId, { level });
            return res.data?.data || null;
        },
        enabled: !!traceId,
        staleTime: 0
    });
}

export function useLogStats() {
    return useQuery({
        queryKey: DEBUG_KEYS.stats(),
        queryFn: async () => {
            const res = await debugApi.getStats();
            return res.data?.data || {};
        },
        staleTime: 30000
    });
}

export function useClearLogs() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const res = await debugApi.clearLogs();
            return res.data?.data || {};
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: DEBUG_KEYS.all });
        }
    });
}
