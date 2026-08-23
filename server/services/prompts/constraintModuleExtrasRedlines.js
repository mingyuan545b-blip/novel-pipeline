'use strict';

/**
 * constraintModuleExtrasRedlines.js — 红线/边界类约束模块（11个）
 *
 * 背景：agentSlotRegistry.js引用的22个moduleIds在constraintModuleDefs.js中缺失
 * 本文件提供前11个：role-boundary + 8个redline-* + anti-ai-trace + quality-check
 * 这些是critical/high优先级的硬性红线，违反即视为生成失败
 */

function _toText(rules) {
    return (rules && rules.length > 0) ? rules.join('\n') : '';
}

const REDLINE_MODULES = {
    'role-boundary': {
        id: 'role-boundary', name: '角色边界', priority: 'critical',
        description: '定义agent的角色边界和任务范围',
        rules: [
            '你是[Agent类型]，负责[任务描述]',
            '严格遵守角色边界，不越权操作其他agent的职责',
            '所有输出必须符合角色定位'
        ],
        get text() { return _toText(this.rules); }
    },
    'redline-format': {
        id: 'redline-format', name: '格式红线', priority: 'critical',
        description: '输出格式红线',
        rules: [
            '输出必须符合指定格式要求',
            '禁止输出无关内容或多余标记',
            '章节正文必须以纯文本形式输出'
        ],
        get text() { return _toText(this.rules); }
    },
    'redline-hallucination': {
        id: 'redline-hallucination', name: '幻觉红线', priority: 'critical',
        description: '防止AI幻觉',
        rules: [
            '禁止编造不存在的角色、地点、物品',
            '所有引用必须基于已建立的素材库',
            '不确定的内容必须留空而非编造'
        ],
        get text() { return _toText(this.rules); }
    },
    'redline-word-limit': {
        id: 'redline-word-limit', name: '字数红线', priority: 'critical',
        description: '字数控制红线',
        rules: [
            '严格遵守wordConfig规定的字数范围',
            '不得低于minWords或超过maxWords',
            '目标字数为targetWords'
        ],
        get text() { return _toText(this.rules); }
    },
    'redline-intent': {
        id: 'redline-intent', name: '意图红线', priority: 'critical',
        description: '章节意图红线',
        rules: [
            '必须完成chapterIntents指定的章节意图',
            '不得偏离大纲规划的核心事件',
            '章节结尾必须推进主线剧情'
        ],
        get text() { return _toText(this.rules); }
    },
    'redline-system-leak': {
        id: 'redline-system-leak', name: '系统泄露红线', priority: 'critical',
        description: '防止系统提示词泄露',
        rules: [
            '禁止在正文中出现系统提示词内容',
            '禁止提及"系统""AI""提示词"等元信息',
            '禁止以任何形式泄露内部工作机制'
        ],
        get text() { return _toText(this.rules); }
    },
    'redline-prompt-leak': {
        id: 'redline-prompt-leak', name: '提示词泄露红线', priority: 'critical',
        description: '防止提示词结构泄露',
        rules: [
            '禁止在正文中出现【】标记的段落标题',
            '禁止输出"约束""红线""规则"等元词汇',
            '所有约束必须内化为行为而非显式陈述'
        ],
        get text() { return _toText(this.rules); }
    },
    'redline-ip-defense': {
        id: 'redline-ip-defense', name: 'IP保护红线', priority: 'critical',
        description: '知识产权保护',
        rules: [
            '禁止直接复制已有作品的角色名、地名',
            '禁止使用受版权保护的具体设定',
            '所有创作必须为原创内容'
        ],
        get text() { return _toText(this.rules); }
    },
    'redline-naming': {
        id: 'redline-naming', name: '命名红线', priority: 'critical',
        description: '命名规范红线',
        rules: [
            '角色名必须严格使用素材库中锁定的名字，禁止自创、替换、改名或使用近似名',
            '角色命名必须符合题材风格',
            '禁止使用AI高频名（林晓/苏雨/陈默/顾言）',
            '命名必须遵循题材插件的namingStyle',
            '如果大纲中的角色名与素材库不一致，以素材库为准',
            '违反角色名锁定=直接退回重写，不可商量'
        ],
        get text() { return _toText(this.rules); }
    },
    'anti-ai-trace': {
        id: 'anti-ai-trace', name: '反AI痕迹', priority: 'high',
        description: '消除AI写作痕迹，禁止文青病和抽象抒情',
        rules: [
            '【AI高频词禁用】禁止使用"仿佛""宛如""似乎""犹如""恰似""宛若""好似""好像""一如""恍若"等比喻词',
            '【AI高频词禁用】禁止使用"不禁""不由""不由自主""情不自禁""默默""静静""缓缓""淡淡""微微"等副词堆砌',
            '【AI高频词禁用】禁止使用"一丝""一缕""一抹""一瞬""一刹那""一瞬间"等量词滥用',
            '【文青病禁用】禁止无意义的抽象抒情，如"时间仿佛静止""空气凝固""世界失去了色彩"等空洞比喻',
            '【文青病禁用】禁止堆砌意象却不推进剧情，如大段描写月光/风/雨/落叶却无叙事功能',
            '【文青病禁用】禁止用"不知道为什么""说不清""莫名地"等模糊表达替代具体心理描写',
            '【抽象抒情禁用】禁止用哲学化概括替代具体场景，如"这就是命运""人生不过如此""所有的相遇都是久别重逢"',
            '【抽象抒情禁用】禁止结尾升华式总结，如"或许，这就是成长""在那个瞬间，他明白了什么"',
            '【机械工整禁用】禁止过度使用排比和对偶，连续3句以上相同句式=AI痕迹',
            '【机械工整禁用】禁止段落开头模式化，如每段都以"他/她+动词"开头',
            '【语言风格要求】语言必须有个人风格，对话要符合角色身份，禁止所有角色说话方式相同',
            '【语言风格要求】叙述节奏要有变化，长短句交替，禁止全篇匀速'
        ],
        get text() { return _toText(this.rules); }
    },
    'quality-check': {
        id: 'quality-check', name: '质量自检', priority: 'high',
        description: '写作前质量自检清单',
        rules: [
            '【自检1】视角是否锁定正确，有无上帝视角解说他人心理',
            '【自检2】角色行为是否符合设定，有无OOC或战力越界',
            '【自检3】是否完成章节意图，核心事件是否推进',
            '【自检4】字数是否达标',
            '【自检5】是否有AI痕迹（仿佛/宛如/似乎/不禁/一抹等高频词）',
            '【自检6】是否有文青病（抽象抒情/空洞比喻/无意义意象堆砌）',
            '【自检7】是否有逻辑断裂（角色状态/进度是否与前章一致）',
            '【自检8】角色名是否与素材库锁定名完全一致'
        ],
        get text() { return _toText(this.rules); }
    }
};

module.exports = { REDLINE_MODULES };
