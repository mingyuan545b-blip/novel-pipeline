const { LogStore } = require('../../server/shared/logStore');

describe('logStore', () => {
    describe('append + getByTraceId', () => {
        test('追加单条日志后可按 traceId 检索', () => {
            const store = new LogStore(10, 10);
            store.append('tr-abc', {
                timestamp: new Date().toISOString(),
                level: 'info',
                module: 'test',
                message: 'hello',
                context: {}
            });
            const record = store.getByTraceId('tr-abc');
            expect(record).not.toBeNull();
            expect(record.traceId).toBe('tr-abc');
            expect(record.logCount).toBe(1);
            expect(record.logs[0].message).toBe('hello');
            expect(record.levelCounts.info).toBe(1);
        });

        test('无 traceId 时归到 no-trace 桶', () => {
            const store = new LogStore(10, 10);
            store.append(null, {
                timestamp: new Date().toISOString(),
                level: 'debug',
                module: 'm',
                message: 'x',
                context: {}
            });
            const record = store.getByTraceId('no-trace');
            expect(record).not.toBeNull();
            expect(record.logCount).toBe(1);
        });

        test('按级别过滤日志', () => {
            const store = new LogStore(10, 10);
            const ts = new Date().toISOString();
            store.append('tr-1', { timestamp: ts, level: 'info', module: 'm', message: 'a', context: {} });
            store.append('tr-1', { timestamp: ts, level: 'error', module: 'm', message: 'b', context: {} });
            store.append('tr-1', { timestamp: ts, level: 'error', module: 'm', message: 'c', context: {} });
            const record = store.getByTraceId('tr-1', { level: 'error' });
            expect(record.logs.length).toBe(2);
            expect(record.logs.every(l => l.level === 'error')).toBe(true);
        });

        test('不存在 traceId 返回 null', () => {
            const store = new LogStore(10, 10);
            expect(store.getByTraceId('not-exist')).toBeNull();
        });
    });

    describe('listRecentTraces', () => {
        test('按 updatedAt 降序返回', () => {
            const store = new LogStore(10, 10);
            const ts = new Date().toISOString();
            store.append('tr-1', { timestamp: ts, level: 'info', module: 'm', message: 'a', context: {} });
            store.append('tr-2', { timestamp: ts, level: 'info', module: 'm', message: 'b', context: {} });
            store.append('tr-1', { timestamp: ts, level: 'info', module: 'm', message: 'c', context: {} });
            const list = store.listRecentTraces();
            expect(list[0].traceId).toBe('tr-1');
            expect(list[1].traceId).toBe('tr-2');
        });

        test('hasError 标记正确', () => {
            const store = new LogStore(10, 10);
            const ts = new Date().toISOString();
            store.append('tr-err', { timestamp: ts, level: 'error', module: 'm', message: 'a', context: {} });
            store.append('tr-ok', { timestamp: ts, level: 'info', module: 'm', message: 'b', context: {} });
            const list = store.listRecentTraces();
            const errItem = list.find(t => t.traceId === 'tr-err');
            const okItem = list.find(t => t.traceId === 'tr-ok');
            expect(errItem.hasError).toBe(true);
            expect(okItem.hasError).toBe(false);
        });

        test('按 level 过滤时跳过无该级别日志的 traceId', () => {
            const store = new LogStore(10, 10);
            const ts = new Date().toISOString();
            store.append('tr-1', { timestamp: ts, level: 'info', module: 'm', message: 'a', context: {} });
            store.append('tr-2', { timestamp: ts, level: 'error', module: 'm', message: 'b', context: {} });
            const list = store.listRecentTraces({ level: 'error' });
            expect(list.length).toBe(1);
            expect(list[0].traceId).toBe('tr-2');
        });

        test('limit 生效', () => {
            const store = new LogStore(100, 10);
            const ts = new Date().toISOString();
            for (let i = 0; i < 10; i++) {
                store.append(`tr-${i}`, { timestamp: ts, level: 'info', module: 'm', message: 'a', context: {} });
            }
            const list = store.listRecentTraces({ limit: 5 });
            expect(list.length).toBe(5);
        });
    });

    describe('容量上限', () => {
        test('超出 maxTraces 时淘汰最旧 trace', () => {
            const store = new LogStore(2, 10);
            const ts = new Date().toISOString();
            store.append('tr-1', { timestamp: ts, level: 'info', module: 'm', message: 'a', context: {} });
            store.append('tr-2', { timestamp: ts, level: 'info', module: 'm', message: 'b', context: {} });
            store.append('tr-3', { timestamp: ts, level: 'info', module: 'm', message: 'c', context: {} });
            expect(store.getByTraceId('tr-1')).toBeNull();
            expect(store.getByTraceId('tr-2')).not.toBeNull();
            expect(store.getByTraceId('tr-3')).not.toBeNull();
            expect(store.getStats().totalTraces).toBe(2);
        });

        test('超出单 trace maxLogs 时淘汰最旧日志', () => {
            const store = new LogStore(10, 2);
            const ts = new Date().toISOString();
            store.append('tr-1', { timestamp: ts, level: 'info', module: 'm', message: 'a', context: {} });
            store.append('tr-1', { timestamp: ts, level: 'info', module: 'm', message: 'b', context: {} });
            store.append('tr-1', { timestamp: ts, level: 'error', module: 'm', message: 'c', context: {} });
            const record = store.getByTraceId('tr-1');
            expect(record.logs.length).toBe(2);
            // a 被淘汰，剩下 b, c
            expect(record.logs[0].message).toBe('b');
            expect(record.logs[1].message).toBe('c');
            expect(record.levelCounts.info).toBe(1);
            expect(record.levelCounts.error).toBe(1);
        });
    });

    describe('clear', () => {
        test('清空所有数据', () => {
            const store = new LogStore(10, 10);
            store.append('tr-1', { timestamp: new Date().toISOString(), level: 'info', module: 'm', message: 'a', context: {} });
            store.clear();
            expect(store.getStats().totalTraces).toBe(0);
            expect(store.getByTraceId('tr-1')).toBeNull();
        });
    });

    describe('getStats', () => {
        test('返回容量信息', () => {
            const store = new LogStore(5, 10);
            const stats = store.getStats();
            expect(stats.maxTraces).toBe(5);
            expect(stats.maxLogsPerTrace).toBe(10);
            expect(stats.totalTraces).toBe(0);
        });
    });
});
