'use strict';

/**
 * constraintModuleExtrasCraft.js — 写作技巧类约束模块（11个）
 *
 * 背景：agentSlotRegistry.js引用的22个moduleIds在constraintModuleDefs.js中缺失
 * 本文件提供后11个：show-not-tell/info-pace/chapter-closing等写作技巧类模块
 * 这些是medium/high优先级的质量提升约束
 */

function _toText(rules) {
    return (rules && rules.length > 0) ? rules.join('\n') : '';
}

const CRAFT_MODULES = {
    'show-not-tell': {
        id: 'show-not-tell', name: '展示代替告知', priority: 'medium',
        description: '用场景展示而非直接告知',
        rules: [
            '展示代替告知：用动作、对话、细节展现而非直接陈述',
            '禁止"他很生气"式直接告知，改用"他猛地拍桌"式展示',
            '情绪和性格必须通过行为细节体现'
        ],
        get text() { return _toText(this.rules); }
    },
    'info-pace': {
        id: 'info-pace', name: '信息节奏', priority: 'medium',
        description: '信息释放节奏控制',
        rules: [
            '信息释放必须分层次，禁止一次性倾倒',
            '关键信息必须通过剧情推进逐步揭露',
            '每章只揭示1-2个关键信息点'
        ],
        get text() { return _toText(this.rules); }
    },
    'chapter-closing': {
        id: 'chapter-closing', name: '章节收尾', priority: 'medium',
        description: '章节结尾技巧',
        rules: [
            '每章结尾必须设置钩子或悬念',
            '禁止平淡收尾，必须有情绪张力',
            '结尾必须引出下一章的期待'
        ],
        get text() { return _toText(this.rules); }
    },
    'anti-hallucination': {
        id: 'anti-hallucination', name: '反幻觉', priority: 'high',
        description: '防止内容幻觉',
        rules: [
            '禁止编造未建立的角色关系',
            '禁止引入未在素材库中的设定',
            '所有引用必须可追溯'
        ],
        get text() { return _toText(this.rules); }
    },
    'anti-routine': {
        id: 'anti-routine', name: '反套路', priority: 'medium',
        description: '避免常见套路',
        rules: [
            '禁止使用常见网文套路（废柴逆袭、天才陨落等）',
            '剧情转折必须有合理铺垫',
            '禁止机械式打脸剧情'
        ],
        get text() { return _toText(this.rules); }
    },
    'natural-ability': {
        id: 'natural-ability', name: '能力自然化', priority: 'medium',
        description: '能力展现自然化',
        rules: [
            '能力提升必须有合理过程，禁止跳跃式升级',
            '新能力必须有获取铺垫',
            '能力使用必须有代价或限制'
        ],
        get text() { return _toText(this.rules); }
    },
    'paragraph-rhythm': {
        id: 'paragraph-rhythm', name: '段落节奏', priority: 'medium',
        description: '段落长短节奏控制',
        rules: [
            '段落长短交替，禁止全部长段或全部短段',
            '战斗场景用短句快节奏，描写场景用长句慢节奏',
            '每段不超过5行'
        ],
        get text() { return _toText(this.rules); }
    },
    'style-genre-adapt': {
        id: 'style-genre-adapt', name: '风格题材适配', priority: 'medium',
        description: '风格适配题材',
        rules: [
            '写作风格必须适配题材（玄幻热血/都市冷峻等）',
            '语言风格必须符合styleProfile定义',
            '禁止题材错位（玄幻用都市用语等）'
        ],
        get text() { return _toText(this.rules); }
    },
    'fast-pace': {
        id: 'fast-pace', name: '快节奏', priority: 'medium',
        description: '节奏推进',
        rules: [
            '剧情必须持续升级，禁止原地踏步',
            '每章必须有明确进展',
            '禁止冗长的铺垫和过渡'
        ],
        get text() { return _toText(this.rules); }
    },
    'anti-tool-character': {
        id: 'anti-tool-character', name: '反工具人化', priority: 'high',
        description: '配角反工具人化',
        rules: [
            '配角必须有独立动机，不能只为推动主角剧情而存在',
            '每个出场配角至少展现1个独立于主角的特质',
            '禁止配角只说"是""好的""主人英明"等工具性台词'
        ],
        get text() { return _toText(this.rules); }
    },
    'output-novel': {
        id: 'output-novel', name: '小说输出格式', priority: 'critical',
        description: '小说正文输出格式',
        rules: [
            '输出格式：纯文本章节正文',
            '禁止输出大纲、摘要、分析等非正文内容',
            '章节标题单独一行，正文从下一行开始'
        ],
        get text() { return _toText(this.rules); }
    }
};

module.exports = { CRAFT_MODULES };
