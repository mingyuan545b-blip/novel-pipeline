/**
 * S6：单点装配入口审计（P1-A）——按 agent 名单逐一断言，杜绝"假阳性 ✅"
 */
const { scan } = require('../../scripts/verifyMaterialAssemblyEntry');

describe('S6 装配入口审计', () => {
    test('消费者 agent 全部走 materialStateAssembler，无绕过', () => {
        expect(scan().violations).toEqual([]);
    });

    test('消费者名单 = 声明需求者 − 生产者 − 声明未用', () => {
        const consumers = scan().consumerAgents.slice().sort();
        expect(consumers).toEqual([
            'fast-review', 'final-editor', 'first-review', 'polisher',
            'reader', 'reviser', 'second-review', 'writer'
        ]);
        // 生产者（写素材）与声明未用者不得被误判为"必须走装配入口"
        expect(consumers).not.toContain('material-manager');
        expect(consumers).not.toContain('intent-planner');
    });
});
