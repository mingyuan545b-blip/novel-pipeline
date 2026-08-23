/**
 * branchProgrammatic.js — 分支A：程序化模拟世界
 *
 * 世界本质：万界是运行中的程序/模拟器，天道是操作系统，BUG是世界漏洞。
 * 主角用键盘飞剑介入底层代码，debug是修改世界运行逻辑。
 * 最贴合"键盘飞剑·万界debug"现有大纲（F7删除/Home查看源码/像素地图）。
 */
module.exports = {
    key: 'programmatic',
    label: '程序化模拟世界',
    worldviewCore: '万界是运行中的程序化模拟世界，天道是操作系统，世界规则是代码，BUG是世界漏洞。修士本质是在调用API，飞剑是调试工具，境界是权限等级。主角通过键盘飞剑介入底层代码，debug是修改世界运行逻辑。',

    powerSystem: {
        concept: '权限等级',
        levels: ['访客(只读)', '用户(执行)', '编辑(修改)', 'root(管理)', '管理员(重构)'],
        description: '强弱看权限等级，不看数值堆叠。访客只能读世界信息，用户能调用API执行操作，编辑能修改局部规则，root能管理整个世界，管理员能重构世界底层。权限提升通过debug漏洞、积累贡献值、获得系统授权。',
        stackingRule: '权限提升需逐级获取，禁止跨级调用（访客不能直接root）。允许通过漏洞利用实现"提权"（低权限做高权限的事），但需符合逻辑链：发现BUG→分析漏洞→构造提权路径→执行。禁止无脑平推也禁止凭空提权。',
        term: '权限'
    },

    planeConcept: {
        term: '测试服',
        alternativeTerms: ['沙盒', '隔离区', '测试环境'],
        description: '万界中隔离出的测试环境，用于验证新规则、承载未修复BUG、运行实验性内容。测试服内的规则可能与正式服不同（像素风/低分辨率/异常机制），进入测试服debug可获得贡献值。',
        constraint: '测试服是debug的隔离环境，主角在测试服内可自由探索BUG，但测试服内获得的"能力"回到正式服后受权限等级压制（低权限无法使用高权限功能）。每位面限掠夺一次改为：每个测试服限提交一次补丁。'
    },

    mentorConcept: {
        term: '注释幽灵',
        alternativeTerms: ['遗留文档', '前任日志', '代码注释'],
        description: '前任debug员留下的代码注释/文档/日志记录，以非实体形式存在。主角通过解读注释获得指引，注释内容往往是前任debug员的吐槽、警告、经验总结。注释幽灵不是真人，不能直接对话，只能通过遗留文档传递信息。'
    },

    namingStyle: {
        style: 'tech-codename',
        rule: '命名采用技术化代号风格：变量名/函数名/技术术语变体。禁用古风雅称（渊鳞/缄默/守正），禁用网文烂梗（龙傲天/叶辰）。主角代号用技术梗，配角用功能描述。',
        examples: {
            protagonist: '苏沉（谐音"速成"，程序员自嘲）',
            supporting: '周大壮（功能描述：肉盾/坦克）、赵扒皮（功能描述：资源占用进程）、老铁（ironically，铁哥们）',
            antagonist: '李长风（变量名longWind，冗长低效）、王占用（resourceHog）',
            plane: '沉默之域→silentZone_07、青青草原→testBed_green、铁臂穹城→ironDome_v2'
        }
    },

    toneStyle: '白描+程序员吐槽+冷面debug。幽默来源：1.主角用程序员思维解构修真世界（"这BUG比我代码还烂"）；2.系统报错的荒诞感（"检测到世界内存泄漏，建议重启天道"）；3.测试服规则与正式服的错位（"这画风怎么变成像素了"）；4.配角对主角debug行为的误解（"他刚才对着空气敲了几个字，野猪就死了"）。文风接地气，用大白话+技术梗混搭。',

    extraConstraints: [
        {
            id: 'permission-system',
            label: '权限等级体系',
            desc: '战力体系完全去数值化，改用权限等级（访客→用户→编辑→root→管理员）。强弱看权限不看战力数值。权限提升需通过debug贡献/漏洞利用/系统授权，禁止凭空突破。低权限做高权限的事需通过"提权"逻辑链（发现BUG→分析→构造路径→执行）。'
        },
        {
            id: 'bug-driven-plot',
            label: 'BUG驱动剧情',
            desc: '剧情推进以BUG为核心：发现世界BUG→分析漏洞→debug修复/利用→获得贡献值/权限提升。每个测试服必须存在至少1个核心BUG，主角的目标是debug该BUG。禁止无BUG的纯打斗章节。'
        },
        {
            id: 'no-cultivation-terms',
            label: '禁用传统修仙术语',
            desc: '禁用：练气/筑基/金丹/元婴/化神/境界/修为/灵力/功法/法宝/丹药/宗门/境界突破。替代：权限/调用/接口/模块/函数/变量/进程/服务/补丁/重启。修士→调用者，宗门→服务集群，飞剑→调试工具，功法→调用协议。'
        },
        {
            id: 'keyboard-mechanic',
            label: '键盘飞剑键位机制',
            desc: '键盘飞剑每个键位对应特定功能：F7=删除/注释，Home=查看源码，Ctrl+C=复制能力，Ctrl+V=粘贴能力，Esc=中断操作，Delete=强制结束，Enter=执行。键位功能受权限等级限制（低权限无法使用高级键位）。键位组合可产生复合效果（Ctrl+Shift+Esc=强制结束并查看源码）。'
        }
    ],

    extraFoundationRules: [
        '铁律A1（权限硬约束）：权限等级不可跨越。访客不能直接root，必须逐级提升或通过"提权"逻辑链实现。提权需符合：发现BUG→分析漏洞→构造提权路径→执行，禁止凭空提权或无脑平推。',
        '铁律A2（BUG驱动）：每个测试服必须存在至少1个核心BUG。主角目标是debug该BUG，通过debug获得贡献值/权限提升。禁止无BUG的纯打斗章节，禁止BUG无逻辑修复。',
        '铁律A3（术语红线）：禁用传统修仙术语（练气/筑基/金丹/境界/修为/灵力/功法/法宝/丹药/宗门）。必须用技术术语替代（权限/调用/接口/模块/函数/变量/进程/服务/补丁/重启）。修士→调用者，宗门→服务集群，飞剑→调试工具，功法→调用协议。',
        '铁律A4（键位机制）：键盘飞剑每个键位对应特定功能，功能受权限等级限制。键位组合可产生复合效果。每个键位的"代价"是消耗贡献值或触发系统反查，不是传统修仙的"反噬/冷却"。'
    ],

    styleProfileOverrides: {
        key: 'tech-debug-comedy',
        label: '程序化debug·反套路喜剧',
        // 陷阱#73修复：必须覆盖以下4字段，否则仍用武侠.json的nostalgic-elder/jianghu-epithet/苍劲豪迈/martial-ascension
        systemPersona: 'code-ghost',
        namingStyle: 'tech-codename',
        tone: '白描+程序员吐槽',
        worldviewTemplate: 'programmatic-simulation',
        povRule: '紧贴男主"debug员+吐槽役"视角。描写要快准狠。正式服侧重权限冲突与规则碰撞（用对话和动作推进），测试服以碎片化报错信息或男主主观体验呈现，严禁全知解说。',
        behaviorRule: '主角行动遵循"发现BUG→分析漏洞→构造方案→执行debug"循环。debug后不描写反噬，但需展现"提权/补丁适配"的逻辑链。配角行为必须有完整前因后果，禁止工具人化。',
        toneRule: '搞笑是核心不是点缀。幽默来源：1.主角用程序员思维解构修真世界；2.系统报错的荒诞感；3.测试服规则与正式服的错位；4.配角对debug行为的误解。文风接地气，用大白话+技术梗混搭，杜绝AI腔调。',
        characterRefRules: '命名采用技术化代号风格，禁用古风雅称和网文烂梗。对话中避免现代互联网低质热梗，幽默需贴合debug语境。'
    },

    genreBaseOverrides: {
        BEHAVIOR_APPEND: '主角所有决策必须经过"发现BUG→分析漏洞→构造方案→执行debug"逻辑链。权限提升需逐级获取或通过提权逻辑链实现，禁止凭空突破。爽感来源：卡BUG翻盘/权限提升/提权成功/补丁修复世界规则/删库跑路式反差。爽感不一定非得战力碾压。',
        TONE_APPEND: '搞笑是核心卖点。每章至少3处笑点。幽默来源：1.主角用程序员思维解构修真世界；2.系统报错的荒诞感；3.测试服规则与正式服的错位；4.配角对debug行为的误解。文风接地气，用大白话+技术梗混搭。'
    },

    detectorConfig: {
        forbiddenTerms: ['练气', '筑基', '金丹', '元婴', '化神', '境界', '修为', '灵力', '功法', '法宝', '丹药', '宗门', '肉身穿越', '魂穿', '小世界', '主世界', '位面', '掠夺', '大境界', '小等级'],
        replacementMap: {
            '修士': '调用者', '宗门': '服务集群', '飞剑': '调试工具', '功法': '调用协议',
            '境界': '权限等级', '修为': '权限', '灵力': '算力', '法宝': '工具模块',
            '丹药': '补丁包', '小世界': '测试服', '主世界': '正式服', '位面': '环境',
            '掠夺': '提取', '大境界': '权限级', '小等级': '子权限'
        }
    },

    moduleOverrides: {
        subPlaneSystem: {
            label: '测试服系统',
            description: '测试服实体、环境切换状态、测试服相关约束与素材模板',
            genreStateKeys: {
                currentPlane: { label: '当前环境', type: 'string', default: '正式服' }
            },
            constraints: {
                'permission-system': { label: '权限等级体系', desc: '战力完全去数值化，改用权限等级。权限提升需通过debug贡献/漏洞利用/系统授权，禁止凭空突破。' },
                'bug-driven-plot': { label: 'BUG驱动剧情', desc: '每个测试服必须存在至少1个核心BUG，主角目标是debug该BUG。禁止无BUG的纯打斗章节。' }
            }
        },
        cultivationSystem: {
            label: '权限系统',
            description: '权限等级、调用接口、工具模块、调用协议',
            genreStateKeys: {
                cultivationStage: { label: '权限等级', type: 'string', default: '访客' },
                combatPowerLevel: { label: '调用权限', type: 'string', default: '只读' },
                mp: { label: '算力', type: 'number', default: 100 },
                spiritualRoot: { label: '访问凭证', type: 'string', default: 'guest' },
                techniques: { label: '调用协议', type: 'array', default: [] },
                magicTreasures: { label: '工具模块', type: 'array', default: [] },
                sectRank: { label: '集群排名', type: 'number', default: 0 }
            }
        }
    }
};
