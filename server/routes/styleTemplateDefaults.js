const store = require('../store');

const DEFAULT_STYLES = [
    {
        id: 'default-hotblood',
        name: '热血爽文',
        description: '节奏明快，爽感十足，适合升级流、争霸流',
        rules: {
            sentenceStyle: '多用短句和感叹句，节奏紧凑有力',
            paragraphStyle: '段落简短，每段2-4句，留白多',
            dialogueStyle: '对话简洁有力，少用长篇大论，多用反问和感叹',
            descriptionStyle: '场景描写点到为止，重点突出动作和冲击感',
            emotionStyle: '情绪外放，喜怒形于色，多用心理独白强化爽感',
            pacing: '快节奏，高潮密集，每章至少一个爽点',
            vocabulary: '多用力量感词汇：轰、爆、撕裂、碾压、碾压、震撼',
            forbidden: ['长篇景物描写', '冗长内心独白', '慢节奏铺垫超过500字', '配角视角超过30%']
        },
        example: '轰！一拳轰出，虚空震颤。叶尘嘴角微扬："就这点本事？"对方瞳孔骤缩——不可能！他明明已经是筑基巅峰！',
        tags: ['热血', '爽文', '快节奏']
    },
    {
        id: 'default-dark',
        name: '暗黑深沉',
        description: '氛围压抑，人性复杂，适合悬疑、末世、权谋',
        rules: {
            sentenceStyle: '长短句交错，用短句制造紧张感，长句渲染氛围',
            paragraphStyle: '段落中等长度，注重环境与心理的交织描写',
            dialogueStyle: '对话含蓄，话中有话，少说多暗示',
            descriptionStyle: '环境描写阴郁细腻，善用光影、天气暗示人物命运',
            emotionStyle: '内敛克制，情绪通过细节和行为暗示，不直白表达',
            pacing: '慢热递进，前期铺垫厚重，后期爆发凌厉',
            vocabulary: '多用阴暗冷冽词汇：阴影、沉默、冰冷、腐朽、深渊',
            forbidden: ['直白的情绪表达', '轻松幽默的对话', '过于正面的描写', '简单善恶二元']
        },
        example: '雨幕中，他站在那扇紧闭的门前，指尖触碰门锁——冰凉的金属传来一丝不属于雨水的温度。有人来过。他收回手，目光沉入更深的暗处。',
        tags: ['暗黑', '深沉', '悬疑']
    },
    {
        id: 'default-humor',
        name: '轻松幽默',
        description: '诙谐有趣，吐槽不断，适合都市、网游、日常',
        rules: {
            sentenceStyle: '口语化，善用反问、吐槽、自嘲',
            paragraphStyle: '段落活泼，善用破折号和省略号制造喜剧节奏',
            dialogueStyle: '对话为主，穿插内心吐槽，角色互动有趣',
            descriptionStyle: '描写简洁有趣，善用比喻和夸张',
            emotionStyle: '轻松为主，偶尔认真，反差萌',
            pacing: '轻松推进，笑点密集，偶尔认真',
            vocabulary: '多用网络用语和梗：离谱、绝了、离大谱、好家伙',
            forbidden: ['过于严肃的长篇描写', '沉重的心理独白', '血腥暴力细节', '过于复杂的权谋']
        },
        example: '"系统，你管这叫新手任务？"林风看着眼前三米高的史莱姆，嘴角抽搐。系统：【是的宿主，请加油哦~】——加油？这玩意儿比我房子还大好吗！',
        tags: ['幽默', '轻松', '吐槽']
    },
    {
        id: 'default-literary',
        name: '唯美文艺',
        description: '文笔优美，意境深远，适合古言、仙侠、言情',
        rules: {
            sentenceStyle: '善用排比、对偶，句式优美有韵律',
            paragraphStyle: '段落舒展，注重意境营造和画面感',
            dialogueStyle: '对话含蓄优美，善用诗词典故',
            descriptionStyle: '环境描写细腻如画，善用通感和意象',
            emotionStyle: '含蓄内敛，以景写情，留白多于直述',
            pacing: '舒缓有致，如流水行云，张弛有度',
            vocabulary: '多用雅致词汇：缱绻、蹁跹、潋滟、阑珊、浮生',
            forbidden: ['粗俗用语', '过于直白的表达', '网络用语', '暴力血腥描写']
        },
        example: '月色如水，倾泻在青石板路上。她提灯而行，裙裾蹁跹如蝶。那灯火映在她眸中，比天上的星子还要明亮几分。他立在廊下，看她渐行渐远，终是没说出那句——且留步。',
        tags: ['唯美', '文艺', '古风']
    },
    {
        id: 'default-hardcore',
        name: '硬核写实',
        description: '逻辑严密，细节扎实，适合科幻、军事、历史',
        rules: {
            sentenceStyle: '准确简洁，多用陈述句，少用修辞',
            paragraphStyle: '段落结构清晰，信息密度高',
            dialogueStyle: '对话专业简练，符合角色身份',
            descriptionStyle: '技术细节准确，数据支撑，逻辑自洽',
            emotionStyle: '克制理性，通过行为和选择展现内心',
            pacing: '稳扎稳打，每个设定都有据可查',
            vocabulary: '多用专业术语和精确描述：参数、阈值、矢量、协议',
            forbidden: ['模糊的描写', '不合理的设定', '感性过度的表达', '逻辑漏洞']
        },
        example: '反应堆温度已突破1200开尔文，距临界值还剩47秒。李明关闭了二号冷却回路，将全部功率转入磁约束系统。"足够了，"他盯着读数说道，"但只有一次机会。"',
        tags: ['硬核', '写实', '科幻']
    }
];

async function ensureDefaults() {
    for (const style of DEFAULT_STYLES) {
        const existing = await store.getItem('style-templates', style.id);
        if (!existing) {
            await store.setItem('style-templates', style.id, {
                ...style, isDefault: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
    }
}

module.exports = { DEFAULT_STYLES, ensureDefaults };
