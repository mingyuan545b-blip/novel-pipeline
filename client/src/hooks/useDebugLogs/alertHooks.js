import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { debugApi } from '../../services/api';
import { DEBUG_KEYS, ALERTS_POLL_MS, AGGREGATIONS_POLL_MS } from './keys';

/**
 * 告警相关 hooks：useAggregations / useAlerts / useAcknowledgeAlert / useEvaluateAlerts / useAlertRules
 * 文件位置：client/src/hooks/useDebugLogs/alertHooks.js
 */

export function useAggregations(opts = {}) {
    const minCount = opts.minCount || 1;
    const refetchInterval = opts.polling === false ? false : AGGREGATIONS_POLL_MS;
    return useQuery({
        queryKey: DEBUG_KEYS.aggregations(minCount),
        queryFn: async () => {
            const res = await debugApi.getAggregations({ limit: 100, minCount });
            return res.data?.data || [];
        },
        refetchInterval,
        staleTime: 5000
    });
}

export function useAlerts(opts = {}) {
    const refetchInterval = opts.polling === false ? false : ALERTS_POLL_MS;
    return useQuery({
        queryKey: DEBUG_KEYS.alerts(),
        queryFn: async () => {
            const res = await debugApi.getAlerts();
            return res.data?.data || [];
        },
        refetchInterval,
        staleTime: 0
    });
}

export function useAcknowledgeAlert() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (alertId) => {
            const res = await debugApi.acknowledgeAlert(alertId);
            return res.data?.data || {};
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: DEBUG_KEYS.alerts() });
        }
    });
}

export function useEvaluateAlerts() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const res = await debugApi.evaluateAlerts();
            return res.data?.data || {};
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: DEBUG_KEYS.alerts() });
        }
    });
}

export function useAlertRules() {
    return useQuery({
        queryKey: DEBUG_KEYS.alertRules(),
        queryFn: async () => {
            const res = await debugApi.getAlertRules();
            return res.data?.data || [];
        },
        staleTime: 60000
    });
}
