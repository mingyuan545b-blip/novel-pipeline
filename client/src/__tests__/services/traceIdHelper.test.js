import { describe, it, expect, beforeEach } from 'vitest';
import {
    extractTraceIdFromResponse,
    extractTraceIdFromError,
    recordTraceId,
    getLastTraceId,
    getTraceIdHistory,
    formatErrorMessage,
    clearTraceIdHistory
} from '../../services/api/traceIdHelper';

describe('traceIdHelper', () => {
    beforeEach(() => {
        clearTraceIdHistory();
    });

    describe('extractTraceIdFromResponse', () => {
        it('从响应头提取 traceId（小写）', () => {
            const response = { headers: { 'x-trace-id': 'tr-abc123' }, data: {} };
            expect(extractTraceIdFromResponse(response)).toBe('tr-abc123');
        });

        it('从响应头提取 traceId（axios 自动转小写）', () => {
            // axios 会将响应头名称转为小写，因此大写 key 在实际场景中不会出现
            // 此测试验证：若 header 已是小写则正常提取
            const response = { headers: { 'x-trace-id': 'tr-xyz789' }, data: {} };
            expect(extractTraceIdFromResponse(response)).toBe('tr-xyz789');
        });

        it('响应头无 traceId 时从响应体提取', () => {
            const response = { headers: {}, data: { traceId: 'tr-body456' } };
            expect(extractTraceIdFromResponse(response)).toBe('tr-body456');
        });

        it('响应头优先于响应体', () => {
            const response = {
                headers: { 'x-trace-id': 'tr-header' },
                data: { traceId: 'tr-body' }
            };
            expect(extractTraceIdFromResponse(response)).toBe('tr-header');
        });

        it('无 traceId 返回 null', () => {
            const response = { headers: {}, data: {} };
            expect(extractTraceIdFromResponse(response)).toBeNull();
        });

        it('null 响应返回 null', () => {
            expect(extractTraceIdFromResponse(null)).toBeNull();
        });
    });

    describe('extractTraceIdFromError', () => {
        it('从 axios error.response 提取 traceId', () => {
            const error = {
                response: {
                    headers: { 'x-trace-id': 'tr-err123' },
                    data: { error: '失败' }
                }
            };
            expect(extractTraceIdFromError(error)).toBe('tr-err123');
        });

        it('从 axios error.response.data 提取 traceId', () => {
            const error = {
                response: {
                    headers: {},
                    data: { traceId: 'tr-body-err', error: '失败' }
                }
            };
            expect(extractTraceIdFromError(error)).toBe('tr-body-err');
        });

        it('网络错误（无 response）返回 null', () => {
            const error = { code: 'ECONNABORTED', message: 'timeout' };
            expect(extractTraceIdFromError(error)).toBeNull();
        });

        it('null error 返回 null', () => {
            expect(extractTraceIdFromError(null)).toBeNull();
        });
    });

    describe('traceId 历史记录', () => {
        it('recordTraceId 记录到历史', () => {
            recordTraceId('tr-001');
            recordTraceId('tr-002');
            expect(getLastTraceId()).toBe('tr-002');
            expect(getTraceIdHistory()).toHaveLength(2);
        });

        it('getLastTraceId 返回最近一次', () => {
            recordTraceId('tr-old');
            recordTraceId('tr-new');
            expect(getLastTraceId()).toBe('tr-new');
        });

        it('空历史返回 null', () => {
            expect(getLastTraceId()).toBeNull();
            expect(getTraceIdHistory()).toEqual([]);
        });

        it('超过最大数量时移除最早记录', () => {
            for (let i = 0; i < 25; i++) {
                recordTraceId(`tr-${i.toString().padStart(3, '0')}`);
            }
            expect(getTraceIdHistory()).toHaveLength(20);
            expect(getLastTraceId()).toBe('tr-024');
        });

        it('recordTraceId 忽略空值', () => {
            recordTraceId(null);
            recordTraceId(undefined);
            recordTraceId('');
            expect(getTraceIdHistory()).toHaveLength(0);
        });

        it('clearTraceIdHistory 清空历史', () => {
            recordTraceId('tr-001');
            recordTraceId('tr-002');
            clearTraceIdHistory();
            expect(getTraceIdHistory()).toEqual([]);
            expect(getLastTraceId()).toBeNull();
        });
    });

    describe('formatErrorMessage', () => {
        it('含 traceId 时附加反馈指引', () => {
            const result = formatErrorMessage('保存失败', 'tr-abc123');
            expect(result).toContain('保存失败');
            expect(result).toContain('tr-abc123');
            expect(result).toContain('反馈此码');
        });

        it('无 traceId 时返回原始消息', () => {
            expect(formatErrorMessage('保存失败', null)).toBe('保存失败');
        });

        it('无 traceId 时返回原始消息（undefined）', () => {
            expect(formatErrorMessage('保存失败')).toBe('保存失败');
        });
    });
});
