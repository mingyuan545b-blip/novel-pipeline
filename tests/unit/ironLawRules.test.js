'use strict';

const rules = require('../../scripts/lib/ironLawRules');

const allStatusPatterns = rules.BUSINESS_VALUE_RULES.flatMap(r => r.patterns);

describe('ironLawRules 共享规则模块', () => {
    describe('场景分支（替代一刀切）', () => {
        test('测试文件命中 test 场景', () => {
            expect(rules.resolveScenario('tests/unit/foo.test.js').id).toBe('test');
            expect(rules.resolveScenario('server/__tests__/a.js').id).toBe('test');
        });

        test('规则定义处命中 rule-definition 场景', () => {
            expect(rules.resolveScenario('server/services/chapterStatus.js').id).toBe('rule-definition');
        });

        test('示例配置文件命中 example-config 场景', () => {
            expect(rules.resolveScenario('.env.example').id).toBe('example-config');
        });

        test('普通源码命中 default 场景', () => {
            expect(rules.resolveScenario('server/services/foo.js').id).toBe('default');
        });

        test('test 场景敏感信息降为 warn 而非一刀切拦截', () => {
            expect(rules.actionFor('tests/unit/a.test.js', 'P0-4')).toBe('warn');
            expect(rules.actionFor('tests/unit/a.test.js', 'P1-Q1')).toBe('skip');
        });

        test('default 场景全部拦截', () => {
            for (const ruleId of ['P0-4', 'P1-Q1', 'P2-B1', 'P1-Q3']) {
                expect(rules.actionFor('server/services/x.js', ruleId)).toBe('block');
            }
        });

        test('场景表结构完备：唯一default、ID不重复、动作合法', () => {
            const ids = rules.SCENARIOS.map(s => s.id);
            expect(new Set(ids).size).toBe(ids.length);
            expect(ids.filter(i => i === 'default')).toHaveLength(1);
            for (const s of rules.SCENARIOS) {
                for (const v of Object.values(s.action)) {
                    expect(['block', 'warn', 'skip']).toContain(v);
                }
            }
        });
    });

    describe('P1-Q1 状态字面量检测（覆盖历史漏检形态）', () => {
        test('=== 比较形态命中', () => {
            const hits = rules.findPatternHits("if (s === 'approved') {}", allStatusPatterns);
            expect(hits.length).toBeGreaterThan(0);
        });

        test('!== 比较形态命中（历史版本漏检）', () => {
            const hits = rules.findPatternHits("const ok = x !== 'outlined';", allStatusPatterns);
            expect(hits.length).toBeGreaterThan(0);
        });

        test('赋值形态命中（历史版本漏检）', () => {
            const hits = rules.findPatternHits("ch.status = 'material-updated';", allStatusPatterns);
            expect(hits.length).toBeGreaterThan(0);
        });

        test('纯文本不误报', () => {
            const hits = rules.findPatternHits('docs mention approved here', allStatusPatterns);
            expect(hits).toHaveLength(0);
        });
    });

    describe('P0-4 敏感信息检测', () => {
        test('命中含点划线的密钥形态', () => {
            const hits = rules.findPatternHits('key=sk-sp-H.DIEPRL.abcdefghijklmnop', rules.SENSITIVE_PATTERNS);
            expect(hits.length).toBeGreaterThan(0);
        });

        test('短占位符不误报', () => {
            const hits = rules.findPatternHits('ALIYUN_CODING_API_KEY=sk-xxx', rules.SENSITIVE_PATTERNS);
            expect(hits).toHaveLength(0);
        });

        test('.env 与 .json 均在扫描目标内（历史版本只扫.js）', () => {
            expect(rules.isSensitiveScanTarget('.env')).toBe(true);
            expect(rules.isSensitiveScanTarget('data/apiKeys/config.json')).toBe(true);
            expect(rules.isSensitiveScanTarget('server/x.js')).toBe(true);
        });

        test('掩码不泄露完整密钥', () => {
            const masked = rules.maskSample('sk-sp-H.DIEPRL.1234567890');
            expect(masked).not.toContain('DIEPRL.1234567890');
            expect(masked.endsWith('***')).toBe(true);
        });
    });

    describe('P2-B1 shell语法检测', () => {
        test('内嵌shell管道命中', () => {
            const hits = rules.findPatternHits('execSync("cat a | grep b")', rules.SHELL_SYNTAX_PATTERNS);
            expect(hits.length).toBeGreaterThan(0);
        });
    });

    describe('P1-Q3 行数扫描范围', () => {
        test('server/client源码在范围内，scripts与测试排除', () => {
            expect(rules.isLineScanTarget('server/services/a.js')).toBe(true);
            expect(rules.isLineScanTarget('client/src/pages/B.jsx')).toBe(true);
            expect(rules.isLineScanTarget('scripts/x.js')).toBe(false);
            expect(rules.isLineScanTarget('server/services/__tests__/a.js')).toBe(false);
        });
    });
});
