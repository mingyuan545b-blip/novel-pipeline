/**
 * branchMetaverse.js — 分支C：游戏化元宇宙
 *
 * 世界本质：万界是元宇宙/游戏化结构，有面板/任务/副本。
 * 但用荒诞方式呈现，偏轻小说网游流。debug是利用游戏机制BUG。
 */
module.exports = {
    key: 'metaverse',
    label: '游戏化元宇宙',
    worldviewCore: '万界是某种元宇宙/游戏化结构，世界运行像游戏：有面板、任务、副本、活动、排行榜。但呈现方式荒诞离谱——面板会报错、任务描述词不达意、副本机制自相矛盾、活动奖励随心情波动。修士本质是"玩家"，飞剑是"外挂装备"，境界是"等级"。主角通过键盘飞剑卡游戏机制BUG。',

    powerSystem: {
        concept: '角色等级+装备+技能',
        levels: ['Lv1-9(新手村)', 'Lv10-29(正式玩家)', 'Lv30-59(精英玩家)', 'Lv60-89(高端玩家)', 'Lv90+(传奇玩家)'],
        description: '强弱看角色等级+装备+技能组合，但所有数值都荒诞化呈现（"你的等级是Lv5，但系统显示你比Lv50还摸鱼"）。等级提升通过刷副本/完成任务/卡BUG获得经验值。',
        stackingRule: '等级提升需积累经验值，禁止跨级（Lv5不能直接Lv90）。允许通过"卡BUG"实现"越级挑战"（低等级打高等级怪），但需符合逻辑链：发现机制BUG→分析漏洞→构造卡BUG路径→执行。禁止无脑平推也禁止凭空升级。',
        term: '等级'
    },

    planeConcept: {
        term: '副本',
        alternativeTerms: ['活动关卡', '限时世界', '特殊场景'],
        description: '万界中的副本/活动关卡/限时世界，进入有次数限制和时间限制。副本内规则可能与正式服不同（像素风/低分辨率/异常机制），通关副本可获得经验值和装备。',
        constraint: '副本是debug的刷怪场，主角在副本内可自由探索机制BUG，但副本内获得的"装备"回到正式服后受等级压制（低等级无法装备高等级装备）。每位面限掠夺一次改为：每个副本限刷一次首通奖励。'
    },

    mentorConcept: {
        term: 'NPC管理员',
        alternativeTerms: ['活动引导员', '系统NPC', '客服小妹'],
        description: '游戏内的NPC管理员/活动引导员，以NPC形式存在。他们有预设台词和行为脚本，偶尔会"出BUG"说出超出脚本的话（暗示他们有自我意识）。NPC管理员不能直接帮助主角，只能通过"系统提示"和"任务引导"间接指引。'
    },

    namingStyle: {
        style: 'game-id-style',
        rule: '命名采用游戏ID风格：玩家昵称/角色代号/服务器前缀。禁用古风雅称（渊鳞/缄默/守正），禁用网文烂梗。主角用游戏ID，配角用NPC代号。',
        examples: {
            protagonist: '苏沉（ID：suChen_摸鱼大师，谐音"速成"）',
            supporting: '周大壮（NPC：ShieldBro_盾哥，肉盾定位）、赵扒皮（NPC：ResourceTroll_资源怪）、老铁（ID：IronBro_铁哥们）',
            antagonist: '李长风（ID：longWind_冗长低效）、王占用（ID：ResourceHog_占用狂）',
            plane: '沉默之域→Server_silent_07、青青草原→Event_greenField、铁臂穹城→Dungeon_ironDome'
        }
    },

    toneStyle: '网文网游流+荒诞系统播报+弹幕式吐槽。幽默来源：1.主角用玩家思维解构修真世界（"这副本机制比我玩的MMO还烂"）；2.系统播报的荒诞感（"恭喜玩家苏沉完成隐藏成就：摸鱼一整天"）；3.副本规则与正式服的错位（"这副本怎么强制PVP了"）；4.配角对主角卡BUG行为的误解（"他刚才对着空气戳了几下，BOSS就消失了"）。文风轻快，弹幕式吐槽+网游黑话。',

    extraConstraints: [
        {
            id: 'level-system',
            label: '等级装备体系',
            desc: '战力体系用角色等级+装备+技能组合，但所有数值荒诞化呈现。等级提升需积累经验值/卡BUG/系统授权，禁止凭空升级。低等级打高等级怪需通过"卡BUG"逻辑链（发现机制BUG→分析→构造路径→执行）。'
        },
        {
            id: 'bug-driven-plot',
            label: '机制BUG驱动剧情',
            desc: '剧情推进以游戏机制BUG为核心：发现机制BUG→分析漏洞→卡BUG/利用→获得经验值/等级提升。每个副本必须存在至少1个核心机制BUG，主角的目标是卡该BUG。禁止无BUG的纯打斗章节。'
        },
        {
            id: 'no-cultivation-terms',
            label: '禁用传统修仙术语',
            desc: '禁用：练气/筑基/金丹/元婴/化神/境界/修为/灵力/功法/法宝/丹药/宗门/境界突破。替代：等级/经验值/装备/技能/副本/任务/活动/成就/排行榜。修士→玩家，宗门→公会，飞剑→外挂装备，功法→技能树。'
        },
        {
            id: 'game-mechanic',
            label: '键盘飞剑外挂机制',
            desc: '键盘飞剑作为外挂装备，每个"键位"对应一种外挂功能：F7=删除道具/任务，Home=查看BOSS血量，Ctrl+C=复制技能，Ctrl+V=粘贴技能，Esc=退出副本，Delete=强制下线BOSS，Enter=确认交易。键位功能受等级限制（低等级无法使用高级外挂）。键位组合可产生复合外挂。'
        }
    ],

    extraFoundationRules: [
        '铁律C1（等级硬约束）：角色等级不可跨越。Lv5不能直接Lv90，必须积累经验值或通过"卡BUG"逻辑链实现。卡BUG需符合：发现机制BUG→分析漏洞→构造卡BUG路径→执行，禁止凭空升级或无脑平推。',
        '铁律C2（机制BUG驱动）：每个副本必须存在至少1个核心机制BUG。主角目标是卡该BUG，通过卡BUG获得经验值/等级提升。禁止无BUG的纯打斗章节，禁止BUG无逻辑修复。',
        '铁律C3（术语红线）：禁用传统修仙术语（练气/筑基/金丹/境界/修为/灵力/功法/法宝/丹药/宗门）。必须用游戏术语替代（等级/经验值/装备/技能/副本/任务/活动/成就/排行榜）。修士→玩家，宗门→公会，飞剑→外挂装备，功法→技能树。',
        '铁律C4（外挂机制）：键盘飞剑作为外挂装备，每个键位对应一种外挂功能，功能受等级限制。键位组合可产生复合外挂。每个键位的"代价"是消耗经验值或触发反作弊检测，不是传统修仙的"反噬/冷却"。'
    ],

    styleProfileOverrides: {
        key: 'metaverse-debug-comedy',
        label: '元宇宙debug·反套路喜剧',
        // 陷阱#73修复：必须覆盖以下4字段，否则仍用武侠.json的nostalgic-elder/jianghu-epithet/苍劲豪迈/martial-ascension
        systemPersona: 'afk-player',
        namingStyle: 'game-id-style',
        tone: '荒诞系统播报+弹幕式吐槽',
        worldviewTemplate: 'metaverse-game',
        povRule: '紧贴男主"摸鱼玩家+吐槽役"视角。描写轻快弹幕式。正式服侧重等级冲突与公会碰撞（用对话和动作推进），副本以机制BUG或男主主观体验呈现，严禁全知解说。',
        behaviorRule: '主角行动遵循"发现机制BUG→分析漏洞→构造卡BUG方案→执行"循环。卡BUG后不描写反噬，但需展现"外挂适配/机制利用"的逻辑链。配角行为必须有完整前因后果，禁止工具人化。',
        toneRule: '搞笑是核心不是点缀。幽默来源：1.主角用玩家思维解构修真世界；2.系统播报的荒诞感；3.副本规则与正式服的错位；4.配角对主角卡BUG行为的误解。文风轻快，弹幕式吐槽+网游黑话。',
        characterRefRules: '命名采用游戏ID风格，禁用古风雅称和网文烂梗。对话中避免现代互联网低质热梗，幽默需贴合网游语境。'
    },

    genreBaseOverrides: {
        BEHAVIOR_APPEND: '主角所有决策必须经过"发现机制BUG→分析漏洞→构造方案→执行卡BUG"逻辑链。等级提升需积累经验值或通过卡BUG逻辑链实现，禁止凭空升级。爽感来源：卡BUG翻盘/越级挑战/系统BUG利用/首通成就/装等反差。爽感不一定非得战力碾压。',
        TONE_APPEND: '搞笑是核心卖点。每章至少3处笑点。幽默来源：1.主角用玩家思维解构修真世界；2.系统播报的荒诞感；3.副本规则与正式服的错位；4.配角对主角卡BUG行为的误解。文风轻快，弹幕式吐槽+网游黑话。'
    },

    detectorConfig: {
        forbiddenTerms: ['练气', '筑基', '金丹', '元婴', '化神', '境界', '修为', '灵力', '功法', '法宝', '丹药', '宗门', '肉身穿越', '魂穿', '小世界', '主世界', '位面', '掠夺', '大境界', '小等级'],
        replacementMap: {
            '修士': '玩家', '宗门': '公会', '飞剑': '外挂装备', '功法': '技能树',
            '境界': '等级', '修为': '经验值', '灵力': '法力值', '法宝': '装备',
            '丹药': '药水', '小世界': '副本', '主世界': '正式服', '位面': '服务器',
            '掠夺': '拾取', '大境界': '等级段', '小等级': '级'
        }
    },

    moduleOverrides: {
        subPlaneSystem: {
            label: '副本系统',
            description: '副本实体、副本切换状态、副本相关约束与素材模板',
            genreStateKeys: {
                currentPlane: { label: '当前服务器', type: 'string', default: '正式服' }
            },
            constraints: {
                'level-system': { label: '等级装备体系', desc: '战力用等级+装备+技能，数值荒诞化呈现。等级提升需积累经验值/卡BUG/系统授权，禁止凭空升级。' },
                'bug-driven-plot': { label: '机制BUG驱动剧情', desc: '每个副本必须存在至少1个核心机制BUG，主角目标是卡该BUG。禁止无BUG的纯打斗章节。' }
            }
        },
        cultivationSystem: {
            label: '等级装备系统',
            description: '角色等级、装备、技能、公会关系',
            genreStateKeys: {
                cultivationStage: { label: '角色等级', type: 'string', default: 'Lv1' },
                combatPowerLevel: { label: '装等', type: 'string', default: '新手装' },
                mp: { label: '法力值', type: 'number', default: 100 },
                spiritualRoot: { label: '职业', type: 'string', default: '无职业' },
                techniques: { label: '技能树', type: 'array', default: [] },
                magicTreasures: { label: '装备栏', type: 'array', default: [] },
                sectRank: { label: '公会排名', type: 'number', default: 0 }
            }
        }
    }
};
