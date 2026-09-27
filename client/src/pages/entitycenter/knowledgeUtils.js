/**
 * knowledgeUtils.js — 限知认知的分类 / 筛选（纯函数）
 *
 * 分类来自事实标题（factText）前缀，如「身份:沈砚-销籍状态」→ 身份。
 * 数据里的前缀很发散（位置/地点信息/世界观真相/策略意图…），这里做**别名归一**到规范分类，
 * 避免 chips 变成另一种"大杂烩"。
 */

export const K_CATEGORIES = [
    { key: '身份', label: '身份', color: '#00c8ff' },
    { key: '秘密', label: '秘密', color: '#a29bfe' },
    { key: '能力', label: '能力', color: '#4ecdc4' },
    { key: '威胁', label: '威胁', color: '#ff6b9d' },
    { key: '地点', label: '地点', color: '#ffd700' },
    { key: '事件', label: '事件', color: '#ff9f43' },
    { key: '物品', label: '物品', color: '#8ab4f8' },
    { key: '关系', label: '关系', color: '#5eead4' },
    { key: '规则', label: '规则·设定', color: '#c084fc' },
    { key: '意图', label: '意图·策略', color: '#fca5a5' },
    { key: '状态', label: '状态·情报', color: '#94a3b8' },
];

const K_ALIASES = {
    '身份': ['身份', '角色', '人物', '出身'],
    '秘密': ['秘密', '阴谋', '隐情', '真相'],
    '能力': ['能力', '技能', '功法', '特长'],
    '威胁': ['威胁', '危险', '敌意'],
    '地点': ['地点', '位置', '地点信息', '场景', '地理', '场所'],
    '事件': ['事件', '事故', '变故'],
    '物品': ['物品', '物品功能', '道具', '物件'],
    '关系': ['关系', '立场', '阵营', '人际'],
    '规则': ['规则', 'rule', '世界观真相', '设定', '法则'],
    '意图': ['策略', '策略意图', '计划', '意图', '谋划'],
    '状态': ['状态', '人物状态', '信息', 'info', '情报', '消息'],
};

const HEAD_TO_KEY = (() => {
    const m = {};
    for (const [key, list] of Object.entries(K_ALIASES)) for (const a of list) m[a] = key;
    return m;
})();

/** 关键词归类：处理「沈砚假死身份」「白主簿真实意图」这类无冒号标题。顺序即优先级。 */
const KEYWORD_RULES = [
    ['秘密', /秘密|secret|机密|隐情|真相|阴谋/],
    ['身份', /身份|身世|出身/],
    ['状态', /状态|现状|局势|困境|未死|已死|假死/],
    ['关系', /关系|交易|人际|阵营|立场|联盟|势力/],
    ['地点', /地点|位置|场所|地理|场景/],
    ['规则', /规则|rule|机制|设定|法则|世界观真相|漏洞|性质/],
    ['意图', /策略|意图|计划|方案|谋划|行动|任务|目标|逻辑/],
    ['威胁', /威胁|危险|弱点|敌对/],
    ['能力', /能力|技能|功法|特长/],
    ['物品', /物品|道具|物件|名单|账|簿|信物|令牌/],
    ['事件', /事件|事故|变故/],
];

/** 规范分类；取标题（factText 优先，factId 是机器 id）。先精确别名，再关键词，最后「其他」 */
export function categoryOf(rec) {
    const s = String((rec && (rec.factText || rec.factId)) || rec || '');
    const i = s.search(/[:：]/);
    const head = i > 0 ? s.slice(0, i).trim() : '';
    if (head && HEAD_TO_KEY[head]) return HEAD_TO_KEY[head];
    const target = head || s;
    for (const [key, re] of KEYWORD_RULES) if (re.test(target)) return key;
    return '其他';
}

export function categoryMeta(key) {
    return K_CATEGORIES.find(c => c.key === key) || { key, label: key, color: '#7c8ba1' };
}

/** 出现的分类（带计数，按预设顺序，未知的「其他」置后） */
export function presentCategories(records) {
    const counts = {};
    for (const r of records) { const k = categoryOf(r); counts[k] = (counts[k] || 0) + 1; }
    const order = [...K_CATEGORIES.map(c => c.key), '其他'];
    return Object.keys(counts)
        .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
        .map(k => ({ ...categoryMeta(k), count: counts[k] }));
}

/** 章节/场景筛选可选值（去重、升序） */
export function chapterOptionsOf(records) {
    return [...new Set(records.map(r => r.sinceChapter || 0))].sort((a, b) => a - b);
}

export function filterKnowledge(records, { category, chapter, query }, nameOf) {
    const q = (query || '').trim().toLowerCase();
    return records.filter(r => {
        if (category && category !== 'all' && categoryOf(r) !== category) return false;
        if (chapter && chapter !== 'all' && String(r.sinceChapter || 0) !== String(chapter)) return false;
        if (q) {
            const hay = [r.factText, r.factId, nameOf(r.entityId), r.notes].join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

/** 按分类聚合成 [{ key, meta, facts:[{ factKey, records }] }] */
export function groupByCategory(records) {
    const byCat = new Map();
    for (const r of records) {
        const cat = categoryOf(r);
        if (!byCat.has(cat)) byCat.set(cat, new Map());
        const facts = byCat.get(cat);
        const factKey = r.factText || r.factId;
        if (!facts.has(factKey)) facts.set(factKey, []);
        facts.get(factKey).push(r);
    }
    const order = [...K_CATEGORIES.map(c => c.key), '其他'];
    return [...byCat.entries()]
        .sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99))
        .map(([cat, facts]) => ({
            key: cat, meta: categoryMeta(cat),
            facts: [...facts.entries()].map(([factKey, recs]) => ({ factKey, records: recs }))
                .sort((a, b) => a.factKey.localeCompare(b.factKey)),
        }));
}
