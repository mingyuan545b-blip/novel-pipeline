/**
 * expansionInstructionBuilder 单测
 * 回归背景：2026-09-06云端E2E，字数退回后含糊扩写指令导致三轮平台期（2157→2170→2170）
 */
const { countWords, needsExpansion, needsSalvageExpansion, needsShortfallSalvage, buildExpansionInstruction, needsExpansionRetry, buildEscalationNote } = require('../../server/services/pipeline/steps/expansionInstructionBuilder');

const WORD_CONFIG = { targetMin: 2500, targetMax: 3000, rejectMin: 2000 };

describe('expansionInstructionBuilder', () => {
    describe('countWords', () => {
        it('去除空白字符统计（与门禁口径一致）', () => {
            expect(countWords('a b\nc\td')).toBe(4);
        });
        it('空/null安全', () => {
            expect(countWords('')).toBe(0);
            expect(countWords(null)).toBe(0);
            expect(countWords(undefined)).toBe(0);
        });
    });

    describe('needsExpansion', () => {
        it('无正文时false（避免对新写章节误注入）', () => {
            expect(needsExpansion(0, WORD_CONFIG)).toBe(false);
        });
        it('达到targetMin即不需要', () => {
            expect(needsExpansion(2500, WORD_CONFIG)).toBe(false);
            expect(needsExpansion(2800, WORD_CONFIG)).toBe(false);
        });
        it('低于targetMin需要扩写', () => {
            expect(needsExpansion(2170, WORD_CONFIG)).toBe(true);
            expect(needsExpansion(1715, WORD_CONFIG)).toBe(true);
        });
    });

    describe('needsSalvageExpansion（抢救区：≥80%下限走reviser扩写而非writer重生成）', () => {
        it('2264/2500=90.6%在抢救区（2026-09-06实测死循环场景）', () => {
            expect(needsSalvageExpansion(2264, WORD_CONFIG)).toBe(true);
        });
        it('恰好80%边界在抢救区', () => {
            expect(needsSalvageExpansion(2000, WORD_CONFIG)).toBe(true);
        });
        it('1715/2500=68.6%不在抢救区（应整章重写）', () => {
            expect(needsSalvageExpansion(1715, WORD_CONFIG)).toBe(false);
        });
        it('达标或无正文不在抢救区', () => {
            expect(needsSalvageExpansion(2500, WORD_CONFIG)).toBe(false);
            expect(needsSalvageExpansion(0, WORD_CONFIG)).toBe(false);
        });
    });

    describe('needsShortfallSalvage（严重不足区：缺口>20%时同样走reviser扩写）', () => {
        // 回归背景：20章E2E ch3 三轮 writer 产出 1615/1615/1607 字（长度先验），
        // 缺口 35% 不在原抢救区 → 无恢复路径 → 整章作废；ch4 2198 字同样卡死。
        it('1615/2500=64.6%应进入严重不足区（原逻辑落空导致整章失败）', () => {
            expect(needsShortfallSalvage(1615, WORD_CONFIG)).toBe(true);
        });
        it('2198字（ch4实测失败值）在严重不足区', () => {
            expect(needsShortfallSalvage(2198, WORD_CONFIG)).toBe(true);
        });
        it('30%下限边界进入严重不足区', () => {
            expect(needsShortfallSalvage(750, WORD_CONFIG)).toBe(true);
        });
        it('低于30%（成稿太少，扩写无基础）仍走writer重生成', () => {
            expect(needsShortfallSalvage(700, WORD_CONFIG)).toBe(false);
            expect(needsShortfallSalvage(0, WORD_CONFIG)).toBe(false);
        });
        it('达标后不再触发', () => {
            expect(needsShortfallSalvage(2500, WORD_CONFIG)).toBe(false);
        });
        it('严重不足区是抢救区的超集', () => {
            [0, 700, 750, 1615, 2000, 2264, 2500].forEach(w => {
                if (needsSalvageExpansion(w, WORD_CONFIG)) expect(needsShortfallSalvage(w, WORD_CONFIG)).toBe(true);
            });
        });
    });

    describe('buildExpansionInstruction轮次标记（打破同prompt死循环）', () => {
        it('attempt>=2时带第N次退回标记与作废警告', () => {
            const text = buildExpansionInstruction(2264, WORD_CONFIG, { attempt: 2 });
            expect(text).toContain('第2次退回');
            expect(text).toContain('整章将作废重生成');
        });
        it('attempt不同则文本不同（防网关同prompt同补全）', () => {
            const a = buildExpansionInstruction(2264, WORD_CONFIG, { attempt: 1 });
            const b = buildExpansionInstruction(2264, WORD_CONFIG, { attempt: 2 });
            expect(a).not.toBe(b);
        });
        it('attempt缺省无轮次标记（向后兼容）', () => {
            const text = buildExpansionInstruction(2264, WORD_CONFIG);
            expect(text).not.toContain('次退回');
            expect(text).toContain('【扩写任务 — 本轮最高优先级】');
        });
    });

    describe('needsExpansionRetry（步内升级重试判定）', () => {
        it('扩写任务下发且输出仍低于下限→重试', () => {
            expect(needsExpansionRetry({ targetMin: 2500, wordCountBefore: 2257 }, 2257)).toBe(true);
        });
        it('输出达标→不重试', () => {
            expect(needsExpansionRetry({ targetMin: 2500, wordCountBefore: 2257 }, 2560)).toBe(false);
        });
        it('无扩写任务→不重试（常规返修不受影响）', () => {
            expect(needsExpansionRetry(null, 1000)).toBe(false);
        });
    });

    describe('buildEscalationNote（步内重试升级指令）', () => {
        it('包含失败事实与数学量', () => {
            const note = buildEscalationNote(2257, 2500);
            expect(note).toContain('上轮扩写未生效');
            expect(note).toContain('仅2257字');
            expect(note).toContain('仍差243字');
            expect(note).toContain('至少多343字'); // 243+max(100,73)=343
            expect(note).toContain('整章作废重生成');
        });
    });

    describe('buildExpansionInstruction', () => {
        it('不需扩写时返回空串', () => {
            expect(buildExpansionInstruction(2600, WORD_CONFIG)).toBe('');
            expect(buildExpansionInstruction(0, WORD_CONFIG)).toBe('');
        });
        it('包含显式数学量：缺口与带30%余量的新增目标', () => {
            const text = buildExpansionInstruction(2170, WORD_CONFIG);
            expect(text).toContain('缺口330字');
            expect(text).toContain('新增至少430字'); // 330 + max(100, 99) = 430
            expect(text).toContain('低于2500字必须继续扩写');
        });
        it('小缺口使用100字最小余量', () => {
            const text = buildExpansionInstruction(2450, WORD_CONFIG);
            expect(text).toContain('缺口50字');
            expect(text).toContain('新增至少150字'); // 50 + max(100, 15) = 150
        });
        it('revise模式（返修员）禁止删减', () => {
            const text = buildExpansionInstruction(2170, WORD_CONFIG, { mode: 'revise' });
            expect(text).toContain('禁止删除或压缩现有正文');
            expect(text).not.toContain('以原稿为基础重写');
        });
        it('rewrite模式（writer重试）保留原稿情节', () => {
            const text = buildExpansionInstruction(1715, WORD_CONFIG, { mode: 'rewrite' });
            expect(text).toContain('以原稿为基础重写完整章节');
            expect(text).toContain('禁止另起炉灶写更短的版本');
        });
        it('包含结构化扩写清单三手法', () => {
            const text = buildExpansionInstruction(2170, WORD_CONFIG);
            expect(text).toContain('对话扩写');
            expect(text).toContain('感官补全');
            expect(text).toContain('情节利用');
        });
        it('默认mode为revise', () => {
            expect(buildExpansionInstruction(2170, WORD_CONFIG)).toContain('禁止删除或压缩现有正文');
        });
    });
});

/**
 * 20章E2E回归：字数硬门槛末轮宽限
 * 背景：ch4 三轮卡在 2198/2500（88%），硬门槛在 first-review 前掐断整轮，
 *       导致已有的"系统覆盖通过"机制无法执行，整章作废。
 */
describe('checkWordCountHardLimit 末轮宽限', () => {
    const { checkWordCountHardLimit, LAST_ROUND_GRACE_RATIO } = require('../../server/services/pipeline/pipelineHelpers/pipelineWordCount');

    beforeEach(() => {
        jest.resetModules();
        jest.doMock('../../server/store', () => ({ getItem: jest.fn(async () => ({ content: 'x'.repeat(2198) })) }));
        jest.doMock('../../server/services/genreConfig', () => ({ resolveGenreFromProject: () => null }));
        jest.doMock('../../server/config', () => ({ resolveConfig: () => ({ word: { rejectMin: 2500, targetMin: 2500, targetMax: 3000 } }) }));
    });
    afterEach(() => jest.dontMock('../../server/store'));

    it('非末轮：2198字仍然硬拦', async () => {
        const { checkWordCountHardLimit: fn } = require('../../server/services/pipeline/pipelineHelpers/pipelineWordCount');
        const r = await fn('first-review', 'ch1', {}, 'novel', { round: 1, startRound: 1, isLastRound: false });
        expect(r.blocked).toBe(true);
    });

    it('末轮：2198字（88%）放行，交给审核链的系统覆盖判定', async () => {
        const { checkWordCountHardLimit: fn } = require('../../server/services/pipeline/pipelineHelpers/pipelineWordCount');
        const r = await fn('first-review', 'ch1', {}, 'novel', { round: 3, startRound: 1, isLastRound: true });
        expect(r.blocked).toBe(false);
        expect(r.lastRoundGrace).toBe(true);
    });

    it('末轮但严重不足（<80%）仍硬拦', async () => {
        jest.resetModules();
        jest.doMock('../../server/store', () => ({ getItem: jest.fn(async () => ({ content: 'x'.repeat(1000) })) }));
        jest.doMock('../../server/services/genreConfig', () => ({ resolveGenreFromProject: () => null }));
        jest.doMock('../../server/config', () => ({ resolveConfig: () => ({ word: { rejectMin: 2500, targetMin: 2500, targetMax: 3000 } }) }));
        const { checkWordCountHardLimit: fn } = require('../../server/services/pipeline/pipelineHelpers/pipelineWordCount');
        const r = await fn('first-review', 'ch1', {}, 'novel', { round: 3, startRound: 1, isLastRound: true });
        expect(r.blocked).toBe(true);
    });

    it('宽限比例常量为 0.8（与 needsSalvageExpansion 对齐）', () => {
        expect(LAST_ROUND_GRACE_RATIO).toBe(0.8);
    });
});

describe('checkWordCountGate 末轮宽限降级', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.doMock('../../server/services/dataContext', () => ({ getDataContext: async () => ({ getProject: async () => ({}) }) }));
        jest.doMock('../../server/services/genreConfig', () => ({ resolveGenreFromProject: () => null }));
        jest.doMock('../../server/config', () => ({ resolveConfig: () => ({ word: { rejectMin: 2500, targetMin: 2500, maxChapter: 4000 } }) }));
    });
    afterEach(() => { jest.dontMock('../../server/services/dataContext'); });

    it('非末轮：字数不足为 critical（hardBlock，不可覆盖）', async () => {
        const { checkWordCountGate } = require('../../server/services/pipeline/steps/review/wordCountGate');
        const blocks = await checkWordCountGate('x'.repeat(2413), 'p1', { allowLastRoundGrace: false });
        expect(blocks[0].severity).toBe('critical');
    });

    it('末轮：2413/2500=96% 降级为 warning，避免不可覆盖的 hardBlock 掐死整章', async () => {
        const { checkWordCountGate } = require('../../server/services/pipeline/steps/review/wordCountGate');
        const blocks = await checkWordCountGate('x'.repeat(2413), 'p1', { allowLastRoundGrace: true });
        expect(blocks[0].severity).toBe('warning');
        expect(blocks[0]._graceful).toBe(true);
    });

    it('末轮但严重不足（<80%）仍为 critical', async () => {
        const { checkWordCountGate } = require('../../server/services/pipeline/steps/review/wordCountGate');
        const blocks = await checkWordCountGate('x'.repeat(1000), 'p1', { allowLastRoundGrace: true });
        expect(blocks[0].severity).toBe('critical');
    });

    it('字数超标始终为 critical', async () => {
        const { checkWordCountGate } = require('../../server/services/pipeline/steps/review/wordCountGate');
        const blocks = await checkWordCountGate('x'.repeat(5000), 'p1', { allowLastRoundGrace: true });
        expect(blocks[0].severity).toBe('critical');
    });
});
