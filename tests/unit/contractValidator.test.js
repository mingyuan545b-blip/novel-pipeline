/**
 * contractValidator.test.js
 * 节点级契约校验器单元测试（YAML驱动）
 * 覆盖陷阱#79场景：素材注入链路断链检测
 */
jest.mock('../../server/services/stateKVIndex', () => ({
    hasChapterState: jest.fn()
}));
jest.mock('../../server/services/entityCenter', () => ({
    getEntitiesForProject: jest.fn()
}));

const contractValidator = require('../../server/services/pipeline/contractValidator');
const stateKVIndex = require('../../server/services/stateKVIndex');
const entityCenter = require('../../server/services/entityCenter');

describe('contractValidator (YAML驱动节点级契约校验)', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('契约加载', () => {
        test('writer契约可加载', () => {
            const c = contractValidator.loadContract('writer');
            expect(c).toBeTruthy();
            expect(c.agent).toBe('writer');
            expect(c.input.required).toBeInstanceOf(Array);
            expect(c.output.required).toBeInstanceOf(Array);
        });
        test('first-review契约可加载', () => {
            const c = contractValidator.loadContract('first-review');
            expect(c).toBeTruthy();
            expect(c.agent).toBe('first-review');
        });
        test('material-manager契约可加载', () => {
            const c = contractValidator.loadContract('material-manager');
            expect(c).toBeTruthy();
            expect(c.agent).toBe('material-manager');
            expect(c.postMaterial).toBeTruthy();
        });
        test('未定义契约返回null', () => {
            expect(contractValidator.loadContract('non-existent-agent')).toBeNull();
        });
        test('getContractSummary返回10个agent（阶段1+2+3）', () => {
            const s = contractValidator.getContractSummary();
            expect(Object.keys(s).sort()).toEqual([
                'consistency-constraint', 'fast-review', 'final-editor',
                'first-review', 'material-manager', 'outline-generator',
                'polisher', 'reviser', 'second-review', 'writer'
            ]);
        });
    });

    describe('validateInput - writer', () => {
        const baseCtx = () => ({
            chapter: { outline: '一个完整的长大纲内容，至少十个字符' },
            materials: [],
            project: { id: 'p1', title: 't' }
        });

        test('CH1 + materials空 → 通过（首章例外）', () => {
            const r = contractValidator.validateInput('writer', baseCtx(), 1);
            expect(r.passed).toBe(true);
            expect(r.errors).toHaveLength(0);
        });

        test('outline缺失 → CRITICAL失败 (WR-IN-001)', () => {
            const ctx = baseCtx();
            ctx.chapter.outline = null;
            const r = contractValidator.validateInput('writer', ctx, 1);
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('WR-IN-001');
            expect(r.errors[0].severity).toBe('CRITICAL');
        });

        test('project缺失 → CRITICAL失败 (WR-IN-003)', () => {
            const ctx = baseCtx();
            ctx.project = null;
            const r = contractValidator.validateInput('writer', ctx, 1);
            expect(r.passed).toBe(false);
            expect(r.errors.some(e => e.errorCode === 'WR-IN-003')).toBe(true);
        });

        test('CH2 + 角色stateJson无深度字段 → CRITICAL失败 (WR-IN-004 / 陷阱#79)', () => {
            const ctx = baseCtx();
            ctx.materials = [{
                type: 'character', archived: false,
                stateJson: { name: '主角', hp: 100 }  // 无任何深度字段
            }];
            const r = contractValidator.validateInput('writer', ctx, 2);
            expect(r.passed).toBe(false);
            const e = r.errors.find(x => x.errorCode === 'WR-IN-004');
            expect(e).toBeDefined();
            expect(e.severity).toBe('CRITICAL');
            expect(e.message).toMatch(/陷阱#79/);
        });

        test('CH2 + 角色stateJson含innerConflict → 通过', () => {
            const ctx = baseCtx();
            ctx.materials = [{
                type: 'character', archived: false,
                stateJson: { name: '主角', innerConflict: '自由 vs 责任' }
            }];
            const r = contractValidator.validateInput('writer', ctx, 2);
            expect(r.passed).toBe(true);
        });

        test('CH2 + 角色stateJson含fateArc → 通过（anyOf任一即可）', () => {
            const ctx = baseCtx();
            ctx.materials = [{
                type: 'character', archived: false,
                stateJson: { fateArc: '从怯懦到担当' }
            }];
            const r = contractValidator.validateInput('writer', ctx, 2);
            expect(r.passed).toBe(true);
        });

        test('CH2 + 仅archived角色 → CRITICAL (WR-IN-005)', () => {
            // archived角色不计入requireMinCount，CH2+必须有未归档角色
            const ctx = baseCtx();
            ctx.materials = [{
                type: 'character', archived: true,
                stateJson: { name: '已退场角色' }
            }];
            const r = contractValidator.validateInput('writer', ctx, 2);
            expect(r.passed).toBe(false);
            expect(r.errors.some(e => e.errorCode === 'WR-IN-005')).toBe(true);
        });

        test('CH2 + archived角色不参与stateJson深度校验', () => {
            // 1个archived无深度 + 1个未archived有深度 → 通过
            const ctx = baseCtx();
            ctx.materials = [
                { type: 'character', archived: true, stateJson: { name: '已退场' } },
                { type: 'character', archived: false, stateJson: { innerConflict: '冲突' } }
            ];
            const r = contractValidator.validateInput('writer', ctx, 2);
            expect(r.passed).toBe(true);
        });

        test('CH2 + materials空 → CRITICAL (WR-IN-005 / 陷阱#79变体防护)', () => {
            // 修复Bug-B：CH2+无未归档角色素材=素材注入链路断链
            // 之前charMats.length===0时跳过校验，现在requireMinCount规则强制CRITICAL
            const r = contractValidator.validateInput('writer', baseCtx(), 2);
            expect(r.passed).toBe(false);
            const e = r.errors.find(x => x.errorCode === 'WR-IN-005');
            expect(e).toBeDefined();
            expect(e.severity).toBe('CRITICAL');
        });
    });

    describe('validateInput - first-review', () => {
        const baseCtx = () => ({
            chapter: { content: '正文内容，足够长的章节正文，超过一百字以上'.repeat(5) },
            materials: [{
                type: 'character', archived: false,
                stateJson: { innerConflict: '冲突' }
            }],
            project: { id: 'p1' }
        });

        test('CH1 + 正常输入 → 通过（首章例外+content足够）', () => {
            const r = contractValidator.validateInput('first-review', baseCtx(), 1);
            expect(r.passed).toBe(true);
        });

        test('chapter.content缺失 → CRITICAL (FR-IN-001)', () => {
            const ctx = baseCtx();
            ctx.chapter.content = null;
            const r = contractValidator.validateInput('first-review', ctx, 1);
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('FR-IN-001');
        });

        test('CH2 + 缺深度字段 → CRITICAL (FR-IN-003)', () => {
            const ctx = baseCtx();
            ctx.materials[0].stateJson = { name: '主角' };
            const r = contractValidator.validateInput('first-review', ctx, 2);
            expect(r.passed).toBe(false);
            expect(r.errors.some(e => e.errorCode === 'FR-IN-003')).toBe(true);
        });

        test('project缺失 → WARN (FR-IN-002, HIGH级)', () => {
            const ctx = baseCtx();
            ctx.project = null;
            const r = contractValidator.validateInput('first-review', ctx, 1);
            // HIGH级别会被归到warnings
            expect(r.warnings.some(w => w.errorCode === 'FR-IN-002')).toBe(true);
        });
    });

    describe('validateInput - material-manager', () => {
        test('正常输入 → 通过', () => {
            const ctx = {
                chapter: { chapterNumber: 1 },
                materials: []
            };
            const r = contractValidator.validateInput('material-manager', ctx, 1);
            expect(r.passed).toBe(true);
        });

        test('chapter缺失 → CRITICAL (MM-IN-001)', () => {
            const r = contractValidator.validateInput('material-manager', { materials: [] }, 1);
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('MM-IN-001');
        });
    });

    describe('validateOutput - writer', () => {
        test('正常输出response → 通过', () => {
            const r = contractValidator.validateOutput('writer', {
                response: 'x'.repeat(200)
            });
            expect(r.passed).toBe(true);
        });

        test('response缺失 → CRITICAL (WR-OUT-001)', () => {
            const r = contractValidator.validateOutput('writer', {});
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('WR-OUT-001');
        });

        test('response长度不足 → CRITICAL', () => {
            const r = contractValidator.validateOutput('writer', { response: '短' });
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('WR-OUT-001');
        });
    });

    describe('validateOutput - first-review', () => {
        test('正常输出response → 通过', () => {
            const r = contractValidator.validateOutput('first-review', { response: '审核通过，章节内容符合要求' });
            expect(r.passed).toBe(true);
        });

        test('response缺失 → CRITICAL (FR-OUT-001)', () => {
            const r = contractValidator.validateOutput('first-review', {});
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('FR-OUT-001');
        });
    });

    describe('validateOutput - material-manager', () => {
        test('正常输出response → 通过', () => {
            const r = contractValidator.validateOutput('material-manager', { response: '素材管理完成，已更新角色状态' });
            expect(r.passed).toBe(true);
        });

        test('response缺失 → CRITICAL (MM-OUT-001)', () => {
            const r = contractValidator.validateOutput('material-manager', {});
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('MM-OUT-001');
        });
    });

    describe('validatePostMaterial - material-manager (陷阱#79落库校验)', () => {
        test('stateKV有记录 + entityCenter有角色 → 通过', async () => {
            stateKVIndex.hasChapterState.mockResolvedValue(true);
            entityCenter.getEntitiesForProject.mockResolvedValue([{ id: 'c1' }]);
            const r = await contractValidator.validatePostMaterial('p1', 2);
            expect(r.passed).toBe(true);
        });

        test('stateKV无记录 → CRITICAL (MM-POST-001 / 陷阱#79)', async () => {
            stateKVIndex.hasChapterState.mockResolvedValue(false);
            entityCenter.getEntitiesForProject.mockResolvedValue([{ id: 'c1' }]);
            const r = await contractValidator.validatePostMaterial('p1', 2);
            expect(r.passed).toBe(false);
            const e = r.errors.find(x => x.errorCode === 'MM-POST-001');
            expect(e).toBeDefined();
            expect(e.severity).toBe('CRITICAL');
            expect(e.message).toMatch(/陷阱#79/);
        });

        test('entityCenter无角色 → CRITICAL (MM-POST-002)', async () => {
            stateKVIndex.hasChapterState.mockResolvedValue(true);
            entityCenter.getEntitiesForProject.mockResolvedValue([]);
            const r = await contractValidator.validatePostMaterial('p1', 2);
            expect(r.passed).toBe(false);
            expect(r.errors.some(e => e.errorCode === 'MM-POST-002')).toBe(true);
        });

        test('stateKV查询异常 → WARN不阻断', async () => {
            stateKVIndex.hasChapterState.mockRejectedValue(new Error('db down'));
            entityCenter.getEntitiesForProject.mockResolvedValue([{ id: 'c1' }]);
            const r = await contractValidator.validatePostMaterial('p1', 2);
            // 异常转WARN，passed=true（不影响阻断）
            expect(r.passed).toBe(true);
            expect(r.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('未覆盖agent', () => {
        test('未定义契约的agent → 一律通过', () => {
            expect(contractValidator.validateInput('non-existent', {}, 1).passed).toBe(true);
            expect(contractValidator.validateOutput('non-existent', {}).passed).toBe(true);
        });
    });

    // ════════════════════════════════════════
    // 阶段2：6个新agent契约测试
    // ════════════════════════════════════════

    describe('阶段2 - reviser契约', () => {
        test('契约加载', () => {
            const c = contractValidator.loadContract('reviser');
            expect(c).toBeTruthy();
            expect(c.agent).toBe('reviser');
            expect(c.format).toBe('brief');
        });

        test('CH1 + 正常输入 → 通过', () => {
            const ctx = {
                chapter: { content: '正文'.repeat(60) },
                project: { id: 'p1' }
            };
            const r = contractValidator.validateInput('reviser', ctx, 1);
            expect(r.passed).toBe(true);
        });

        test('content缺失 → CRITICAL (RV-IN-001)', () => {
            const r = contractValidator.validateInput('reviser', { chapter: {}, project: {} }, 1);
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('RV-IN-001');
        });

        test('CH2 + 无深度字段 → CRITICAL (RV-IN-003)', () => {
            const ctx = {
                chapter: { content: '正文'.repeat(60) },
                materials: [{ type: 'character', archived: false, stateJson: { name: '主角' } }],
                project: { id: 'p1' }
            };
            const r = contractValidator.validateInput('reviser', ctx, 2);
            expect(r.passed).toBe(false);
            expect(r.errors.some(e => e.errorCode === 'RV-IN-003')).toBe(true);
        });

        test('输出response缺失 → CRITICAL (RV-OUT-001)', () => {
            const r = contractValidator.validateOutput('reviser', {});
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('RV-OUT-001');
        });

        test('输出response正常 → 通过', () => {
            const r = contractValidator.validateOutput('reviser', { response: 'x'.repeat(150) });
            expect(r.passed).toBe(true);
        });
    });

    describe('阶段2 - fast-review契约', () => {
        test('契约加载', () => {
            expect(contractValidator.loadContract('fast-review').agent).toBe('fast-review');
        });

        test('CH1 + 正常输入 → 通过', () => {
            const ctx = { chapter: { content: '正文'.repeat(60) }, project: { id: 'p1' } };
            expect(contractValidator.validateInput('fast-review', ctx, 1).passed).toBe(true);
        });

        test('CH2 + 无深度字段 → CRITICAL (FA-IN-003)', () => {
            const ctx = {
                chapter: { content: '正文'.repeat(60) },
                materials: [{ type: 'character', archived: false, stateJson: {} }],
                project: { id: 'p1' }
            };
            const r = contractValidator.validateInput('fast-review', ctx, 2);
            expect(r.passed).toBe(false);
            expect(r.errors.some(e => e.errorCode === 'FA-IN-003')).toBe(true);
        });

        test('输出passed缺失 → CRITICAL (FA-OUT-001)', () => {
            const r = contractValidator.validateOutput('fast-review', { issues: [] });
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('FA-OUT-001');
        });
    });

    describe('阶段2 - second-review契约', () => {
        test('契约加载', () => {
            expect(contractValidator.loadContract('second-review').agent).toBe('second-review');
        });

        test('CH1 + 正常输入（含firstReviewOutput） → 通过', () => {
            const ctx = {
                chapter: { content: '正文'.repeat(60), firstReviewOutput: '一审反馈内容' },
                project: { id: 'p1' }
            };
            expect(contractValidator.validateInput('second-review', ctx, 1).passed).toBe(true);
        });

        test('firstReviewOutput缺失 → HIGH (SR-IN-002)', () => {
            const ctx = { chapter: { content: '正文'.repeat(60) }, project: { id: 'p1' } };
            const r = contractValidator.validateInput('second-review', ctx, 1);
            expect(r.warnings.some(w => w.errorCode === 'SR-IN-002')).toBe(true);
        });

        test('CH2 + 无深度字段 → CRITICAL (SR-IN-004)', () => {
            const ctx = {
                chapter: { content: '正文'.repeat(60), firstReviewOutput: '一审反馈' },
                materials: [{ type: 'character', archived: false, stateJson: {} }],
                project: { id: 'p1' }
            };
            const r = contractValidator.validateInput('second-review', ctx, 2);
            expect(r.passed).toBe(false);
            expect(r.errors.some(e => e.errorCode === 'SR-IN-004')).toBe(true);
        });

        test('输出response正常 → 通过', () => {
            const r = contractValidator.validateOutput('second-review', { response: '二审通过，章节质量达标' });
            expect(r.passed).toBe(true);
        });
    });

    describe('阶段2 - final-editor契约', () => {
        test('契约加载', () => {
            expect(contractValidator.loadContract('final-editor').agent).toBe('final-editor');
        });

        test('CH1 + 正常输入 → 通过', () => {
            const ctx = {
                chapter: { content: '正文'.repeat(60), firstReviewOutput: '一审反馈' },
                project: { id: 'p1' }
            };
            expect(contractValidator.validateInput('final-editor', ctx, 1).passed).toBe(true);
        });

        test('CH2 + 无深度字段 → CRITICAL (FE-IN-004)', () => {
            const ctx = {
                chapter: { content: '正文'.repeat(60), firstReviewOutput: '一审反馈' },
                materials: [{ type: 'character', archived: false, stateJson: {} }],
                project: { id: 'p1' }
            };
            const r = contractValidator.validateInput('final-editor', ctx, 2);
            expect(r.passed).toBe(false);
            expect(r.errors.some(e => e.errorCode === 'FE-IN-004')).toBe(true);
        });

        test('输出response缺失 → CRITICAL (FE-OUT-001)', () => {
            const r = contractValidator.validateOutput('final-editor', {});
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('FE-OUT-001');
        });
    });

    describe('阶段2 - polisher契约', () => {
        test('契约加载', () => {
            expect(contractValidator.loadContract('polisher').agent).toBe('polisher');
        });

        test('CH1 + 正常输入 → 通过', () => {
            const ctx = { chapter: { content: '正文'.repeat(60) }, project: { id: 'p1' } };
            expect(contractValidator.validateInput('polisher', ctx, 1).passed).toBe(true);
        });

        test('CH2 + 无深度字段 → CRITICAL (PO-IN-003)', () => {
            const ctx = {
                chapter: { content: '正文'.repeat(60) },
                materials: [{ type: 'character', archived: false, stateJson: {} }],
                project: { id: 'p1' }
            };
            const r = contractValidator.validateInput('polisher', ctx, 2);
            expect(r.passed).toBe(false);
            expect(r.errors.some(e => e.errorCode === 'PO-IN-003')).toBe(true);
        });

        test('输出response正常 → 通过', () => {
            const r = contractValidator.validateOutput('polisher', { response: 'x'.repeat(150) });
            expect(r.passed).toBe(true);
        });

        test('输出response长度不足 → CRITICAL (PO-OUT-001)', () => {
            const r = contractValidator.validateOutput('polisher', { response: '短' });
            expect(r.passed).toBe(false);
        });
    });

    describe('阶段2 - consistency-constraint契约', () => {
        test('契约加载', () => {
            expect(contractValidator.loadContract('consistency-constraint').agent).toBe('consistency-constraint');
        });

        test('正常输入 → 通过', () => {
            const ctx = {
                chapter: { content: '正文'.repeat(60) },
                project: { id: 'p1' }
            };
            expect(contractValidator.validateInput('consistency-constraint', ctx, 1).passed).toBe(true);
        });

        test('project缺失 → CRITICAL (CC-IN-002)', () => {
            const ctx = { chapter: { content: '正文'.repeat(60) } };
            const r = contractValidator.validateInput('consistency-constraint', ctx, 1);
            expect(r.passed).toBe(false);
            expect(r.errors.some(e => e.errorCode === 'CC-IN-002')).toBe(true);
        });

        test('输出constraints缺失 → CRITICAL (CC-OUT-001)', () => {
            const r = contractValidator.validateOutput('consistency-constraint', {});
            expect(r.passed).toBe(false);
            expect(r.errors[0].errorCode).toBe('CC-OUT-001');
        });

        test('输出constraints空数组 → 通过', () => {
            const r = contractValidator.validateOutput('consistency-constraint', { constraints: [] });
            expect(r.passed).toBe(true);
        });

        test('输出constraints有内容 → 通过', () => {
            const r = contractValidator.validateOutput('consistency-constraint', { constraints: [{ issue: '无冲突' }] });
            expect(r.passed).toBe(true);
        });
    });
});
