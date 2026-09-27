/**
 * 运行时守卫单测（2026-09-21 新增能力）
 *  - 场景字数中途检查点（长度锚点）
 *  - 任务看门狗终止态判定（修"timeout 状态没人认"）
 *  - LLM 超时/慢请求计数
 */
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

describe('长度锚点：场景中途检查点', () => {
    const { buildLengthInstruction, resolveSceneFloors } = require('../../server/services/pipeline/steps/writer/sceneFloorInstruction');
    const WC = { targetMin: 2500, targetMax: 3000, rejectMin: 2500 };

    it('场景下限由 wordConfig 派生且合计≥硬性最低', () => {
        const floors = resolveSceneFloors(WC);
        expect(floors.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(WC.rejectMin);
    });

    it('给出累计字数检查点，而不只是最终总字数', () => {
        const text = buildLengthInstruction(WC);
        expect(text).toContain('中途检查点');
        expect(text).toContain('场景2(核心)结束时累计≥');
    });

    it('显式禁止"先写简版、结尾再补"', () => {
        expect(buildLengthInstruction(WC)).toContain('禁止"先写简版、结尾再补"');
    });
});

describe('任务看门狗：终止态判定', () => {
    const tm = require('../../server/routes/pipeline/asyncTaskManager');

    it('timeout 属于终止态（修复前没有任何消费方识别它 → 前端永远轮询）', () => {
        expect(tm.isTerminal('timeout')).toBe(true);
        expect(tm.isTerminal('failed')).toBe(true);
        expect(tm.isTerminal('completed')).toBe(true);
        expect(tm.isTerminal('running')).toBe(false);
    });

    it('terminalReason 对成功态返回 null，对超时返回可读原因', () => {
        expect(tm.terminalReason({ status: 'completed' })).toBeNull();
        expect(tm.terminalReason({ status: 'timeout' })).toContain('超时');
        expect(tm.terminalReason({ status: 'running' })).toBeNull();
    });

    it('已超时任务不会被后续回调改回 running（防"复活"）', () => {
        const id = tm.createTask('t');
        tm.updateTask(id, { status: 'timeout', error: 'x' });
        tm.updateTask(id, { status: 'running' });
        expect(tm.getTask(id).status).toBe('timeout');
    });

    it('snapshot 反映运行中任务数', () => {
        const before = tm.snapshot().running;
        const id = tm.createTask('t');
        expect(tm.snapshot().running).toBe(before + 1);
        tm.updateTask(id, { status: 'completed' });
        expect(tm.snapshot().running).toBe(before);
    });
});

describe('LLM 超时计数', () => {
    const tracker = require('../../server/services/llmTimeoutTracker');

    beforeEach(() => tracker.reset());

    it('累计超时并记录最近一次', () => {
        tracker.record('aliyunCoding', 'qwen3.8-flash', 600000, 600000);
        const s = tracker.snapshot();
        expect(s.timeouts).toBe(1);
        expect(s.lastTimeout.provider).toBe('aliyunCoding');
        expect(s.degraded).toBe(false);
    });

    it('连续 3 次超时判定为供应商降级', () => {
        for (let i = 0; i < 3; i++) tracker.record('aliyunCoding', 'm', 600000, 600000);
        expect(tracker.snapshot().degraded).toBe(true);
    });

    it('成功一次后连续计数归零', () => {
        tracker.record('p', 'm', 1, 1);
        tracker.recordSuccess();
        expect(tracker.snapshot().consecutiveTimeouts).toBe(0);
    });

    it('慢请求单独计数', () => {
        tracker.recordSlow('p', 'm', 200000);
        const s = tracker.snapshot();
        expect(s.slowRequests).toBe(1);
        expect(s.timeouts).toBe(0);
    });
});
