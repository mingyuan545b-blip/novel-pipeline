'use strict';

/**
 * tokenLedgerView.test.js — Token 去向面板聚合与告警规则
 * 重点验证"能发现问题"的能力：截断聚合、返修占比可靠性、场景索引、分段占比。
 */
const { buildTokenLedgerView } = require('../../server/services/pipeline/tokenLedgerView');
const { normalizeUsage, extractPromptSections } = require('../../server/services/pipeline/tokenLedger');
const fingerprint = require('../../server/services/machineFingerprint');

function rec({ chapter = 1, step = 'writer', runRound = 1, prompt = 1000, completion = 200, cached = 0, trunc = 0 } = {}) {
    const sections = [{
        slot: 'agent_prompt', tokens: prompt, maxTokens: prompt, originalTokens: prompt + trunc,
        lostTokens: trunc, wasTruncated: trunc > 0,
    }];
    return {
        chapter, step, runRound,
        usage: { promptTokens: prompt, completionTokens: completion, totalTokens: prompt + completion, cachedTokens: cached },
        promptSections: sections,
        truncatedSlots: trunc > 0 ? [{ slot: 'agent_prompt', lostTokens: trunc }] : [],
        outputChars: 3000,
    };
}

describe('tokenLedger 归一化', () => {
    test('usage 归一化包含缓存命中', () => {
        const u = normalizeUsage({ prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, prompt_tokens_details: { cached_tokens: 64 } });
        expect(u).toEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120, cachedTokens: 64 });
    });

    test('缺失 usage 不抛错且全为 0', () => {
        expect(normalizeUsage(undefined).totalTokens).toBe(0);
    });

    test('分段提取保留截断信息与丢失量', () => {
        const report = { slots: { agent_prompt: { tokens: 900, maxTokens: 1000, originalTokens: 1500, wasTruncated: true }, empty: { tokens: 0 } } };
        const sections = extractPromptSections(report);
        expect(sections).toHaveLength(1);
        expect(sections[0]).toMatchObject({ slot: 'agent_prompt', tokens: 900, lostTokens: 600, wasTruncated: true });
    });
});

describe('buildTokenLedgerView 聚合', () => {
    const ledger = [
        rec({ chapter: 1, step: 'writer', prompt: 2000, completion: 500, trunc: 600 }),
        rec({ chapter: 1, step: 'reviser', runRound: 2, prompt: 3000, completion: 200 }),
        rec({ chapter: 2, step: 'writer', prompt: 1000, completion: 100, cached: 500 }),
    ];
    const view = buildTokenLedgerView({
        projectId: 'p1', ledger,
        assemblies: { 1: { sceneTypes: ['combat'], phase: 'opening' }, 2: { sceneTypes: ['social'], phase: 'development' } },
        wordCounts: { 1: 3000, 2: 1000 },
    });

    test('总览汇总总量/调用数/章节数', () => {
        expect(view.hasData).toBe(true);
        expect(view.totals.calls).toBe(3);
        expect(view.totals.chapters).toBe(2);
        expect(view.totals.totalTokens).toBe(2000 + 500 + 3000 + 200 + 1000 + 100);
    });

    test('分段占比合计约 100%', () => {
        const sum = view.bySection.reduce((n, s) => n + s.share, 0);
        expect(Math.round(sum)).toBe(100);
    });

    test('分段带中文标签与分组', () => {
        expect(view.bySection[0].label).toBe('Agent提示词');
        expect(view.bySection[0].groupLabel).toBe('提示词与规则');
    });

    test('步骤带中文名并按时长占比排序', () => {
        const writer = view.byStep.find(s => s.step === 'writer');
        expect(writer.stepLabel).toBe('执笔人');
        expect(view.byStep[0].tokens).toBeGreaterThanOrEqual(view.byStep[view.byStep.length - 1].tokens);
    });

    test('场景索引把章号归到对应场景', () => {
        expect(view.scenes.map(s => s.key).sort()).toEqual(['combat', 'social']);
        expect(view.scenes.find(s => s.key === 'social').chapters).toEqual([2]);
    });

    test('趋势与逐章一一对应', () => {
        expect(view.trend).toHaveLength(2);
        expect(view.chapters[0].phaseLabel).toBe('开篇');
    });

    test('每千字效率按章字数计算', () => {
        // 第2章：1100 tokens / 1 千字
        expect(view.chapters[1].tokensPerKChar).toBe(1100);
    });
});

describe('告警规则', () => {
    test('截断按分段聚合成一条（不按章刷屏）', () => {
        const ledger = [
            rec({ chapter: 1, trunc: 500 }), rec({ chapter: 2, trunc: 700 }), rec({ chapter: 3, trunc: 100 }),
        ];
        const view = buildTokenLedgerView({ projectId: 'p', ledger });
        const truncAlerts = view.alerts.filter(a => a.slot === 'agent_prompt');
        expect(truncAlerts).toHaveLength(1);
        expect(truncAlerts[0].message).toContain('3 个章节');
        expect(truncAlerts[0].chapter).toBe(2); // 最严重章节用于跳转
    });

    test('同章同时有首轮与返修轮才给返修告警（续跑章节不误报）', () => {
        const withBoth = buildTokenLedgerView({ projectId: 'p', ledger: [
            rec({ chapter: 1, runRound: 1, prompt: 100 }), rec({ chapter: 1, runRound: 2, prompt: 900 }),
        ] });
        expect(withBoth.alerts.some(a => a.message.includes('返修轮'))).toBe(true);
        expect(withBoth.chapters[0].roundSplit.reliable).toBe(true);

        const onlyRetry = buildTokenLedgerView({ projectId: 'p', ledger: [
            rec({ chapter: 1, runRound: 3, prompt: 900 }), rec({ chapter: 1, runRound: 4, prompt: 900 }),
        ] });
        expect(onlyRetry.alerts.some(a => a.message.includes('返修轮'))).toBe(false);
        expect(onlyRetry.chapters[0].roundSplit.reliable).toBe(false);
    });

    test('无数据时不产生告警', () => {
        const view = buildTokenLedgerView({ projectId: 'p', ledger: [] });
        expect(view.hasData).toBe(false);
        expect(view.alerts).toEqual([]);
    });
});

describe('机器指纹稳定性（许可证）', () => {
    test('返回 32 位 hex 且多次调用一致', () => {
        const id = fingerprint.getMachineId();
        expect(id).toMatch(/^[0-9a-f]{32}$/);
        expect(fingerprint.getMachineId()).toBe(id);
    });

    test('指纹不包含内存容量（换内存不得导致许可证失效）', () => {
        const os = require('os');
        const original = os.totalmem;
        const before = fingerprint.getMachineId();
        try {
            os.totalmem = () => (original() || 0) * 2; // 模拟内存翻倍
            fingerprint.resetMachineIdCache();
            expect(fingerprint.getMachineId()).toBe(before);
        } finally {
            os.totalmem = original;
            fingerprint.resetMachineIdCache();
        }
    });

    test('可报告指纹来源，便于诊断 Machine mismatch', () => {
        expect(typeof fingerprint.getMachineIdSource()).toBe('string');
        expect(fingerprint.getMachineIdSource().length).toBeGreaterThan(0);
    });
});
