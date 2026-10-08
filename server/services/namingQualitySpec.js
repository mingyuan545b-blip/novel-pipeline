'use strict';

/**
 * namingQualitySpec — 命名质量标准（可判定 + 可按时代风格取法）
 *
 * 目的（用户反馈 2026-10-08）：新项目不许再出现"萧炎/龙傲天/沈砚/顾清寒/柳如烟"式烂大街名，
 *   名字要按**时代背景与风格**去取；参考《墓王之王》的取法（骆时秋/寒千落/风满楼/烛九阴/陈梦飞/齐庆疾/南锦屏）。
 * 单一数据源：禁用名单/流水线正则/时代取法/判定三问/prompt 块都在本文件。
 * 依据：docs/sop/12-创作工艺与反AI化规范.md §8.3；docs/design/角色编年史升级-多维分层与素材质检.md §十
 */

/** 禁用名：① 网文烂梗 ② AI 高频 ③ 本流水线历史项目复用名 */
const BANNED_NAMES = Object.freeze([
    '萧炎', '龙傲天', '叶凡', '韩立', '唐三', '石昊', '林动', '叶辰', '楚风', '萧晨', '苏铭', '罗峰',
    '柳如烟', '白浅', '夜华', '苏沐橙', '沈浪', '独孤求败', '西门吹雪', '东方不败',
    '林晓', '苏雨', '陈默', '顾言', '苏瑶', '林夕', '李默', '王浩', '张伟', '李强', '刘洋',
    '沈砚', '顾清寒', '柳三娘', '茅十七', '陆野', '沈星晚', '岑野', '林婉', '席准',
]);

/** 流水线名：高频姓 x 高频美字的机械拼接（"顾清寒"式） */
const CLICHE_PATTERNS = Object.freeze([
    { re: /^[顾苏林叶沈萧][清寒云雪墨尘轩然若烟雨灵逸]$/, why: '高频姓+高频美字拼接（顾清寒式）' },
    { re: /^[顾苏林叶沈萧秦楚云风凌白墨陆][辰逸轩墨渊尘昊衍玄泽天]$/, why: '玄幻流水线名（姓+单字美字）' },
    { re: /(清寒|若雪|如烟|轻语|墨言|冷月|孤尘|无双|天骄|傲天)$/, why: '网文高频后缀' },
    { re: /^(慕容|上官|东方|南宫|欧阳|独孤)(轩|婉|白|雪|云|风|天)$/, why: '复姓套餐式命名' },
]);

/** 判定三问：全过才算好名字 */
const NAME_TESTS = Object.freeze([
    { id: 'era', name: '时代感', desc: '念出来像那个时代/阶层的人吗（民国不会有"龙傲天"，宗门不会有"张伟"）' },
    { id: 'unique', name: '无同款', desc: '有没有第二个同款（"X清寒""X如烟"一出场就是模板角色）' },
    { id: 'inferable', name: '可反推身份', desc: '名字能否反推身份/阶层/气质（世家子/散修/市井/异族）' },
]);

/**
 * 时代/风格取法。示例取法参考《墓王之王》：意象姓（寒千落/风满楼）、
 * 有出处的字（骆时秋/南锦屏）、志怪式异名（烛九阴）——共同点是**名字带画面与身份**，不是美字堆砌。
 */
const ERA_GUIDES = Object.freeze({
    xianxia: {
        label: '仙侠玄幻', era: '修行宗门/古风',
        principle: '名字要有"出处感"与身份层级：宗门弟子雅、散修野、世家贵、魔道阴，不一锅炖。避免"姓+云/雪/尘/轩"流水线。',
        goodExamples: ['骆时秋', '南锦屏', '陈梦飞', '齐庆疾', '风满楼'],
        badExamples: ['叶辰', '萧炎', '慕容轩', '顾清寒'],
        tips: ['道号另起（玄清真人），本名照常取', '散修可只给绰号（老疯子/酒剑仙）', '复姓少用，用则配单字冷名'],
    },
    wuxia: {
        label: '武侠江湖', era: '江湖/门派',
        principle: '绰号即人设，名字要有画面（动词+名词：听风/踏月/满楼），比堆形容词强。',
        goodExamples: ['风满楼', '骆时秋', '齐庆疾', '寒千落'],
        badExamples: ['独孤求败', '西门吹雪', '东方不败'],
        tips: ['先起绰号再配名', '市井角色用土名（铁拐李/老疯子）', '门派弟子可用排行+法号'],
    },
    zhiguai: {
        label: '志怪灵异', era: '民国/古志怪',
        principle: '名字可以"不像人名"：意象姓＋异字（烛九阴式），但要能听出归属（人/异族/器物）。',
        goodExamples: ['烛九阴', '寒千落', '南锦屏'],
        badExamples: ['苏瑶', '林晓', '陈默'],
        tips: ['异族/器物名用单字古字（烛/冥/砚）', '人类角色反而要朴素，形成对比', '民国背景用时代语汇（先生/掌柜）'],
    },
    minguo: {
        label: '民国近现代', era: '民国',
        principle: '用当时真实存在的取名习惯：排行字、字辈、职业化称呼；禁一切仙侠味美字。',
        goodExamples: ['陈梦飞', '骆时秋', '齐庆疾'],
        badExamples: ['顾清寒', '柳如烟', '叶辰'],
        tips: ['男名常见"伯/仲/叔/季"或"文/章/甫"', '女名偏素（秀/珍/静）而非"若雪"', '江湖人可用花名'],
    },
    urban: {
        label: '都市现代', era: '当代',
        principle: '像真人的名字：重名率高但真实，别取"偶像剧名"。',
        goodExamples: ['张磊', '李慧', '周文甫'],
        badExamples: ['顾清寒', '林晓', '苏雨'],
        tips: ['按出生年代取名（80/90/00 各有流行字）', '反派也用工整的普通名，更有压迫感'],
    },
    'western-fantasy': {
        label: '西幻', era: '欧陆',
        principle: '按语言体系成组取名（同一国的人名要同源），别中西混搭。',
        goodExamples: ['艾德温·科尔', '塞琳·瓦尔'],
        badExamples: ['龙傲天', '叶辰'],
        tips: ['贵族用长名+家族名，平民用短名', '神职/骑士团用教名'],
    },
    scifi: {
        label: '科幻未来', era: '未来',
        principle: '名字要反映文明形态：编号名、代号名、音译名，少用古风美字。',
        goodExamples: ['K-7', '织羽', '铁雷'],
        badExamples: ['顾清寒', '萧炎'],
        tips: ['底层用编号/绰号，上层用长音节名', '中文名保留但去掉仙侠用字'],
    },
});

const ERA_ALIASES = Object.freeze({
    xianxia: ['xuanhuan', 'xianxia', 'cultivation', 'fantasy', 'high-martial', '修仙', '玄幻', '仙侠'],
    wuxia: ['wuxia', 'jianghu', '武侠', '江湖'],
    zhiguai: ['horror', 'zhiguai', 'supernatural', '灵异', '志怪', '民俗'],
    minguo: ['minguo', 'republic', '近代', '民国'],
    urban: ['urban', 'modern', 'city', '都市', '现代'],
    'western-fantasy': ['western', 'europe', '西幻', '欧陆'],
    scifi: ['scifi', 'sci-fi', 'space', '科幻'],
});

/** 由题材 id 推断时代/风格键 */
function inferEraKey(genreId) {
    const g = String(genreId || '').toLowerCase();
    if (!g) return 'xianxia';
    for (const [key, aliases] of Object.entries(ERA_ALIASES)) {
        if (aliases.some(a => g.includes(a))) return key;
    }
    return 'xianxia';
}

/** 校验单个名字：返回 { valid, issues[] } */
function validateName(name, eraKey) {
    const raw = String(name || '').trim();
    if (!raw) return { valid: false, issues: ['空名字'], eraKey: eraKey || '' };
    const key = ERA_GUIDES[eraKey] ? eraKey : inferEraKey(eraKey);
    const core = raw.split(/[\u00b7\s]/)[0];
    const issues = [];
    if (BANNED_NAMES.includes(core)) issues.push('"' + core + '"在禁用名单（烂大街/已被用滥）');
    for (const p of CLICHE_PATTERNS) {
        if (p.re.test(core)) { issues.push('"' + core + '"命中流水线命名：' + p.why); break; }
    }
    if (/^[\u4e00-\u9fa5]{3,4}$/.test(core)) {
        const given = core.slice(1);
        if (given.length >= 2 && /^[清寒云雪墨尘轩然若烟雨灵逸辰昊渊玄泽天]+$/.test(given)) {
            issues.push('"' + core + '"两字全用高频美字，缺画面与身份');
        }
    }
    return { valid: issues.length === 0, issues, eraKey: key };
}

/** 批量校验 */
function validateNames(names, eraKey) {
    const list = Array.isArray(names) ? names : [];
    const failed = [];
    list.forEach((n, index) => {
        const r = validateName(n, eraKey);
        if (!r.valid) failed.push({ index, name: n, issues: r.issues });
    });
    return { valid: failed.length === 0, total: list.length, failed };
}

/** 生成命名指导块（注入素材生成 / 人物设计 / 写作 prompt） */
function buildNamingGuidance(eraKey) {
    const key = ERA_GUIDES[eraKey] ? eraKey : inferEraKey(eraKey);
    const g = ERA_GUIDES[key];
    return [
        '【命名标准·' + g.label + '（' + g.era + '）】',
        '取法：' + g.principle,
        '可用示例（学取法，不要照抄）：' + g.goodExamples.join('、'),
        '反面示例（禁止）：' + g.badExamples.join('、'),
        '细则：' + g.tips.join('；'),
        '【禁用名（出现即不合格）】' + BANNED_NAMES.join('、'),
        '【命名三问·逐个自检】' + NAME_TESTS.map(t => t.name + '=' + t.desc).join('；'),
        '【禁止】转换器式拼名（高频姓+清/寒/云/雪/轩），禁止同一项目内名字重字率高，禁止与已有角色同款后缀。',
    ].join('\n');
}

module.exports = {
    BANNED_NAMES, CLICHE_PATTERNS, NAME_TESTS, ERA_GUIDES,
    inferEraKey, validateName, validateNames, buildNamingGuidance,
};
