'use strict';

/**
 * 元约束检测器单元测试（v2）
 * 验证：M1-M5检测器从配置读取参数，正确识别AI味/重复/割裂/抽象抒情/工具人问题
 * 禁止硬编码：所有阈值和关键词从constraintDetectionConfig.js读取
 */

const assert = require('assert');
const { detectMetaphorSubstitution } = require('../../services/prompts/detectors/detectMetaphorSubstitution');
const { detectConflictPatternRepeat, extractConflictResolutionPattern } = require('../../services/prompts/detectors/detectConflictPatternRepeat');
const { detectChapterCoherence, hasCoherenceSignal } = require('../../services/prompts/detectors/detectChapterCoherence');
const { detectAbstractSentiment } = require('../../services/prompts/detectors/detectAbstractSentiment');
const { detectToolCharacter } = require('../../services/prompts/detectors/detectToolCharacter');
const { getConfig } = require('../../services/prompts/constraintDetectionConfig');

describe('Meta-Constraint Detectors v2 (config-driven, no hardcode)', () => {

    describe('配置层验证', () => {
        it('M1-M5配置应全部存在且含threshold', () => {
            for (const id of ['M1', 'M2', 'M3', 'M4', 'M5']) {
                const config = getConfig(id);
                assert.ok(config, `${id}配置应存在`);
                assert.ok(typeof config.threshold === 'number', `${id}应含threshold`);
            }
        });

        it('M5配置不应包含"苏哥""老大"等业务关键词', () => {
            const config = getConfig('M5');
            const configStr = JSON.stringify(config);
            assert.ok(!configStr.includes('苏哥'), 'M5配置不应含"苏哥"');
            assert.ok(!configStr.includes('老大'), 'M5配置不应含"老大"');
        });

        it('M2配置不应包含"苏沉""林凡"等主角名', () => {
            const config = getConfig('M2');
            const configStr = JSON.stringify(config);
            assert.ok(!configStr.includes('苏沉'), 'M2配置不应含"苏沉"');
            assert.ok(!configStr.includes('林凡'), 'M2配置不应含"林凡"');
        });
    });

    describe('M1: detectMetaphorSubstitution', () => {
        it('应检测比喻词+抽象名词模式', () => {
            const content = '他仿佛时间静止般站在原地，她的笑容宛如春风般温暖，那眼神似乎深渊般幽暗。';
            const result = detectMetaphorSubstitution({ content });
            assert.ok(result.actual >= 2, `应检测到至少2次比喻词，实际: ${result.actual}`);
        });

        it('应检测程度副词+动词模式', () => {
            const content = '他不禁叹了口气，她不由皱起眉头，老人默默点了点头，少女静静看着远方。';
            const result = detectMetaphorSubstitution({ content });
            assert.ok(result.actual >= 3, `应检测到至少3次副词+动词，实际: ${result.actual}`);
        });

        it('应检测量词+抽象名词模式', () => {
            const content = '她嘴角浮起一丝笑意，他眼中闪过一抹寒意，空气中弥漫着一股气息。';
            const result = detectMetaphorSubstitution({ content });
            assert.ok(result.actual >= 2, `应检测到至少2次量词+抽象，实际: ${result.actual}`);
        });

        it('正常内容不应触发违规', () => {
            const content = '他三步并作两步走到桌前，抓起茶杯一饮而尽。茶水烫得他直咧嘴，但还是硬咽了下去。';
            const result = detectMetaphorSubstitution({ content });
            assert.ok(result.actual <= 1, `正常内容不应触发违规，实际: ${result.actual}`);
        });

        it('actual <= threshold 时 violations 必须为空（防止误判）', () => {
            // 构造2个比喻词，threshold=5，actual=2 <= 5，不应违规
            const content = '他仿佛静止般站着，她宛如春风般笑了。';
            const result = detectMetaphorSubstitution({ content });
            assert.ok(result.actual <= 5, `actual应<=threshold(5)，实际: ${result.actual}`);
            assert.strictEqual(result.violations.length, 0, `actual<=threshold时violations必须为空，实际: ${result.violations.length}`);
        });
    });

    describe('M2: detectConflictPatternRepeat', () => {
        it('应识别被动反击模式', () => {
            const config = getConfig('M2');
            const content = '苏沉本不想出手，但对方逼到眼前，他只能被动反击，没想到一拳就把对方打飞，围观者全傻眼了。';
            const pattern = extractConflictResolutionPattern(content, config.conflictPatterns);
            assert.strictEqual(pattern, 'passive-counter');
        });

        it('连续相同模式应触发违规', async () => {
            const prevContent = '苏沉本不想出手，但对方逼到眼前，他只能被动反击，没想到一拳就把对方打飞，围观者全傻眼了。';
            const currentContent = '苏沉懒得动手，但对方不依不饶，他被迫反击，不料一脚就把对方踹飞，众人惊呆了。';
            const result = await detectConflictPatternRepeat({
                content: currentContent,
                chapterNumber: 2,
                recentChapterContents: [prevContent],
            });
            assert.ok(result.violations.length > 0, '连续相同模式应触发违规');
        });

        it('不同模式不应触发违规', async () => {
            const prevContent = '苏沉本不想出手，被动反击，没想到一拳打飞对方。';
            const currentContent = '苏沉主动设下陷阱，用智谋引敌人入局，最终不战而胜。';
            const result = await detectConflictPatternRepeat({
                content: currentContent,
                chapterNumber: 2,
                recentChapterContents: [prevContent],
            });
            assert.strictEqual(result.violations.length, 0);
        });
    });

    describe('M3: detectChapterCoherence', () => {
        it('连贯的章节不应触发违规', () => {
            const prevContent = '...苏沉跟着执事走出了食堂，脑海中突然响起一道冰冷的警报声。';
            const currentContent = '苏沉脚步一顿，脑海中那道警报声还在回荡。他抬头看了一眼执事的背影...';
            const result = detectChapterCoherence({ content: currentContent, prevChapterContent: prevContent });
            assert.strictEqual(result.violations.length, 0, '连贯章节不应触发违规');
        });

        it('不连贯的章节应触发违规', () => {
            const prevContent = '...苏沉跟着执事走出了食堂，脑海中突然响起一道冰冷的警报声。';
            const currentContent = '李长风的拳头裹挟着劲风直取苏沉面门，苏沉侧身一闪堪堪躲过。';
            const result = detectChapterCoherence({ content: currentContent, prevChapterContent: prevContent });
            assert.ok(result.violations.length > 0, '不连贯章节应触发违规');
        });

        it('第1章不应触发违规', () => {
            const result = detectChapterCoherence({ content: '任何内容', prevChapterContent: null });
            assert.strictEqual(result.violations.length, 0);
        });
    });

    describe('M4: detectAbstractSentiment', () => {
        it('应检测抽象时间静止模式', () => {
            const content = '时间仿佛静止，空气凝固，他看着她离去的背影，无言的震撼涌上心头。';
            const result = detectAbstractSentiment({ content });
            assert.ok(result.actual >= 2, `应检测到抽象抒情，实际: ${result.actual}`);
        });

        it('正常具体描写不应触发违规', () => {
            const content = '他盯着断剑三秒没说话，指节发白。她转身离开，脚步声在走廊里回响。';
            const result = detectAbstractSentiment({ content });
            assert.ok(result.actual === 0, `正常描写不应触发，实际: ${result.actual}`);
        });

        it('actual <= threshold 时 violations 必须为空（防止误判）', () => {
            // 构造1处抽象抒情，threshold=2，actual=1 <= 2，不应违规
            const content = '时间仿佛静止，他看着她离去的背影。';
            const result = detectAbstractSentiment({ content });
            assert.ok(result.actual <= 2, `actual应<=threshold(2)，实际: ${result.actual}`);
            assert.strictEqual(result.violations.length, 0, `actual<=threshold时violations必须为空，实际: ${result.violations.length}`);
        });
    });

    describe('M5: detectToolCharacter', () => {
        it('应检测工具人配角（通用台词模式，非硬编码主角名）', () => {
            const content = `周大壮道："是，主人！"
周大壮说："好的，遵命！"
周大壮道："厉害！真厉害！"
周大壮说："没错，说得对！"
周大壮道："是，我听你的。"`;
            const result = detectToolCharacter({ content, sideCharacterNames: ['周大壮'] });
            assert.ok(result.violations.length > 0, '工具人配角应触发违规');
            assert.ok(result.actual > 0.5, `工具性台词占比应>0.5，实际: ${result.actual}`);
        });

        it('有独立动机的配角不应触发违规', () => {
            const content = `周大壮皱眉："我觉得这事儿不对劲。"
周大壮道："我不去，我还得回家看我娘。"
周大壮说："你确定？我可不想趟这浑水。"
周大壮道："行吧，但是我有条件——事后你得帮我找那本医书。"`;
            const result = detectToolCharacter({ content, sideCharacterNames: ['周大壮'] });
            assert.ok(result.actual < 0.5, `有动机配角不应触发，实际占比: ${result.actual}`);
        });

        it('无配角名不应触发违规', () => {
            const content = '任何内容';
            const result = detectToolCharacter({ content, sideCharacterNames: [] });
            assert.strictEqual(result.violations.length, 0);
        });
    });
});
