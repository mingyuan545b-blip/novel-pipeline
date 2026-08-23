const { PIPELINE_CONTRACT } = require('../../config/systemConfig');

const POLLUTION_SEVERITY = {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM'
};

const SURNAMES = '沈林顾陆苏陈王张李赵周吴郑冯褚卫蒋韩杨朱秦许何吕施孔曹严华金魏陶姜戚谢邹柏窦章潘范彭鲁韦昌马苗凤花方俞任袁柳唐罗薛阎段雷龙史黄贺倪汤滕殷毕郝邬安常乐于时傅齐康伍余元卜孟平';

const NAME_CONTEXT_PATTERNS = [
    new RegExp(`(?:^|[，。！？；：""''\\s])(([${SURNAMES}][\\u4e00-\\u9fa5]{1,2})(?=说|道|笑|叹|问|答|喊|叫|想|觉|看|望|走|站|坐|拉|握|抱|推|低|抬|转|回|点|摇|皱|咬|闭|睁|伸|放|拿|递|接|穿|脱|系|扣|擦|抹|揉|按|敲|拍|摸|紧|松|退|进|出|上|下|来|去|起|倒|靠|倚|蹲|跪|躺|趴|跳|跑|冲|闯|躲|藏|追|逃|挡|拦|扶|搀|牵|挽|搂|抱|拥|吻|贴|碰|触|擦|蹭))`, 'gm'),
    new RegExp(`(([${SURNAMES}][\\u4e00-\\u9fa5]{1,2})(?=[，。！？；：""''\\s]))`, 'gm'),
    new RegExp(`(([${SURNAMES}][\\u4e00-\\u9fa5]{1,2})的(?=[目光手心脸身背脚步声呼吸温度声音]))`, 'gm'),
];

const NOT_NAME_WORDS = ['他的','她的','我的','你的','这是','那是','什么','怎么','这样','那样','没有','不是','可以','已经','应该','可能','因为','所以','如果','但是','而且','或者','虽然','不过','只是','还是','已经','于是','然后','接着','突然','渐渐','终于','果然','竟然','居然','显然','似乎','好像','也许','大概','几乎','完全','非常','十分','特别','相当','比较','稍微','略微','渐渐','慢慢','悄悄','默默','轻轻','缓缓','淡淡','静静','偷偷'];

function extractChineseNames(text) {
    const names = new Set();
    if (!text || text.length < 2) return [];

    for (const pattern of NAME_CONTEXT_PATTERNS) {
        const matches = text.matchAll(pattern);
        for (const m of matches) {
            const candidate = (m[1] || m[0]).trim();
            if (candidate.length >= 2 && candidate.length <= 3 && !NOT_NAME_WORDS.includes(candidate)) {
                names.add(candidate);
            }
        }
    }
    return [...names];
}

function extractSettingKeywords(content) {
    const keywords = [];
    if (!content) return keywords;

    const patterns = [
        /(?:职业|身份|专长|技能|工作|职位|角色)[:：]\s*([^\n,，。；;]+)/g,
        /(?:是|作为|担任)\s*([^\n,，。；;]{2,10}?(?:师|者|员|人|家|手|匠|士|官|将|兵|生))/g
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const keyword = match[1] || match[0];
            if (keyword && keyword.length >= 2 && keyword.length <= 20) {
                keywords.push(keyword.trim());
            }
        }
    }
    return [...new Set(keywords)];
}

function calcSimilarity(a, b) {
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}

module.exports = {
    POLLUTION_SEVERITY,
    PIPELINE_CONTRACT,
    extractChineseNames,
    extractSettingKeywords,
    calcSimilarity
};
