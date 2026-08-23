const MAX_ACTIVE_HOOKS = 12;
const STALE_THRESHOLD_CHAPTERS = 30;
const URGENT_THRESHOLD_CHAPTERS = 5;

const MODE_STALE_THRESHOLDS = { novel: 30 };
const MODE_URGENT_THRESHOLDS = { novel: 5 };

const HOOK_TYPES = {
    '身份悬念': { payoffTiming: 'slow-burn', defaultRange: [50, 80] },
    '历史谜团': { payoffTiming: 'slow-burn', defaultRange: [40, 70] },
    '能力异常': { payoffTiming: 'mid-arc', defaultRange: [20, 40] },
    '角色深度': { payoffTiming: 'mid-arc', defaultRange: [30, 50] },
    '角色动机': { payoffTiming: 'mid-arc', defaultRange: [15, 30] },
    '角色变化': { payoffTiming: 'endgame', defaultRange: [50, 80] },
    '世界秘密': { payoffTiming: 'endgame', defaultRange: [60, 90] },
    '真相揭示': { payoffTiming: 'endgame', defaultRange: [70, 100] },
    '物品线索': { payoffTiming: 'mid-arc', defaultRange: [15, 30] },
    '能力展示': { payoffTiming: 'near-term', defaultRange: [5, 15] },
    '威胁逼近': { payoffTiming: 'near-term', defaultRange: [5, 15] },
    '同伴建立': { payoffTiming: 'near-term', defaultRange: [3, 10] },
    '势力博弈': { payoffTiming: 'mid-arc', defaultRange: [20, 40] },
    '伏笔铺垫': { payoffTiming: 'mid-arc', defaultRange: [10, 25] },
    '情感暗线': { payoffTiming: 'slow-burn', defaultRange: [30, 60] }
};

const RESOLUTION_PATTERNS = [
    /真相[是大]|揭开|揭露|终于(明白|知道|理解|发现|看清|识破)/,
    /秘密(暴露|公开|揭开|揭晓|败露)|身份(暴露|公开|揭晓|识破)/,
    /伏笔.*回收|铺垫.*兑现|谜底.*揭开/,
    /原来(如此|是这样|一直都是)|一切(都)?(明白|清楚|真相)/,
    /破局|翻盘|反转|打脸|揭穿|识破|戳穿/,
    /底牌|王牌|杀手锏|后手.*暴露|隐藏.*实力.*暴露/,
    /不再?隐瞒|坦白|和盘托出|全盘(托出|交代)/,
    /水落石出|真相大白|尘埃落定|盖棺定论/,
    /秘密.*不再是|谜团.*解开|悬念.*揭晓|困惑.*消散/
];

const NEW_HOOK_PATTERNS = [
    { pattern: /隐藏.{0,4}(惊天|重大|致命|核心|古老).{0,4}秘密/, type: '伏笔铺垫' },
    { pattern: /暗藏.{0,4}(杀机|玄机|危机|陷阱|阴谋)/, type: '伏笔铺垫' },
    { pattern: /神秘.{0,4}(人|影|声音|力量|组织).{0,6}(出现|逼近|浮现|降临)/, type: '身份悬念' },
    { pattern: /似乎.{0,6}(知道|明白|察觉|发现).{0,6}(不对|阴谋|陷阱|危险)/, type: '威胁逼近' },
    { pattern: /隐约(看到|听到|感觉到|察觉).{0,10}(异样|异常|不对).{0,6}(但|却|然而|不过)/, type: '能力异常' }
];

const FALSE_POSITIVE_CONTEXTS = [
    /揭开.{0,2}(锅盖|盖子|帘子|幕布|纱布|瓶盖)/,
    /真相.{0,4}(不是|并非|远非|不在于)/,
    /原来.{0,4}(不是|并非|只是)/,
    /识破.{0,4}(陷阱|骗局|伪装).{0,6}(但|却|然而|不过)/,
    /揭露.{0,4}(的只是|的不过)/,
    /破局.{0,4}(失败|未成|不成)/,
    /秘密.{0,4}(依然|仍然|依旧|还是|并未)/
];

const TYPE_ALIASES = {
    '身份悬念': ['身份', '神秘', '谁', '真实身份'],
    '历史谜团': ['历史', '过去', '往事', '秘密'],
    '能力异常': ['能力', '异能', '力量', '觉醒'],
    '威胁逼近': ['威胁', '危险', '敌人', '危机'],
    '伏笔铺垫': ['伏笔', '铺垫', '线索', '暗示'],
    '角色动机': ['动机', '目的', '为什么', '理由'],
    '情感暗线': ['感情', '情感', '暗线', '心意'],
    '势力博弈': ['势力', '博弈', '阵营', '对抗'],
    '物品线索': ['物品', '道具', '宝物', '线索'],
    '能力展示': ['展示', '实力', '爆发', '底牌'],
    '同伴建立': ['同伴', '盟友', '伙伴', '信任'],
    '角色深度': ['内心', '深度', '复杂', '矛盾'],
    '角色变化': ['转变', '改变', '蜕变', '成长'],
    '世界秘密': ['世界', '真相', '规则', '秘密'],
    '真相揭示': ['真相', '揭示', '谜底', '答案']
};

const INVALID_NOTES_PATTERNS = [
    /^(archiveLog|归档清单|新建素材|类型：|伏笔状态总览|伏笔执行计划)/,
    /^\d+\.\s/,
    /^`?\d+\./,
    /^\s*$/
];

module.exports = {
    MAX_ACTIVE_HOOKS, STALE_THRESHOLD_CHAPTERS, URGENT_THRESHOLD_CHAPTERS,
    MODE_STALE_THRESHOLDS, MODE_URGENT_THRESHOLDS, HOOK_TYPES,
    RESOLUTION_PATTERNS, NEW_HOOK_PATTERNS, FALSE_POSITIVE_CONTEXTS,
    TYPE_ALIASES, INVALID_NOTES_PATTERNS
};
