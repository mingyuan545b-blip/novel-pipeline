const { createPipelineLogger } = require('../../server/services/pipeline/infinite/pipelineLogger');

describe('pipelineLogger', () => {
    let state;
    let logger;

    beforeEach(() => {
        state = { logs: [] };
        const result = createPipelineLogger('test-project', state);
        logger = result;
    });

    test('addLog adds entry to state.logs', async () => {
        await logger.addLog('Test message');
        expect(state.logs).toHaveLength(1);
        expect(state.logs[0].msg).toBe('Test message');
    });

    test('addLog auto-classifies pipeline-start', async () => {
        await logger.addLog('第1章 开始完整流水线');
        expect(state.logs[0].step).toBe('pipeline-start');
        expect(state.logs[0].passed).toBe(true);
        expect(state.logs[0].chapterNumber).toBe(1);
    });

    test('addLog auto-classifies pipeline-done', async () => {
        await logger.addLog('第3章 完成 ✅');
        expect(state.logs[0].step).toBe('pipeline-done');
        expect(state.logs[0].passed).toBe(true);
        expect(state.logs[0].chapterNumber).toBe(3);
    });

    test('addLog auto-classifies pipeline-error', async () => {
        await logger.addLog('第2章 异常 ❌');
        expect(state.logs[0].step).toBe('pipeline-error');
        expect(state.logs[0].passed).toBe(false);
    });

    test('addLog auto-classifies word-count-fail', async () => {
        await logger.addLog('第1章 字数不达标');
        expect(state.logs[0].step).toBe('word-count-fail');
    });

    test('addLog auto-classifies review-fail', async () => {
        await logger.addLog('第1章 审核未通过');
        expect(state.logs[0].step).toBe('review-fail');
    });

    test('addLog auto-classifies chapter-skip', async () => {
        await logger.addLog('第5章 永久跳过');
        expect(state.logs[0].step).toBe('chapter-skip');
    });

    test('addLog auto-classifies outline-supplement', async () => {
        await logger.addLog('补充大纲');
        expect(state.logs[0].step).toBe('outline-supplement');
    });

    test('addLog auto-classifies pipeline-stop', async () => {
        await logger.addLog('停止Pipeline');
        expect(state.logs[0].step).toBe('pipeline-stop');
    });

    test('addLog trims logs when exceeding MAX_IN_MEMORY_LOGS', async () => {
        for (let i = 0; i < 550; i++) {
            await logger.addLog(`Log ${i}`);
        }
        expect(state.logs.length).toBeLessThan(550);
        expect(state.logs.length).toBeGreaterThan(0);
    });

    test('addLog accepts structured data', async () => {
        await logger.addLog('Test', { customField: 'value' });
        expect(state.logs[0].customField).toBe('value');
    });
});
