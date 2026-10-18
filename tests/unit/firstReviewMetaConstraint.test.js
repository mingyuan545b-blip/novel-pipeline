/**
 * T0 元约束接入 pipeline 初审硬阻断（A3）
 * F1：T0 元约束 M1–M5 此前只在 UI 手动审计路由里跑，pipeline 初审完全不含 → sop/08 承诺的
 * "hardBlock 自动阻断 pipeline"从未生效。见 docs/worklog/2026-10-17-假成果审查-问题统计.md
 */
jest.mock('../../server/services/prompts/constraintDetectionRegistry', () => ({
    runAllMetaConstraintDetections: jest.fn(async () => ({
        M4: { violated: true, block: true, actual: 5, threshold: 2, violations: [{ reason: '抽象抒情模式命中5次' }] },
        M1: { violated: false, block: true, actual: 0, threshold: 1, violations: [] },
        M0: { violated: true, block: false, actual: 9, threshold: 1, violations: [{ reason: '仅提示不阻断' }] },
    })),
}));

const { collectMetaConstraintIssues } = require('../../server/services/pipeline/steps/review/firstReviewChecks');
const { runAllMetaConstraintDetections } = require('../../server/services/prompts/constraintDetectionRegistry');

function makeCtx() {
    return {
        getChapters: async () => [
            { chapterNumber: 1, content: 'x'.repeat(100), status: 'material-updated' },
        ],
        getCharacterMaterials: async () => [
            { name: '林晚', tags: ['主角'], archived: false },
            { name: '王二', tags: [], archived: false },
        ],
    };
}

describe('collectMetaConstraintIssues（F1 修复）', () => {
    beforeEach(() => runAllMetaConstraintDetections.mockClear());

    test('违规且 block!==false 的元约束 → 产出 critical 硬阻断条目', async () => {
        const issues = await collectMetaConstraintIssues('正文', { chapterNumber: 2 }, makeCtx());
        expect(issues).toHaveLength(1);
        expect(issues[0].severity).toBe('critical');
        expect(issues[0].title).toBe('T0元约束M4违规');
        expect(issues[0].description).toContain('抽象抒情模式命中5次');
    });

    test('传参：含上一章内容与配角名单（主角已剔除）', async () => {
        await collectMetaConstraintIssues('正文', { chapterNumber: 2 }, makeCtx());
        const arg = runAllMetaConstraintDetections.mock.calls[0][0];
        expect(arg.chapterNumber).toBe(2);
        expect(arg.prevChapterContent).toBe('x'.repeat(100));
        expect(arg.recentChapterContents).toEqual(['x'.repeat(100)]);
        expect(arg.sideCharacterNames).toEqual(['王二']);
    });

    test('检测器抛错时不冒泡（fail-safe 返回空/部分）', async () => {
        runAllMetaConstraintDetections.mockRejectedValueOnce(new Error('detector boom'));
        const issues = await collectMetaConstraintIssues('正文', { chapterNumber: 2 }, makeCtx());
        expect(issues).toEqual([]);
    });

    test('block===false 的违规不进入硬阻断', async () => {
        const issues = await collectMetaConstraintIssues('正文', { chapterNumber: 2 }, makeCtx());
        expect(issues.find(i => i.title.includes('M0'))).toBeUndefined();
    });
});
