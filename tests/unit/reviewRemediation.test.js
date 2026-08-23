'use strict';

/**
 * reviewRemediation 单元测试（S2）
 *
 * 测试策略：
 * - mock store/dataContext/llm/genreConfig/remediationHelpers 等所有依赖
 * - 聚焦 analyzeAndRemediate 主入口：成功/项目不存在/LLM 失败/解析/autoApply 分支
 * - 验证 re-export 的辅助函数可正常访问
 *
 * 文件位置：tests/unit/reviewRemediation.test.js
 */

jest.mock('../../server/shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

// mock store
const mockChapters = [];
jest.mock('../../server/store', () => ({
    queryItems: jest.fn(async () => mockChapters)
}));

// mock dataContext
jest.mock('../../server/services/dataContext', () => ({
    getDataContext: jest.fn()
}));

// mock llm
jest.mock('../../server/services/llm', () => ({
    chat: jest.fn()
}));

// mock genreConfig
jest.mock('../../server/services/genreConfig', () => ({
    resolveGenreFromProject: jest.fn(() => ({ id: 'urban', label: '都市' }))
}));

// mock modelResolver
jest.mock('../../server/config/modelResolver', () => ({
    DEFAULT_MODEL: 'test-model'
}));

// mock systemConfig
jest.mock('../../server/config/systemConfig', () => ({
    PROVIDER_DEFAULTS: { DEFAULT_PROVIDER: 'openai' }
}));

// mock remediationTargets
jest.mock('../../server/services/remediationTargets', () => ({
    REMEDIATION_TARGETS: { writer: ['target1'], review: ['target2'] }
}));

// mock remediationRules
jest.mock('../../server/services/remediationRules', () => ({
    isRuleRedundant: jest.fn(() => false),
    consolidateRules: jest.fn(rules => rules)
}));

// mock remediationApplier
jest.mock('../../server/services/remediationApplier', () => ({
    applyRemediation: jest.fn(),
    getWriterPromptInjection: jest.fn(() => 'writer-injection'),
    getReviewPromptInjection: jest.fn(() => 'review-injection'),
    getWriterPromptInjectionSync: jest.fn(() => 'writer-sync'),
    getReviewPromptInjectionSync: jest.fn(() => 'review-sync')
}));

// mock remediationHelpers
jest.mock('../../server/services/remediationHelpers', () => ({
    buildRemediationPrompt: jest.fn(() => 'analysis-prompt'),
    parseRemediationResponse: jest.fn(),
    executeRemediations: jest.fn()
}));

const { analyzeAndRemediate } = require('../../server/services/reviewRemediation');
const reviewRemediation = require('../../server/services/reviewRemediation');
const store = require('../../server/store');
const { getDataContext } = require('../../server/services/dataContext');
const llm = require('../../server/services/llm');
const { parseRemediationResponse, executeRemediations, buildRemediationPrompt } = require('../../server/services/remediationHelpers');

function setupProject(overrides = {}) {
    return {
        id: 'p1',
        mode: 'novel',
        ...overrides
    };
}

describe('reviewRemediation (S2)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockChapters.length = 0;
        // 重置默认 mock 行为（clearAllMocks 不清除 mockRejectedValue/mockReturnValue）
        llm.chat.mockResolvedValue({ response: 'resp' });
        parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });
        executeRemediations.mockResolvedValue([]);
        getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(setupProject()) });
    });

    describe('re-exports', () => {
        test('导出 REMEDIATION_TARGETS', () => {
            expect(reviewRemediation.REMEDIATION_TARGETS).toBeDefined();
            expect(reviewRemediation.REMEDIATION_TARGETS.writer).toBeDefined();
        });

        test('导出 applyRemediation', () => {
            expect(typeof reviewRemediation.applyRemediation).toBe('function');
        });

        test('导出 getWriterPromptInjection', () => {
            expect(typeof reviewRemediation.getWriterPromptInjection).toBe('function');
        });

        test('导出 getReviewPromptInjection', () => {
            expect(typeof reviewRemediation.getReviewPromptInjection).toBe('function');
        });

        test('导出 getWriterPromptInjectionSync', () => {
            expect(typeof reviewRemediation.getWriterPromptInjectionSync).toBe('function');
        });

        test('导出 getReviewPromptInjectionSync', () => {
            expect(typeof reviewRemediation.getReviewPromptInjectionSync).toBe('function');
        });

        test('导出 isRuleRedundant', () => {
            expect(typeof reviewRemediation.isRuleRedundant).toBe('function');
        });

        test('导出 consolidateRules', () => {
            expect(typeof reviewRemediation.consolidateRules).toBe('function');
        });
    });

    describe('analyzeAndRemediate - 成功路径', () => {
        test('autoApply=true 时执行整改并返回结果', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            mockChapters.push(
                { chapterNumber: 1, title: 'ch1', content: 'A'.repeat(300) },
                { chapterNumber: 2, title: 'ch2', content: 'B'.repeat(300) }
            );
            llm.chat.mockResolvedValue({ choices: [{ message: { content: 'llm-response' } }] });
            parseRemediationResponse.mockReturnValue({
                problems: ['problem1'],
                remediations: [{ type: 'writer', rule: 'rule1' }]
            });
            executeRemediations.mockResolvedValue(['executed1']);

            const result = await analyzeAndRemediate('p1', 'review-text', { autoApply: true });

            expect(result.success).toBe(true);
            expect(result.problems).toEqual(['problem1']);
            expect(result.remediations).toHaveLength(1);
            expect(result.executionLog).toEqual(['executed1']);
            expect(result.autoApplied).toBe(true);
            expect(executeRemediations).toHaveBeenCalledWith('p1', [{ type: 'writer', rule: 'rule1' }], 'novel');
        });

        test('autoApply=false 时不执行整改', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            mockChapters.push({ chapterNumber: 1, title: 'ch1', content: 'content' });
            llm.chat.mockResolvedValue({ response: 'fallback-response' });
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });

            const result = await analyzeAndRemediate('p1', 'review-text', { autoApply: false });

            expect(result.success).toBe(true);
            expect(result.executionLog).toEqual([]);
            expect(result.autoApplied).toBe(false);
            expect(executeRemediations).not.toHaveBeenCalled();
        });

        test('无 chapters 时正常处理', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            llm.chat.mockResolvedValue({ choices: [{ message: { content: 'resp' } }] });
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });

            const result = await analyzeAndRemediate('p1', 'review-text');

            expect(result.success).toBe(true);
            expect(buildRemediationPrompt).toHaveBeenCalled();
        });

        test('chapter.content 缺失的章节被过滤', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            mockChapters.push(
                { chapterNumber: 1, title: 'ch1', content: 'content' },
                { chapterNumber: 2, title: 'ch2' } // 无 content
            );
            llm.chat.mockResolvedValue({ response: 'resp' });
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });

            await analyzeAndRemediate('p1', 'review-text');

            // buildRemediationPrompt 收到的 chapters 应只有 1 个
            const callArgs = buildRemediationPrompt.mock.calls[0];
            expect(callArgs[2]).toHaveLength(1);
        });

        test('chapters 按章节号排序', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            mockChapters.push(
                { chapterNumber: 3, title: 'ch3', content: 'C' },
                { chapterNumber: 1, title: 'ch1', content: 'A' }
            );
            llm.chat.mockResolvedValue({ response: 'resp' });
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });

            await analyzeAndRemediate('p1', 'review-text');

            const callArgs = buildRemediationPrompt.mock.calls[0];
            expect(callArgs[2][0].chapterNumber).toBe(1);
            expect(callArgs[2][1].chapterNumber).toBe(3);
        });

        test('project.mode 缺失时默认 novel', async () => {
            const project = setupProject();
            delete project.mode;
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            llm.chat.mockResolvedValue({ response: 'resp' });
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });
            executeRemediations.mockResolvedValue([]);

            await analyzeAndRemediate('p1', 'review-text');

            expect(executeRemediations).toHaveBeenCalledWith('p1', [], 'novel');
        });

        test('sampleText 截取前 3 章', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            for (let i = 1; i <= 5; i++) {
                mockChapters.push({ chapterNumber: i, title: `ch${i}`, content: 'X'.repeat(500) });
            }
            llm.chat.mockResolvedValue({ response: 'resp' });
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });

            await analyzeAndRemediate('p1', 'review-text');

            const sampleArg = buildRemediationPrompt.mock.calls[0][3];
            expect(sampleArg).toContain('第1章');
            expect(sampleArg).toContain('第2章');
            expect(sampleArg).toContain('第3章');
            expect(sampleArg).not.toContain('第4章');
        });

        test('LLM 返回 choices 格式时提取 content', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            llm.chat.mockResolvedValue({ choices: [{ message: { content: 'choices-content' } }] });
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });

            await analyzeAndRemediate('p1', 'review-text');

            expect(parseRemediationResponse).toHaveBeenCalledWith('choices-content', 'review-text');
        });

        test('LLM 返回 response 格式时提取 response', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            llm.chat.mockResolvedValue({ response: 'fallback-content' });
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });

            await analyzeAndRemediate('p1', 'review-text');

            expect(parseRemediationResponse).toHaveBeenCalledWith('fallback-content', 'review-text');
        });

        test('LLM 返回空时 content 默认空字符串', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            llm.chat.mockResolvedValue({});
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });

            await analyzeAndRemediate('p1', 'review-text');

            expect(parseRemediationResponse).toHaveBeenCalledWith('', 'review-text');
        });
    });

    describe('analyzeAndRemediate - 异常路径', () => {
        test('项目不存在时抛错', async () => {
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(null) });

            await expect(analyzeAndRemediate('p1', 'review-text')).rejects.toThrow('Project not found');
        });

        test('LLM 调用失败时异常向上抛出', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            llm.chat.mockRejectedValue(new Error('LLM timeout'));

            await expect(analyzeAndRemediate('p1', 'review-text')).rejects.toThrow('LLM timeout');
        });

        test('executeRemediations 失败时异常向上抛出', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            llm.chat.mockResolvedValue({ response: 'resp' });
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [{ type: 'writer' }] });
            executeRemediations.mockRejectedValue(new Error('exec failed'));

            await expect(analyzeAndRemediate('p1', 'review-text')).rejects.toThrow('exec failed');
        });
    });

    describe('analyzeAndRemediate - 调用参数验证', () => {
        test('llm.chat 接收正确的 system prompt', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            llm.chat.mockResolvedValue({ response: 'resp' });
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });

            await analyzeAndRemediate('p1', 'review-text');

            const chatArgs = llm.chat.mock.calls[0][0];
            expect(chatArgs[0].role).toBe('system');
            expect(chatArgs[0].content).toContain('整改专家');
            expect(chatArgs[1].role).toBe('user');
            expect(chatArgs[1].content).toBe('analysis-prompt');
        });

        test('llm.chat 接收正确的 options', async () => {
            const project = setupProject();
            getDataContext.mockResolvedValue({ getProject: jest.fn().mockResolvedValue(project) });
            llm.chat.mockResolvedValue({ response: 'resp' });
            parseRemediationResponse.mockReturnValue({ problems: [], remediations: [] });

            await analyzeAndRemediate('p1', 'review-text');

            const chatOpts = llm.chat.mock.calls[0][1];
            expect(chatOpts.maxTokens).toBe(4096);
            expect(chatOpts.temperature).toBe(0.2);
            expect(chatOpts.apiConfig.model).toBe('test-model');
            expect(chatOpts.apiConfig.provider).toBe('openai');
        });
    });
});
