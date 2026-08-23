const REMEDIATION_TARGETS = {
    'opening-hook': {
        label: '开头钩子',
        targets: ['writer-prompt', 'constraint', 'first-chapter-rule'],
        description: '开头3秒法则：第1章前3句必须有冲突/危机/悬念'
    },
    'chapter-hook': {
        label: '章末钩子',
        targets: ['writer-prompt', 'constraint', 'content-utils'],
        description: '每章结尾必须有钩子，让读者必须点下一章'
    },
    'cool-points': {
        label: '高光密度',
        targets: ['writer-prompt', 'review-prompt', 'constraint'],
        description: '每章必须有高光时刻，关键剧情节点不能一笔带过'
    },
    'character-voice': {
        label: '人物区分度',
        targets: ['writer-prompt', 'material', 'review-prompt'],
        description: '每个角色说话方式必须有区分度，不能千篇一律'
    },
    'logic-flaw': {
        label: '逻辑合理性',
        targets: ['constraint', 'review-prompt', 'material'],
        description: '情节推进必须有逻辑铺垫，不能强行发生'
    },
    'pacing': {
        label: '节奏控制',
        targets: ['writer-prompt', 'constraint'],
        description: '节奏不能拖沓，不能连续2段没有剧情推进'
    },
    'emotion': {
        label: '情绪调动',
        targets: ['writer-prompt', 'review-prompt'],
        description: '关键场景必须有情绪爆发，不能平淡带过'
    },
    'show-not-tell': {
        label: '展示而非告知',
        targets: ['writer-prompt', 'review-prompt'],
        description: '用场景和动作展示，不要用旁白告知'
    },
    'protagonist-proactive': {
        label: '主角主动性',
        targets: ['writer-prompt', 'review-prompt', 'constraint'],
        description: '主角必须主动发起行动和决策，不能只被动应对。每章至少1次主动行为'
    },
    'concrete-villain': {
        label: '具象反派',
        targets: ['writer-prompt', 'material', 'review-prompt'],
        description: '必须有持续在线的具象化反派，每章给主角施压，让读者恨得牙痒痒'
    },
    'conflict-first': {
        label: '冲突前置',
        targets: ['writer-prompt', 'review-prompt', 'constraint'],
        description: '前300字必须有冲突/爽点/钩子（15秒法则），禁止前半段大段铺垫'
    },
    'vivid-combat': {
        label: '画面战斗',
        targets: ['writer-prompt', 'review-prompt'],
        description: '战斗必须有画面感：动作细节+感官冲击+代价反馈+高光时刻，禁止概念化描述'
    },
    'slow-burn-romance': {
        label: '渐进感情',
        targets: ['writer-prompt', 'review-prompt'],
        description: '感情线靠事件推动，敌对→合作→动摇→选择→并肩，禁止突兀告白/倒贴'
    },
    'madness-has-cost': {
        label: '疯魔有代价',
        targets: ['writer-prompt', 'review-prompt', 'constraint'],
        description: '疯魔/爆发状态必须有身体崩溃代价（呕吐/颤抖/灰色纹路扩散/短暂失明），禁止"爽完就没事"，能力使用后即时代价'
    },
    'anchor-mechanism': {
        label: '锚点机制',
        targets: ['writer-prompt', 'material', 'review-prompt'],
        description: '每个角色都有"锚"维持人性，锚动摇=人物危机，锚崩塌=灰化。使用能力消耗锚点，锚点归零=失去人性'
    },
    'bitter-humor': {
        label: '苦涩幽默',
        targets: ['writer-prompt', 'review-prompt'],
        description: '绝境中的冷笑话和苦涩调侃，幽默是防御机制不是性格标签，调侃背后是真实的恐惧和疲惫'
    },
    'stance-conflict': {
        label: '立场撕裂',
        targets: ['writer-prompt', 'material', 'review-prompt'],
        description: '没有绝对正邪只有立场碰撞，角色转变基于自己发现真相而非被感化，反派必须有自洽逻辑'
    },
    'spider-web-foreshadow': {
        label: '蛛网伏笔',
        targets: ['writer-prompt', 'review-prompt', 'material'],
        description: '伏笔如蛛网交织每条线连着另一条，禁止挖坑不填，禁止伏笔孤立存在，每条伏笔至少连接另一条'
    },
    'golden-quote-throttle': {
        label: '金句节流',
        targets: ['writer-prompt', 'review-prompt', 'material'],
        description: '同一金句/口号全书最多出现2次（陈默核心信条1次+系统提示音1次），其余全部替换为具象描写或角色个性化表达。苏婉清用审计术语，老周用账房隐喻，穆春生用体制黑话。金句脱离语境循环播放即从点睛之笔降级为机械口癖'
    },
    'alienation-tiered': {
        label: '异化分级描写',
        targets: ['writer-prompt', 'review-prompt', 'material'],
        description: '异化度/痛觉描写必须分级：1-5%感官错位（听觉延迟/触觉模糊/时间拉伸），6-15%逻辑代偿（判断机械化/微表情消失/记忆碎片闪回），>20%物理侵蚀（皮肤灰白纹路/指尖透明化/痛觉反向灼烧）。禁止每次越权都走同一套"灰白噪点+骨节痉挛"模板'
    },
    'system-warning-restraint': {
        label: '系统警告节制',
        targets: ['writer-prompt', 'review-prompt', 'material'],
        description: '【底层逻辑扰动0.7%】仅关键节点使用（遗址代码暴露/签名溯源/后门导出），日常用【逻辑延迟0.3秒】/【判定缓冲期】/【底层响应异常】替代。系统提示音分层：常规警告蓝框、越权预警黄框、人格覆写预备红框+低频嗡鸣。禁止全用同一句式刷屏'
    },
    'tactic-diversity': {
        label: '战术破局多元',
        targets: ['writer-prompt', 'review-prompt', 'material'],
        description: '破局方式必须多元化：环境利用（冷凝水导电短路/风沙掩蔽轨迹）、盟友配合（方远断刃符箓坏账共振）、规则反杀（主动暴露虚假记忆诱使系统过载）、非技术性抉择。禁止所有破局都靠《亡妻残卷》朱砂批注+逆向映射硬撬，清道夫是漏洞嫁接者不是残卷触发器'
    }
};

module.exports = { REMEDIATION_TARGETS };
