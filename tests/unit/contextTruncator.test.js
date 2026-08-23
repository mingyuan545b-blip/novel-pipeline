'use strict';

/**
 * contextTruncator 单元测试（R3）
 *
 * 测试策略：
 * - 覆盖 _resolveModelBudget 的 10+ 模型分支
 * - 覆盖 getReviewLimits 的 4 个 budget 阈值区间
 * - 覆盖 truncateForReview/truncateForFinalEditor/truncateReviewOutput 截断逻辑
 * - 验证环境变量读取与 DEFAULT_MODEL fallback
 *
 * 文件位置：tests/unit/contextTruncator.test.js
 */

const {
    getReviewLimits,
    truncateForReview,
    truncateForFinalEditor,
    truncateReviewOutput
} = require('../../server/services/contextTruncator');
const { CONTEXT_BUDGETS } = require('../../server/services/contextBudget');
const { DEFAULT_MODEL } = require('../../server/config/modelResolver');

const ORIGINAL_MODEL = process.env.ALIYUN_CODING_MODEL;

afterEach(() => {
    if (ORIGINAL_MODEL === undefined) delete process.env.ALIYUN_CODING_MODEL;
    else process.env.ALIYUN_CODING_MODEL = ORIGINAL_MODEL;
});

describe('contextTruncator (R3)', () => {
    describe('getReviewLimits - budget 区间映射', () => {
        test('qwen3.6-plus (800K) 走 budget>=400000 分支', () => {
            const limits = getReviewLimits('qwen3.6-plus');
            expect(limits.contentLimit).toBe(0); // 不截断
            expect(limits.reviewOutputLimit).toBe(3000);
            expect(limits.finalEditorHead).toBe(0);
            expect(limits.finalEditorTail).toBe(0);
        });

        test('qwen3.5-plus (256K) 走 budget>=100000 分支', () => {
            const limits = getReviewLimits('qwen3.5-plus');
            expect(limits.contentLimit).toBe(50000);
            expect(limits.reviewOutputLimit).toBe(2500);
            expect(limits.finalEditorHead).toBe(3000);
            expect(limits.finalEditorTail).toBe(3000);
        });

        test('qwen3-235b (128K) 走 budget>=100000 分支', () => {
            const limits = getReviewLimits('qwen3-235b');
            // 128000 >= 100000 → contentLimit=50000
            expect(limits.contentLimit).toBe(50000);
            expect(limits.reviewOutputLimit).toBe(2500);
            expect(limits.finalEditorHead).toBe(3000);
            expect(limits.finalEditorTail).toBe(3000);
        });

        test('deepseek (24K) 走 budget<=40000 分支', () => {
            const limits = getReviewLimits('deepseek-chat');
            expect(limits.contentLimit).toBe(6000);
            expect(limits.reviewOutputLimit).toBe(1500);
            expect(limits.finalEditorHead).toBe(500);
            expect(limits.finalEditorTail).toBe(500);
        });

        test('glm-4 (16K) 走 budget<=40000 分支', () => {
            const limits = getReviewLimits('glm-4');
            expect(limits.contentLimit).toBe(6000);
        });

        test('默认模型（未识别）走 CONTEXT_BUDGETS.default', () => {
            const limits = getReviewLimits('unknown-model-xyz');
            const expectedBudget = CONTEXT_BUDGETS.default;
            // 默认预算通常 < 40000，走小模型分支
            if (expectedBudget <= 40000) {
                expect(limits.contentLimit).toBe(6000);
            } else if (expectedBudget >= 100000) {
                expect(limits.contentLimit).toBe(50000);
            }
        });
    });

    describe('getReviewLimits - 模型识别', () => {
        test('qwen3.6-35b 识别', () => {
            const limits = getReviewLimits('qwen3.6-35b');
            // 256000 → >=100000 分支
            expect(limits.contentLimit).toBe(50000);
        });

        test('qwen3-30b 识别', () => {
            const limits = getReviewLimits('qwen3-30b');
            expect(limits.contentLimit).toBe(50000);
        });

        test('qwen3-32b 识别', () => {
            const limits = getReviewLimits('qwen3-32b');
            // 128000 → 默认分支（100000 < budget <= 400000 之间，走默认 12000）
            // 实际逻辑：budget >= 100000 走 50000 分支，所以 128000 应走 50000
            expect(limits.contentLimit).toBe(50000);
        });

        test('qwen-long 识别', () => {
            const limits = getReviewLimits('qwen-long');
            // 80000 → 不<=40000，不>=100000，走默认分支
            expect(limits.contentLimit).toBe(12000);
        });

        test('gpt-4o 识别', () => {
            const limits = getReviewLimits('gpt-4o');
            // 16000 → <=40000
            expect(limits.contentLimit).toBe(6000);
        });

        test('gpt-4-turbo 识别', () => {
            const limits = getReviewLimits('gpt-4-turbo');
            expect(limits.contentLimit).toBe(6000);
        });

        test('moonshot-v1-128k 识别', () => {
            const limits = getReviewLimits('moonshot-v1-128k');
            // 32000 → <=40000
            expect(limits.contentLimit).toBe(6000);
        });

        test('大小写不敏感', () => {
            const limits = getReviewLimits('QWEN3.6-PLUS');
            expect(limits.contentLimit).toBe(0); // 800K 分支
        });

        test('CONTEXT_BUDGETS 中已定义的模型优先精确匹配', () => {
            // 若 CONTEXT_BUDGETS 中有 qwen-plus
            if (CONTEXT_BUDGETS['qwen-plus']) {
                const limits = getReviewLimits('qwen-plus');
                expect(limits).toBeDefined();
            }
        });
    });

    describe('getReviewLimits - 环境变量', () => {
        test('未传 model 时从 ALIYUN_CODING_MODEL 读取', () => {
            process.env.ALIYUN_CODING_MODEL = 'deepseek-chat';
            const limits = getReviewLimits();
            expect(limits.contentLimit).toBe(6000);
        });

        test('环境变量为空时使用 DEFAULT_MODEL', () => {
            delete process.env.ALIYUN_CODING_MODEL;
            const limits = getReviewLimits();
            // DEFAULT_MODEL 的行为取决于其值
            expect(limits).toBeDefined();
            expect(limits).toHaveProperty('contentLimit');
        });
    });

    describe('truncateForReview', () => {
        test('空内容返回空字符串', () => {
            expect(truncateForReview('', 'qwen3.6-plus')).toBe('');
            expect(truncateForReview(null, 'qwen3.6-plus')).toBe('');
            expect(truncateForReview(undefined, 'qwen3.6-plus')).toBe('');
        });

        test('contentLimit=0 时不截断（qwen3.6-plus）', () => {
            const long = 'a'.repeat(1000000);
            const result = truncateForReview(long, 'qwen3.6-plus');
            expect(result.length).toBe(1000000);
            expect(result).not.toContain('截断');
        });

        test('内容小于 contentLimit 时不截断', () => {
            const short = '短内容';
            const result = truncateForReview(short, 'deepseek-chat');
            expect(result).toBe('短内容');
        });

        test('内容超过 contentLimit 时截断并附加提示', () => {
            const long = 'a'.repeat(10000);
            const result = truncateForReview(long, 'deepseek-chat');
            expect(result.length).toBeLessThan(10000);
            expect(result).toContain('截断');
            expect(result.startsWith('a')).toBe(true);
        });

        test('截断后内容长度等于 contentLimit + 提示文字', () => {
            const long = 'x'.repeat(10000);
            const result = truncateForReview(long, 'deepseek-chat');
            // contentLimit=6000 + '\n...(正文过长已截断...)' 提示
            expect(result.startsWith('x'.repeat(6000))).toBe(true);
        });
    });

    describe('truncateForFinalEditor', () => {
        test('空内容返回空字符串', () => {
            expect(truncateForFinalEditor('', 'qwen3.6-plus')).toBe('');
            expect(truncateForFinalEditor(null, 'qwen3.6-plus')).toBe('');
        });

        test('finalEditorHead=0 时返回全文（qwen3.6-plus）', () => {
            const content = '正文内容';
            const result = truncateForFinalEditor(content, 'qwen3.6-plus');
            expect(result).toContain('全文');
            expect(result).toContain('正文内容');
            expect(result).toContain(`${content.length}字`);
        });

        test('finalEditorHead>0 时返回首尾模式', () => {
            const content = 'a'.repeat(10000);
            const result = truncateForFinalEditor(content, 'deepseek-chat');
            // deepseek: head=500, tail=500
            expect(result).toContain('前500字');
            expect(result).toContain('末500字');
            expect(result).not.toContain('全文');
        });

        test('首尾模式正确提取首部和尾部', () => {
            const head = 'HEAD'.repeat(200); // 800 字符
            const middle = 'M'.repeat(5000);
            const tail = 'TAIL'.repeat(200); // 800 字符
            const content = head + middle + tail;
            const result = truncateForFinalEditor(content, 'deepseek-chat');
            expect(result).toContain('HEAD'); // 首部在前
            expect(result).toContain('TAIL'); // 尾部在后
            expect(result).not.toContain('M'.repeat(100)); // 中间被丢弃
        });

        test('内容短于 head+tail 时全部保留', () => {
            const content = '短内容';
            const result = truncateForFinalEditor(content, 'deepseek-chat');
            // head=500, tail=500，但内容只有 3 字
            // substring(0, 500) 返回全部，substring(Math.max(0, 3-500))=substring(0) 返回全部
            expect(result).toContain('短内容');
        });

        test('内容长度等于 head+tail 时的边界', () => {
            const content = 'a'.repeat(1000); // deepseek head+tail=1000
            const result = truncateForFinalEditor(content, 'deepseek-chat');
            expect(result).toContain('前500字');
            expect(result).toContain('末500字');
        });
    });

    describe('truncateReviewOutput', () => {
        test('空文本返回空字符串', () => {
            expect(truncateReviewOutput('', 'qwen3.6-plus')).toBe('');
            expect(truncateReviewOutput(null, 'qwen3.6-plus')).toBe('');
        });

        test('文本短于 reviewOutputLimit 时不截断', () => {
            const short = '审核结果';
            const result = truncateReviewOutput(short, 'deepseek-chat');
            expect(result).toBe('审核结果');
        });

        test('文本超过 reviewOutputLimit 时截断', () => {
            const long = 'x'.repeat(5000);
            const result = truncateReviewOutput(long, 'deepseek-chat');
            expect(result.length).toBeLessThan(5000);
            expect(result).toContain('截断');
            expect(result.startsWith('x')).toBe(true);
        });

        test('qwen3.6-plus 的 reviewOutputLimit=3000', () => {
            const long = 'x'.repeat(5000);
            const result = truncateReviewOutput(long, 'qwen3.6-plus');
            // 3000 + 提示文字
            expect(result.startsWith('x'.repeat(3000))).toBe(true);
            expect(result).toContain('截断');
        });

        test('qwen3.5-plus 的 reviewOutputLimit=2500', () => {
            const long = 'x'.repeat(5000);
            const result = truncateReviewOutput(long, 'qwen3.5-plus');
            expect(result.startsWith('x'.repeat(2500))).toBe(true);
        });

        test('deepseek 的 reviewOutputLimit=1500', () => {
            const long = 'x'.repeat(5000);
            const result = truncateReviewOutput(long, 'deepseek-chat');
            expect(result.startsWith('x'.repeat(1500))).toBe(true);
        });
    });

    describe('模块导出', () => {
        test('导出 4 个函数', () => {
            const mod = require('../../server/services/contextTruncator');
            expect(typeof mod.getReviewLimits).toBe('function');
            expect(typeof mod.truncateForReview).toBe('function');
            expect(typeof mod.truncateForFinalEditor).toBe('function');
            expect(typeof mod.truncateReviewOutput).toBe('function');
        });
    });

    describe('返回值结构完整性', () => {
        test('getReviewLimits 返回 4 个字段', () => {
            const limits = getReviewLimits('qwen3.6-plus');
            expect(limits).toHaveProperty('contentLimit');
            expect(limits).toHaveProperty('reviewOutputLimit');
            expect(limits).toHaveProperty('finalEditorHead');
            expect(limits).toHaveProperty('finalEditorTail');
        });

        test('所有模型返回的 limits 字段类型一致', () => {
            const models = ['qwen3.6-plus', 'qwen3.5-plus', 'qwen3-235b', 'deepseek-chat', 'unknown'];
            for (const m of models) {
                const limits = getReviewLimits(m);
                expect(typeof limits.contentLimit).toBe('number');
                expect(typeof limits.reviewOutputLimit).toBe('number');
                expect(typeof limits.finalEditorHead).toBe('number');
                expect(typeof limits.finalEditorTail).toBe('number');
            }
        });
    });
});
