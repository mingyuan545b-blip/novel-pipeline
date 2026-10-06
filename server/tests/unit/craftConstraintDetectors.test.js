'use strict';

/**
 * 12-创作工艺 新增检测器单测：M6 张力消解 / M7 升华收尾 / M8 情绪承接 / M9 意象复用 / M10 钩子同质
 * 以及伏笔回收可行性校验。
 */

const { detectBanterDeflation } = require('../../services/prompts/detectors/detectBanterDeflation');
const { detectAbstractEnding } = require('../../services/prompts/detectors/detectAbstractEnding');
const { detectEmotionalContinuity } = require('../../services/prompts/detectors/detectEmotionalContinuity');
const { detectMotifReuse } = require('../../services/prompts/detectors/detectMotifReuse');
const { detectHookMonotony } = require('../../services/prompts/detectors/detectHookMonotony');
const { extractResolveChapter, checkForeshadowFeasibility } = require('../../services/pipeline/foreshadowFeasibility');

describe('M6 detectBanterDeflation 张力消解', () => {
    it('生死场景后接现代梗 → 违规', () => {
        const content = '刀锋贴上喉咙，血顺着领口往下淌，他闻到了死亡的味道。说不定还能顺便问问，下面是不是也实行绩效考核制。他逃出巷子，追兵的脚步声越来越近。行吧，大不了被抓回去加班，反正工资也没涨过。';
        expect(detectBanterDeflation({ content }).violations.length).toBeGreaterThan(0);
    });
    it('纯日常吐槽不误报', () => {
        const content = '他端着茶杯算了算这个月的开支，觉得日子过得紧。隔壁摊子的大爷冲他笑了笑，他也点了点头，继续低头盘算。';
        expect(detectBanterDeflation({ content }).violations.length).toBe(0);
    });
});

describe('M7 detectAbstractEnding 升华收尾', () => {
    it('章末"渺小/融入画卷" → 违规', () => {
        const content = '他推门出去。阳光正好，影子拉得很长，融入广阔的江湖画卷中，渺小，却又无处不在。';
        expect(detectAbstractEnding({ content }).violations.length).toBeGreaterThan(0);
    });
    it('具体动作收尾不误报', () => {
        const content = '他推门出去，日光刺眼。他摸了摸袖子，那本空白的簿子还在。';
        expect(detectAbstractEnding({ content }).violations.length).toBe(0);
    });
});

describe('M8 detectEmotionalContinuity 情绪承接', () => {
    it('上章生死威胁 + 本章开头毫无呼应 → 违规', () => {
        const prev = '那人把刀架在他脖子上，血从皮肤渗出来，他知道再退一步就是死。';
        const content = '第二天清晨，阳光明媚，他在集市上挑了两斤新鲜的青菜，心情不错，盘算着中午吃什么。';
        expect(detectEmotionalContinuity({ content, chapterNumber: 2, prevChapterContent: prev }).violations.length).toBeGreaterThan(0);
    });
    it('开头承接上章压力 → 不违规', () => {
        const prev = '那人把刀架在他脖子上，血从皮肤渗出来，他知道再退一步就是死。';
        const content = '刀还架在他脖子上。血从领口渗出，他知道自己离死只差半步。天亮之前必须离开这座城。';
        expect(detectEmotionalContinuity({ content, chapterNumber: 2, prevChapterContent: prev }).violations.length).toBe(0);
    });
});

describe('M9 detectMotifReuse 意象复用', () => {
    it('相邻章逐字复用同一比喻 → 违规', () => {
        const ch1 = '算盘珠子碰撞的声音，密集得像一场暴雨前的蝉鸣。';
        const ch2 = '他只听见算盘珠子碰撞的声音，密集得像一场暴雨前的蝉鸣。';
        expect(detectMotifReuse({ content: ch2, recentChapterContents: [ch1] }).violations.length).toBeGreaterThan(0);
    });
    it('不同比喻不误报', () => {
        const ch1 = '算盘声密集得像一场暴雨前的蝉鸣。';
        const ch2 = '铜钱冰凉，贴着掌心像一枚被河水磨了几十年的卵石。';
        expect(detectMotifReuse({ content: ch2, recentChapterContents: [ch1] }).violations.length).toBe(0);
    });
});

describe('M10 detectHookMonotony 钩子同质', () => {
    it('连续同型且措辞雷同 → 违规', () => {
        const prev = '他抬起头，看向远处漆黑的河面。原来，真正的麻烦，才刚刚开始。';
        const content = '他合上书，看向窗外的夜色。原来，这一切，才刚刚开始。';
        expect(detectHookMonotony({ content, chapterNumber: 2, prevChapterContent: prev }).violations.length).toBeGreaterThan(0);
    });
});

describe('foreshadowFeasibility 伏笔回收可行性', () => {
    it('解析第N-M章取上界', () => {
        expect(extractResolveChapter('【预期回收窗口】第25-30章左右')).toBe(30);
    });
    it('回收章超出规划总章 → 违规', () => {
        const r = checkForeshadowFeasibility({
            foreshadows: [{ name: '0001号活账', status: 'planted', expectedResolveWindow: '第25-30章' }],
            totalChapterPlan: 20,
        });
        expect(r.ok).toBe(false);
        expect(r.violations[0].expectedResolveChapter).toBe(30);
    });
    it('已回收伏笔不判违规', () => {
        const r = checkForeshadowFeasibility({
            foreshadows: [{ name: 'X', status: 'resolved', expectedResolveWindow: '第40章' }],
            totalChapterPlan: 20,
        });
        expect(r.ok).toBe(true);
    });
});
