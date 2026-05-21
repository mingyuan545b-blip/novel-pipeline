const { getModeConfig, getModePipelineConfig, getAgentConfig, resolveModelBudget, resolveModelCategory, MODE_CONFIGS, MODE_PIPELINE_CONFIGS, AGENT_DEFAULTS, CONTEXT_BUDGET_MODELS, STORE_SIZE_LIMITS, PIPELINE } = require('../../server/config/systemConfig');

describe('SystemConfig - Mode Configs', () => {
    test('novel mode has correct defaults', () => {
        const config = getModeConfig('novel');
        expect(config.TARGET_MIN_WORDS).toBe(2200);
        expect(config.MAX_CHAPTER_WORDS).toBe(3500);
    });

    test('shuangwen mode has correct defaults', () => {
        const config = getModeConfig('shuangwen');
        expect(config.TARGET_MIN_WORDS).toBe(1800);
        expect(config.MAX_CHAPTER_WORDS).toBe(2800);
    });

    test('tomato-short mode has correct defaults', () => {
        const config = getModeConfig('tomato-short');
        expect(config.TARGET_MIN_WORDS).toBe(1900);
        expect(config.REJECT_MIN_WORDS).toBe(1850);
    });

    test('unknown mode falls back to novel', () => {
        const config = getModeConfig('unknown');
        expect(config.TARGET_MIN_WORDS).toBe(2200);
    });
});

describe('SystemConfig - Pipeline Configs', () => {
    test('novel pipeline has 7 max rounds', () => {
        const config = getModePipelineConfig('novel');
        expect(config.MAX_ROUNDS).toBe(7);
    });

    test('shuangwen pipeline has 3 max rounds', () => {
        const config = getModePipelineConfig('shuangwen');
        expect(config.MAX_ROUNDS).toBe(3);
    });

    test('unknown mode falls back to novel', () => {
        const config = getModePipelineConfig('unknown');
        expect(config.MAX_ROUNDS).toBe(7);
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
        expect(resolveModelBudget('MiniMax-M2.7')).toBe(32000);
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
        expect(resolveModelCategory('MiniMax-M2.7')).toBe('compact');
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
