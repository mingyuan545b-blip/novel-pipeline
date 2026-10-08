/**
 * audit-character-names 单元测试 — 命名体检纯函数
 */
const { auditNames } = require('../../scripts/audit-character-names');

describe('auditNames', () => {
    test('命中禁用名与流水线名', () => {
        const r = auditNames([
            { name: '萧炎', projectId: 'p1', eraKey: 'xianxia' },
            { name: '骆时秋', projectId: 'p1', eraKey: 'wuxia' },
        ]);
        expect(r.total).toBe(2);
        expect(r.invalid.map(x => x.name)).toEqual(['萧炎']);
    });
    test('跨项目重名被标记', () => {
        const r = auditNames([
            { name: '沈砚', projectId: 'p1' },
            { name: '沈砚', projectId: 'p2' },
        ]);
        expect(r.duplicated.map(x => x.name)).toEqual(['沈砚']);
    });
    test('同项目重字率高被标记（扎堆姓）', () => {
        const r = auditNames(['林一山', '林二河', '林三江', '林四湖'].map(n => ({ name: n, projectId: 'p1' })));
        expect(r.crowded[0]).toMatchObject({ surname: '林', count: 4 });
    });
});
