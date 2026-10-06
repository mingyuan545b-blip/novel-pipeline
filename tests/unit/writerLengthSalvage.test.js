/**
 * S7：首轮量化字数指令 + 项目可救区（P1-F）
 */
const { ensureSalvageBand, SALVAGE_BAND_RATIO } = require('../../server/config/writerLengthPolicy');
const { resolveConfig } = require('../../server/config/unifiedConfig');
const { buildLengthInstruction } = require('../../server/services/pipeline/steps/writer/sceneFloorInstruction');
const { EXPANSION_METHODS } = require('../../server/services/pipeline/steps/expansionInstructionBuilder');

describe('S7 可救区（rejectMin < targetMin）', () => {
    test('ensureSalvageBand 在过窄时下压 rejectMin', () => {
        expect(ensureSalvageBand(2500, 2500)).toBe(2250);
        expect(ensureSalvageBand(1000, 1000)).toBe(900);
    });

    test('ensureSalvageBand 不抬高已存在的更宽配置', () => {
        expect(ensureSalvageBand(2500, 2000)).toBe(2000);
        expect(ensureSalvageBand(0, 100)).toBe(100);
    });

    test('resolveConfig 输出的 rejectMin 严格小于 targetMin（可救区宽度>0）', () => {
        const c = resolveConfig(null, { wordConfig: { targetMin: 2500, targetMax: 3000, rejectMin: 2500, maxWords: 3500 } });
        expect(c.word.rejectMin).toBeLessThan(c.word.targetMin);
        expect(c.word.rejectMin).toBe(2500 - Math.round(2500 * SALVAGE_BAND_RATIO));
    });
});

describe('S7 首轮即下发量化写满指令', () => {
    test('buildLengthInstruction 含分场景预算+检查点+自查+结构化手法', () => {
        const wordConfig = { targetMin: 2500, targetMax: 3000, rejectMin: 2250 };
        const ins = buildLengthInstruction(wordConfig);
        expect(ins).toContain('检查点');
        expect(ins).toContain('成稿前自检');
        for (const m of EXPANSION_METHODS) expect(ins).toContain(m);
    });
});
