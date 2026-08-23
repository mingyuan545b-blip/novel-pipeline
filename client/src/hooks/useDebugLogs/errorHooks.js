import { useQuery } from '@tanstack/react-query';
import { debugApi } from '../../services/api';
import { DEBUG_KEYS, ERRORS_POLL_MS } from './keys';

/**
 * 错误追踪相关 hooks：useErrorLogs / useErrorStats（方向 F）
 * 文件位置：client/src/hooks/useDebugLogs/errorHooks.js
 */

export function useErrorLogs(opts = {}) {
    const limit = opts.limit || 50;
    const refetchInterval = opts.polling === false ? false : ERRORS_POLL_MS;
    return useQuery({
        queryKey: DEBUG_KEYS.errors(limit),
        queryFn: async () => {
            const res = await debugApi.getErrors({ limit });
            return {
                items: res.data?.data || [],
                total: res.data?.meta?.total || 0,
                returned: res.data?.meta?.returned || 0
            };
        },
        refetchInterval,
        staleTime: 5000
    });
}

export function useErrorStats(opts = {}) {
    const refetchInterval = opts.polling === false ? false : ERRORS_POLL_MS;
    return useQuery({
        queryKey: DEBUG_KEYS.errorStats(),
        queryFn: async () => {
            const res = await debugApi.getErrorStats();
            return res.data?.data || { total: 0, topCodes: [], topModules: [] };
        },
        refetchInterval,
        staleTime: 5000
    });
}
