'use strict';

/**
 * T0元约束定义（Meta-Constraint Specification）
 *
 * 设计原则：1个元约束覆盖10+个词级约束
 * 300万字长篇不退化：约束词总量受控，检测靠模式识别
 *
 * 注意：threshold/detectionFn的单一数据源是 constraintDetectionConfig.js
 *      本文件只定义prompt文本和覆盖范围描述，不重复定义阈值
 *
 * 详见 SOP: docs/sop/08-约束执行规范.md
 */

const { getConfig } = require('./constraintDetectionConfig');

const META_CONSTRAINTS = Object.freeze({
    M1: {
        id: 'M1',
        label: '禁止比喻词替代感官',
        description: '禁止用比喻词/程度副词/量词堆砌替代具体感官描写',
        coveredWordConstraints: [
            '仿佛', '宛如', '似乎', '不禁', '一抹', '不由', '一丝', '一缕',
            '犹如', '恰似', '宛若', '好似', '好像', '一如', '恍若', '像是',
            '情不自禁', '不由自主', '默默', '静静', '缓缓', '淡淡', '微微',
        ],
        detectionMode: 'pattern',
        detectionFn: 'detectMetaphorSubstitution',
        block: true,
        promptText: `【M1·感官落地】禁止用比喻词/程度副词/量词堆砌替代具体感官描写。
- 禁止模式：[比喻词]+[抽象名词]（如"仿佛时间静止""宛如深渊"）
- 禁止模式：[程度副词]+[动词]（如"不禁叹气""不由皱眉"）
- 禁止模式：[量词]+[抽象名词]（如"一丝笑意""一抹寒意"）
- 正确写法：用具体动作/感官细节/环境反应替代（如"嘴角向上牵动0.5厘米，瞳孔收缩"替代"一抹笑意"）`,
    },
    M2: {
        id: 'M2',
        label: '冲突模式去重',
        description: '每章冲突解决方式必须与前N章不同（N=⌊章节号/10⌋+1）',
        coveredWordConstraints: [
            '机械式打脸', '被动出手→意外效果→装逼收工', '废柴逆袭',
            '天才陨落', '扮猪吃虎',
        ],
        detectionMode: 'pattern',
        detectionFn: 'detectConflictPatternRepeat',
        block: true,
        promptText: `【M2·冲突去套路】每章冲突解决方式必须与前N章不同（N=⌊章节号/10⌋+1）。
- 禁止模式：连续N章使用"被动出手→意外效果→装逼收工"
- 禁止模式：连续N章使用"废柴被嘲讽→展露实力→打脸"
- 必须变化维度：冲突类型（物理/智斗/情感/资源）/解决方（主角/配角/环境）/结局走向（胜/败/和/悬念）`,
    },
    M3: {
        id: 'M3',
        label: '章节衔接强制',
        description: '本章开头必须承接前一章结尾的最后场景/动作/对话',
        coveredWordConstraints: ['章节断裂', '衔接突兀', '开头跳跃', '上下文不连贯'],
        detectionMode: 'pattern',
        detectionFn: 'detectChapterCoherence',
        block: true,
        promptText: `【M3·章节衔接】本章开头必须承接前一章结尾的最后场景/动作/对话。
- 禁止：开头回到前章已结束的冲突
- 禁止：开头突然穿越/切换场景而无过渡
- 必须：开头第一段回应前章结尾的悬念/动作/对话
- 第1章例外：无需承接（新项目起始章）`,
    },
    M4: {
        id: 'M4',
        label: '禁止抽象抒情',
        description: '禁止用抽象抒情/哲学概括替代具体场景',
        coveredWordConstraints: [
            '时间仿佛静止', '空气凝固', '这就是命运', '命运的齿轮',
            '历史的洪流', '无言的震撼', '一切尽在不言中',
        ],
        detectionMode: 'pattern',
        detectionFn: 'detectAbstractSentiment',
        block: true,
        promptText: `【M4·具象落地】禁止用抽象抒情/哲学概括替代具体场景。
- 禁止模式：[抽象时间]+[静止/凝固/停止]（如"时间仿佛静止"）
- 禁止模式：[命运/历史/世界]+[洪流/齿轮/必然]（如"命运的齿轮转动"）
- 禁止模式：[无言/沉默]+[震撼/感悟/一切]（如"一切尽在不言中"）
- 正确写法：用具体感官反应替代（如"他盯着断剑三秒没说话，指节发白"替代"无言的震撼"）`,
    },
    M5: {
        id: 'M5',
        label: '配角反工具人',
        description: '配角必须展现独立于主角的动机/特质',
        coveredWordConstraints: ['工具人', '只说是/好的', '无独立动机', '配角扁平'],
        detectionMode: 'pattern',
        detectionFn: 'detectToolCharacter',
        block: true,
        promptText: `【M5·配角立体】配角必须展现独立于主角的动机/特质。
- 禁止：配角台词只回应"是""好的""遵命"等工具性台词
- 禁止：配角行为只为衬托主角而存在
- 必须：配角有独立目标/恐惧/偏好/与主角的分歧
- 工具性台词占比<50%`,
    },
    M6: {
        id: 'M6',
        label: '张力处禁止玩梗',
        description: '紧张/悲壮场景禁止用玩梗、抖机灵、现代梗消解张力',
        coveredWordConstraints: ['生死关头讲笑话', '段尾俏皮话', '紧张处插科打诨', '网络梗乱入'],
        detectionMode: 'pattern',
        detectionFn: 'detectBanterDeflation',
        block: true,
        promptText: `【M6·张力不可消解】紧张/危机/悲壮场景禁止玩梗与抖机灵。
- 禁止：高张力句（死亡/流血/追杀/剧痛）之后紧接现代梗或俏皮话收尾
- 禁止：用"差评/KPI/加班/客服/进度条/开挂"等现代词在紧张处制造笑点
- 允许：日常/过渡场景玩梗；紧张场景笑点降至0-1处，且只能是冷面内心OS，不得泄掉张力
- 幽默的正确来源：世界观内行话的错位，而非把现代网络语境塞进古代生死场`,
    },
    M7: {
        id: 'M7',
        label: '禁止升华收尾',
        description: '禁止用抽象抒情/宏大拔高/套话钩子做段末与章末收尾',
        coveredWordConstraints: ['渺小却无处不在', '才刚刚开始', '久久挥之不去', '这才是真谛', '融入画卷'],
        detectionMode: 'pattern',
        detectionFn: 'detectAbstractEnding',
        block: true,
        promptText: `【M7·结尾须落地】段末与章末禁止抽象升华。
- 禁止结尾：渺小/浩瀚/融入画卷/终将/注定/这才是真谛/而这一切
- 禁止套话钩子："真正的麻烦才刚刚开始""故事才刚刚开始"
- 禁止情绪概括：久久挥之不去/难以言喻/莫名的/无声地
- 正确写法：用具体动作或物件收尾（他把半截笔杆塞进袖口／暗纹收缩／齿轮咬合声贴上边界）`,
    },
    M8: {
        id: 'M8',
        label: '章首承接压力值',
        description: '本章开头必须承接上一章结尾的情绪压力（不只是场景）',
        coveredWordConstraints: ['上章生死威胁被遗忘', '情绪断档', '两章像两本书', '危机感蒸发'],
        detectionMode: 'pattern',
        detectionFn: 'detectEmotionalContinuity',
        block: true,
        promptText: `【M8·情绪衔接】本章开头必须承接上一章结尾的压力值，而非只承接场景。
- 禁止：上章结尾生死威胁/重大失去，本章开头对此毫无心理余温
- 禁止：上章结尾的钩子在本章开头被完全遗忘
- 必须：开头300字内体现上章结尾的高压仍在延续，或明确交代其被消化
- 与M3区别：M3管场景/动作是否衔接，M8管情绪/威胁是否衔接`,
    },
    M9: {
        id: 'M9',
        label: '意象禁止跨章复用',
        description: '比喻意象不得在近章中逐字复用',
        coveredWordConstraints: ['同一比喻反复使用', '蝉鸣式复用', '陈年腐臭堆砌', '意象疲劳'],
        detectionMode: 'pattern',
        detectionFn: 'detectMotifReuse',
        block: true,
        promptText: `【M9·意象唯一】比喻意象全书尽量只用一次，禁止在近章中复用。
- 禁止：同一比喻/喻体在2章内逐字重复（同一地点应写"它变了什么"，而非复用初次的描写）
- 禁止：高频复用同一组感官词（陈年/腐烂/酸臭/霉）
- 正确写法：同一场景第二次出现，写它的变化与新增细节，而非复制首访描写`,
    },
    M10: {
        id: 'M10',
        label: '章末钩子去同质',
        description: '章末钩子类型必须轮换，禁止连续两章同型',
        coveredWordConstraints: ['每章都是真正的麻烦才刚开始', '钩子同质化', '结尾套话'],
        detectionMode: 'pattern',
        detectionFn: 'detectHookMonotony',
        block: false,
        promptText: `【M10·钩子轮换】章末钩子类型必须轮换，禁止连续两章同型。
- 钩子类型：危险钩 / 信息钩 / 抉择钩 / 反转钩 / 代价钩 / 留白钩
- 禁止：连续两章都用"危险逼近"型，或都用"真正麻烦才刚开始"式套话
- 必须：与前章钩子类型不同，且落点为具体物件或动作`,
    },
});

const META_CONSTRAINT_IDS = Object.freeze(Object.keys(META_CONSTRAINTS));

function getMetaConstraint(id) {
    return META_CONSTRAINTS[id] || null;
}

function getMetaConstraintsForPrompt() {
    return META_CONSTRAINT_IDS.map(id => META_CONSTRAINTS[id].promptText).join('\n\n');
}

function getMetaConstraintDetectionSpec(id) {
    const c = META_CONSTRAINTS[id];
    if (!c) return null;
    const detectionConfig = getConfig(id);
    return {
        id: c.id,
        detectionFn: c.detectionFn,
        threshold: detectionConfig?.threshold ?? 0,
        block: c.block,
    };
}

module.exports = {
    META_CONSTRAINTS,
    META_CONSTRAINT_IDS,
    getMetaConstraint,
    getMetaConstraintsForPrompt,
    getMetaConstraintDetectionSpec,
};
