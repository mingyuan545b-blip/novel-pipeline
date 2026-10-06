const status = require('../../server/services/chapterStatus');
const machine = require('../../server/services/chapterStateMachine');
const gate = require('../../scripts/audit-vocabulary-consistency');

describe('S1 章节状态单一源 + 词汇表闸门', () => {
    const REVIEWED = ['first-reviewed', 'second-reviewed'];

    test('reviewed 态进入 ALL_STATUSES（P0-A：不再是幽灵态）', () => {
        for (const s of REVIEWED) expect(status.ALL_STATUSES).toContain(s);
    });

    test('reviewed 态有 STATUS_VALUES 常量', () => {
        expect(status.STATUS_VALUES.FIRST_REVIEWED).toBe('first-reviewed');
        expect(status.STATUS_VALUES.SECOND_REVIEWED).toBe('second-reviewed');
    });

    test('reviewed 属于 IN_PROGRESS 且是 STUCK（可被调度器重置，不再永久砖）', () => {
        for (const s of REVIEWED) {
            expect(status.getStatusCategory(s)).toBe('IN_PROGRESS');
            expect(status.STUCK_STATUSES).toContain(s);
            expect(status.STUCK_STATUSES).not.toContain('approved');
        }
    });

    test('isReviewedStatus 判定正确', () => {
        expect(status.isReviewedStatus('first-reviewed')).toBe(true);
        expect(status.isReviewedStatus('second-reviewed')).toBe(true);
        expect(status.isReviewedStatus('first-reviewing')).toBe(false);
    });

    test('每个状态都有展示标签（生成器依赖）', () => {
        for (const s of status.ALL_STATUSES) expect(status.STATUS_LABELS[s]).toBeTruthy();
    });

    test('迁移表引用全部合法且覆盖 reviewed 推进', () => {
        expect(status.validateStatusConsistency()).toBe(true);
        expect(machine.isValidTransition('first-reviewing', 'first-reviewed')).toBe(true);
        expect(machine.isValidTransition('first-reviewed', 'second-reviewing')).toBe(true);
        expect(machine.isValidTransition('second-reviewing', 'second-reviewed')).toBe(true);
        expect(machine.isValidTransition('second-reviewed', 'final-editing')).toBe(true);
    });

    describe('闸门 4：statusMap 值必须 ⊆ ALL_STATUSES', () => {
        test('能抓出幽灵状态（回归防护）', () => {
            const vals = gate.extractStatusMapValues("const statusMap = { 'first-review': 'first-reviewed', 'x': 'ghost-status' };");
            expect(vals).toContain('first-reviewed');
            expect(vals).toContain('ghost-status');
            expect(vals).not.toContain('first-review');
        });

        test('生产代码 statusMap 抽取出的值全部合法', () => {
            const v = gate.checkStatusMap().concat(gate.checkChapterStatusAssignments(), gate.checkStateMachineRefs(), gate.checkClientStatusMaps());
            expect(v).toEqual([]);
        });

        test('前端生成常量与后端单一源一致', () => {
            expect(gate.checkClientConstantsSync()).toEqual([]);
        });
    });
});
