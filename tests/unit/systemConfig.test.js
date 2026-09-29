const { resolveConfig } = require('../../server/config/index');
const { getDefaultsForGenre, NOVEL_DEFAULTS } = require('../../server/config/genreDefaults');
const { getAgentConfig, resolveModelBudget, resolveModelCategory, AGENT_DEFAULTS, CONTEXT_BUDGET_MODELS, STORE_SIZE_LIMITS, PIPELINE, LIBRARY_EXTRACT, PROJECT_BUDGET } = require('../../server/config/systemConfig');

describe('SystemConfig - Genre Defaults', () => {
    test('novel defaults have correct values', () => {
        expect(NOVEL_DEFAULTS.targetMinWords).toBe(2400);
        expect(NOVEL_DEFAULTS.maxChapterWords).toBe(3500);
        expect(NOVEL_DEFAULTS.maxRounds).toBe(7);
    });

    test('unknown mode falls back to novel defaults', () => {
        const defaults = getDefaultsForGenre(null, { mode: 'unknown' });
        expect(defaults.targetMinWords).toBe(2400);
        expect(defaults.maxRounds).toBe(7);
    });
});

describe('SystemConfig - resolveConfig', () => {
    test('novel mode resolves with correct word config', () => {
        const config = resolveConfig(null, { mode: 'novel' });
        expect(config.word.targetMin).toBe(2400);
        expect(config.chapter.maxRounds).toBe(7);
    });

    test('project wordConfig overrides defaults', () => {
        const config = resolveConfig(null, { mode: 'novel', wordConfig: { targetMin: 3000 } });
        expect(config.word.targetMin).toBe(3000);
    });

    test('unknown mode falls back to novel', () => {
        const config = resolveConfig(null, { mode: 'unknown' });
        expect(config.chapter.maxRounds).toBe(7);
    });
});

describe('SystemConfig - Agent Configs', () => {
    test('writer has 32768 max tokens', () => {
        const config = getAgentConfig('writer');
        expect(config.maxTokens).toBe(32768);
    });

    test('first-review has 8192 max tokens', () => {
        const config = getAgentConfig('first-review');
        expect(config.maxTokens).toBe(8192);
    });

    test('unknown agent gets defaults', () => {
        const config = getAgentConfig('unknown-agent');
        expect(config.maxTokens).toBe(8192);
        expect(config.defaultTemperature).toBe(0.7);
    });
});

describe('SystemConfig - Model Budget Resolution', () => {
    test('known models return correct budget', () => {
        expect(resolveModelBudget('qwen3.6-plus')).toBe(800000);
        expect(resolveModelBudget('qwen-turbo')).toBe(32000);
        expect(resolveModelBudget('deepseek-chat')).toBe(24000);
    });

    test('case-insensitive model matching', () => {
        expect(resolveModelBudget('Qwen3.6-plus')).toBe(800000);
        expect(resolveModelBudget('Qwen3-30B-A3B')).toBe(512000);
    });

    test('unknown model returns default budget', () => {
        expect(resolveModelBudget('some-future-model')).toBe(CONTEXT_BUDGET_MODELS['default']);
    });
});

describe('SystemConfig - Model Category Resolution', () => {
    test('ultra_long models identified correctly', () => {
        expect(resolveModelCategory('qwen3.6-plus')).toBe('ultra_long');
        expect(resolveModelCategory('Qwen3-30B-A3B')).toBe('ultra_long');
    });

    test('compact models identified correctly', () => {
        expect(resolveModelCategory('qwen-turbo')).toBe('compact');
        expect(resolveModelCategory('gpt-4o-mini')).toBe('compact');
    });

    test('long models identified correctly', () => {
        expect(resolveModelCategory('qwen3.5-plus')).toBe('long');
    });

    test('standard models for mid-range budget', () => {
        const budget = resolveModelBudget('qwen-long');
        expect(budget).toBe(80000);
        expect(resolveModelCategory('qwen-long')).toBe('long');
    });
});

describe('SystemConfig - Store Size Limits', () => {
    test('all size limits are positive numbers', () => {
        for (const [type, limit] of Object.entries(STORE_SIZE_LIMITS)) {
            expect(limit).toBeGreaterThan(0);
        }
    });

    test('chapters have largest limit', () => {
        expect(STORE_SIZE_LIMITS.chapters).toBeGreaterThan(STORE_SIZE_LIMITS.materials);
        expect(STORE_SIZE_LIMITS.chapters).toBeGreaterThan(STORE_SIZE_LIMITS.reviews);
    });
});

describe('SystemConfig - Pipeline Constants', () => {
    test('circuit breaker threshold is 3', () => {
        expect(PIPELINE.CIRCUIT_BREAKER_THRESHOLD).toBe(3);
    });

    test('write lock timeout is reasonable', () => {
        expect(PIPELINE.WRITE_LOCK_TIMEOUT_MS).toBe(10000);
        expect(PIPELINE.WRITE_LOCK_SPIN_MS).toBe(50);
    });

    test('max chapter retries is reasonable', () => {
        expect(PIPELINE.MAX_CHAPTER_RETRIES).toBeGreaterThanOrEqual(3);
    });
});

describe('SystemConfig - Library Extract（藏经阁一键提取）', () => {
    test('提取参数为正数且量级合理', () => {
        expect(LIBRARY_EXTRACT.CHUNK_CHARS).toBeGreaterThan(0);
        expect(LIBRARY_EXTRACT.WINDOWS_PER_DIMENSION).toBeGreaterThanOrEqual(2);
        expect(LIBRARY_EXTRACT.MAX_DIMENSIONS).toBeGreaterThanOrEqual(6);
        expect(LIBRARY_EXTRACT.TECHNIQUES_PER_DIM).toBeGreaterThan(0);
    });

    test('长文本上限必须高于 inputSanitizer 默认10万（否则正文被静默截断，陷阱#115）', () => {
        const { MAX_STRING_LENGTH } = require('../../server/middleware/inputSanitizer');
        expect(LIBRARY_EXTRACT.MAX_TEXT_CHARS).toBeGreaterThan(MAX_STRING_LENGTH);
    });

    test('长文本白名单只放行提取接口的text字段', () => {
        const { resolveMaxLength } = require('../../server/middleware/inputSanitizer');
        expect(resolveMaxLength('/api/library/extract', 'text')).toBe(LIBRARY_EXTRACT.MAX_TEXT_CHARS);
        expect(resolveMaxLength('/api/library/extract', 'novelName')).toBeLessThan(LIBRARY_EXTRACT.MAX_TEXT_CHARS);
        expect(resolveMaxLength('/api/chapters', 'content')).toBeLessThan(LIBRARY_EXTRACT.MAX_TEXT_CHARS);
    });

    test('单次提取超时不超过异步任务看门狗(30分钟)', () => {
        const { TASK_TIMEOUT_MS } = require('../../server/routes/pipeline/asyncTaskManager');
        expect(LIBRARY_EXTRACT.REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(TASK_TIMEOUT_MS);
    });
});

describe('SystemConfig - Project Budget（项目级预算熔断）', () => {
    test('开关与告警比例取值合法', () => {
        expect(typeof PROJECT_BUDGET.ENABLED).toBe('boolean');
        expect(typeof PROJECT_BUDGET.HARD_STOP).toBe('boolean');
        expect(PROJECT_BUDGET.WARN_RATIO).toBeGreaterThan(0);
        expect(PROJECT_BUDGET.WARN_RATIO).toBeLessThanOrEqual(1);
    });

    test('默认不设上限（0=不限制），避免新项目一开就被拦住', () => {
        expect(PROJECT_BUDGET.DEFAULT_TOKEN_LIMIT).toBe(0);
        expect(PROJECT_BUDGET.DEFAULT_COST_LIMIT_CNY).toBe(0);
    });

    test('兜底单价为正数（宁可高估成本，不可低估）', () => {
        expect(PROJECT_BUDGET.DEFAULT_PRICE_PER_MTOK_CNY).toBeGreaterThan(0);
        for (const price of Object.values(PROJECT_BUDGET.MODEL_PRICES_PER_MTOK_CNY)) {
            expect(price).toBeGreaterThan(0);
        }
    });

    test('成本估算与配置表一致（防单价表被误改）', () => {
        const { estimateCostCny } = require('../../server/services/pipeline/projectBudget');
        expect(estimateCostCny('qwen3.8-flash', 1000000)).toBe(PROJECT_BUDGET.MODEL_PRICES_PER_MTOK_CNY['qwen3.8']);
        expect(estimateCostCny('unknown-model', 1000000)).toBe(PROJECT_BUDGET.DEFAULT_PRICE_PER_MTOK_CNY);
    });
});
