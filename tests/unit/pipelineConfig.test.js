const { PIPELINE_CONFIG, METRICS_CONFIG, TOMATO_SUBGENRE_PIPELINE_CONFIGS, getTomatoSubgenrePipelineConfig } = require('../../server/services/pipelineConfig');

describe('pipelineConfig', () => {
    describe('PIPELINE_CONFIG', () => {
        test('has CIRCUIT_BREAKER_THRESHOLD', () => {
            expect(PIPELINE_CONFIG.CIRCUIT_BREAKER_THRESHOLD).toBeDefined();
            expect(typeof PIPELINE_CONFIG.CIRCUIT_BREAKER_THRESHOLD).toBe('number');
        });

        test('has CIRCUIT_BREAKER_COOLDOWN_MS', () => {
            expect(PIPELINE_CONFIG.CIRCUIT_BREAKER_COOLDOWN_MS).toBeDefined();
            expect(typeof PIPELINE_CONFIG.CIRCUIT_BREAKER_COOLDOWN_MS).toBe('number');
        });

        test('has ALERT_CONSECUTIVE_CHAPTERS', () => {
            expect(PIPELINE_CONFIG.ALERT_CONSECUTIVE_CHAPTERS).toBeDefined();
            expect(typeof PIPELINE_CONFIG.ALERT_CONSECUTIVE_CHAPTERS).toBe('number');
        });

        test('has ALERT_FAIL_RATE_THRESHOLD', () => {
            expect(PIPELINE_CONFIG.ALERT_FAIL_RATE_THRESHOLD).toBeDefined();
            expect(typeof PIPELINE_CONFIG.ALERT_FAIL_RATE_THRESHOLD).toBe('number');
        });

        test('has MAX_ACTIVE_MATERIALS', () => {
            expect(PIPELINE_CONFIG.MAX_ACTIVE_MATERIALS).toBeDefined();
        });

        test('has BRANCHING_TEMPERATURE_BOOST', () => {
            expect(PIPELINE_CONFIG.BRANCHING_TEMPERATURE_BOOST).toBeDefined();
        });

        test('has PACE_ISSUE_KEYWORDS', () => {
            expect(Array.isArray(PIPELINE_CONFIG.PACE_ISSUE_KEYWORDS)).toBe(true);
        });
    });

    describe('METRICS_CONFIG', () => {
        test('is an object', () => {
            expect(typeof METRICS_CONFIG).toBe('object');
        });
    });

    describe('TOMATO_SUBGENRE_PIPELINE_CONFIGS', () => {
        test('is empty (deprecated)', () => {
            expect(Object.keys(TOMATO_SUBGENRE_PIPELINE_CONFIGS).length).toBe(0);
        });
    });

    describe('getTomatoSubgenrePipelineConfig', () => {
        test('returns null (deprecated)', () => {
            expect(getTomatoSubgenrePipelineConfig()).toBeNull();
        });
    });
});
