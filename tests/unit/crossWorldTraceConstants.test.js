/**
 * crossWorldTraceConstants 单元测试 — 类型/动作扩展 + 渠道/媒介字段
 */
const {
    TRACE_ACTIONS, TRACE_ENTITY_TYPES, buildTrace, validateTrace, appendTraceEvent
} = require('../../server/services/crossWorldTraceConstants');

describe('TRACE_ACTIONS / TRACE_ENTITY_TYPES 扩展', () => {
    test('新增 carried-out 动作', () => {
        expect(TRACE_ACTIONS['carried-out']).toBeDefined();
        expect(TRACE_ACTIONS['carried-out'].label).toBe('带出');
    });
    test('可溯源类型含角色/宠物/仆从/消耗品', () => {
        for (const t of ['character', 'pet', 'servant', 'consumable']) {
            expect(TRACE_ENTITY_TYPES[t]).toBeDefined();
        }
    });
});

describe('appendTraceEvent 渠道/媒介', () => {
    test('事件写入 channel/medium，并同步 currentWorldId', () => {
        const trace = buildTrace({ projectId: 'p1', entityId: 'e1', entityName: '养魂木' });
        appendTraceEvent(trace, {
            chapter: 5, fromWorld: 'dungeon-1', toWorld: 'main-world',
            action: 'carried-out', channel: '白骨道·媒介:养魂木', medium: '养魂木'
        });
        const ev = trace.traceLog[trace.traceLog.length - 1];
        expect(ev.action).toBe('carried-out');
        expect(ev.channel).toBe('白骨道·媒介:养魂木');
        expect(ev.medium).toBe('养魂木');
        expect(trace.currentWorldId).toBe('main-world');
    });
    test('非法 action 抛错', () => {
        const trace = buildTrace({ projectId: 'p1', entityId: 'e1', entityName: 'x' });
        expect(() => appendTraceEvent(trace, { action: 'nope' })).toThrow();
    });
    test('pet 类型通过校验', () => {
        const trace = buildTrace({ projectId: 'p1', entityId: 'e1', entityName: '小白', entityType: 'pet' });
        expect(validateTrace(trace)).toEqual([]);
    });
});
