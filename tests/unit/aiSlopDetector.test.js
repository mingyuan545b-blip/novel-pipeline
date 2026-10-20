'use strict';

/**
 * M11 detectAiSlop（AI 味高频词）+ 高武题材铁律三检测器 单测
 * 依据：docs/worklog/2026-10-10-*（AI 味词表接入检测器 / 铁律三误报修复）
 */

const { detectAiSlop } = require('../../server/services/prompts/detectors/detectAiSlop');
const detectors = require('../../server/services/genres/high-martial-crossplane/detectors');
const { getConfig } = require('../../server/services/prompts/constraintDetectionConfig');

describe('M11 detectAiSlop 设定堆砌/套话', () => {
    it('密集堆砌 AI 味设定词 → 违规', () => {
        const content = '这是因果闭环。底层逻辑如此，形成闭环，本质上不可逆。他嘴角勾起，瞳孔微缩。';
        const r = detectAiSlop({ content });
        expect(r.actual).toBeGreaterThanOrEqual(getConfig('M11').threshold);
        expect(r.violations.length).toBeGreaterThan(0);
    });
    it('正常白话描写不误报', () => {
        const content = '他把碗里的面扒完，抹了抹嘴，站起身往外走。街口的风卷着沙子，打在脸上有点疼。';
        expect(detectAiSlop({ content }).violations.length).toBe(0);
    });
    it('低于阈值不判违规（未达门槛）', () => {
        const content = '他觉得这一切意味着什么，但没想明白。';
        const r = detectAiSlop({ content });
        expect(r.violations.length).toBe(0);
        expect(r.actual).toBeLessThan(getConfig('M11').threshold);
    });
});

describe('高武·铁律三 系统UI元数据直出检测', () => {
    it('真阳性：积分数值/进度条/括注UI令牌 → 命中', () => {
        const r = detectors.systemMetadataLeak('他睁开眼。【任务完成】积分：500，进度条拉到顶。');
        expect(r.isViolation).toBe(true);
        expect(r.count).toBeGreaterThanOrEqual(3);
    });
    it('否定/转述语境不误报（修复回归）：不是系统提示', () => {
        const r = detectors.systemMetadataLeak('不是系统提示，而是直接烙印在他的视网膜投影底层日志里。');
        expect(r.count).toBe(0);
    });
    it('剧情化HUD描写不误报：状态栏/面板不作直出', () => {
        const r = detectors.systemMetadataLeak('他把那段防御代码剪切下来，粘贴到了自己的当前状态栏中。');
        expect(r.count).toBe(0);
    });
});
