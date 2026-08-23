'use strict';

/**
 * G4 测试：metricsRecorder 数组裁剪行为（BUG 修复验证）
 *
 * 背景：METRICS_CONFIG.REVISER_LOOPS_MAX/TRIM 等常量之前在 systemConfig 未定义，
 *      导致 metricsRecorder 中所有 `length > undefined` 判断失效，数组永不裁剪。
 *      G4 已修复 systemConfigDefs.js 补全常量，此测试验证裁剪行为恢复。
 *
 * 覆盖：
 *   - reviserLoops 超过 MAX 时裁剪到 TRIM
 *   - hookResolutionLog 超过 MAX 时裁剪到 TRIM
 *   - materialAddedLog 超过 MAX 时裁剪到 TRIM
 *   - branchingLog 超过 MAX 时裁剪到 TRIM
 *   - chapterDurations 超过 MAX 时裁剪到 TRIM
 *
 * 文件位置：tests/unit/metricsRecorderTrim.test.js
 */

const store = require('../../server/store');
const { METRICS_CONFIG } = require('../../server/services/pipelineConfig');

jest.mock('../../server/services/dataContext', () => ({
    getDataContext: jest.fn()
}));
const { getDataContext } = require('../../server/services/dataContext');
const { MetricsCollector, METRICS_KEY } = require('../../server/services/metricsRecorder');

function makeCtx() {
    const project = { id: 'p1' };
    return { getProject: async () => project, _project: project };
}

async function verifyTrim(recordFnName, argsBuilder, configMax, configTrim) {
    const ctx = makeCtx();
    getDataContext.mockResolvedValue(ctx);
    store.setItem = jest.fn().mockResolvedValue(true);

    const c = new MetricsCollector('p1');
    // 写入 MAX + 1 条 — 恰好触发一次裁剪
    for (let i = 0; i < configMax + 1; i++) {
        await c[recordFnName](...argsBuilder(i));
    }

    const arr = ctx._project[METRICS_KEY][recordFnName === 'recordReviserLoop' ? 'reviserLoops'
        : recordFnName === 'recordHookResolution' ? 'hookResolutionLog'
            : recordFnName === 'recordMaterialAdded' ? 'materialAddedLog'
                : recordFnName === 'recordBranching' ? 'branchingLog'
                    : 'chapterDurations'];
    // 裁剪逻辑：length > MAX 时 slice(-TRIM)，恰好 MAX+1 次写入后 length=TRIM
    expect(arr.length).toBe(configTrim);
}

describe('G4: metricsRecorder 数组裁剪（BUG 修复验证）', () => {
    test('reviserLoops 超过 REVISER_LOOPS_MAX 应裁剪到 REVISER_LOOPS_TRIM', async () => {
        await verifyTrim('recordReviserLoop',
            i => [i + 1, 2, 1000, 5],
            METRICS_CONFIG.REVISER_LOOPS_MAX, METRICS_CONFIG.REVISER_LOOPS_TRIM);
    });

    test('hookResolutionLog 超过 HOOK_LOG_MAX 应裁剪到 HOOK_LOG_TRIM', async () => {
        await verifyTrim('recordHookResolution',
            i => [`hook${i}`, i + 1, 'resolved'],
            METRICS_CONFIG.HOOK_LOG_MAX, METRICS_CONFIG.HOOK_LOG_TRIM);
    });

    test('materialAddedLog 超过 MATERIAL_LOG_MAX 应裁剪到 MATERIAL_LOG_TRIM', async () => {
        await verifyTrim('recordMaterialAdded',
            i => [i + 1, 'character', `char${i}`, 'added'],
            METRICS_CONFIG.MATERIAL_LOG_MAX, METRICS_CONFIG.MATERIAL_LOG_TRIM);
    });

    test('branchingLog 超过 BRANCHING_LOG_MAX 应裁剪到 BRANCHING_LOG_TRIM', async () => {
        await verifyTrim('recordBranching',
            i => [i + 1, 'A', 'B', 'A', 'reason'],
            METRICS_CONFIG.BRANCHING_LOG_MAX, METRICS_CONFIG.BRANCHING_LOG_TRIM);
    });

    test('chapterDurations 超过 CHAPTER_DURATIONS_MAX 应裁剪到 CHAPTER_DURATIONS_TRIM', async () => {
        await verifyTrim('recordChapterDuration',
            i => [i + 1, 60000, 3],
            METRICS_CONFIG.CHAPTER_DURATIONS_MAX, METRICS_CONFIG.CHAPTER_DURATIONS_TRIM);
    });

    test('裁剪后应保留最新的 TRIM 条（验证 chapterNumber 连续性）', async () => {
        const ctx = makeCtx();
        getDataContext.mockResolvedValue(ctx);
        store.setItem = jest.fn().mockResolvedValue(true);

        const c = new MetricsCollector('p1');
        const max = METRICS_CONFIG.REVISER_LOOPS_MAX;
        const trim = METRICS_CONFIG.REVISER_LOOPS_TRIM;
        // 写入 max + 1 次 — 第 max+1 次触发裁剪到 trim
        for (let i = 1; i <= max + 1; i++) {
            await c.recordReviserLoop(i, 2, 1000, 5);
        }
        const arr = ctx._project[METRICS_KEY].reviserLoops;
        // slice(-trim) 保留最后 trim 条，即章节号 (max + 1 - trim + 1) 到 (max + 1)
        expect(arr[0].chapterNumber).toBe(max + 1 - trim + 1);
        expect(arr[arr.length - 1].chapterNumber).toBe(max + 1);
    });
});
