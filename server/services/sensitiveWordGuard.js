const path = require('path');
const fs = require('fs');

const SENSITIVE_WORDS = {
    political: ['习近平', '江泽民', '胡锦涛', '温家宝', '李克强', '李强', '王岐山', '中南海', '党中央', '政治局', '中央委员', '反华', '颠覆', '分裂国家', '台独', '藏独', '疆独'],
    sexual: ['做爱', '性交', '强奸', '轮奸', '猥亵', '淫荡', '淫乱', '色情', '裸体', '脱光', '摸胸', '揉胸', '吸吮', '抽插', '高潮', '射精', '阴道', '阴茎', '乳房', '自慰', '嫖娼', '卖淫', '春药', '迷奸', '下药'],
    violence: ['杀人', '砍头', '斩首', '肢解', '碎尸', '虐杀', '活埋', '凌迟', '剥皮', '剖腹', '挖眼', '割舌', '断肢', '血腥屠杀', '种族灭绝'],
    gambling: ['赌场', '赌博', '下注', '庄家', '赌资', '赌债', '高利贷', '放贷', '网贷', '非法集资'],
    drug: ['毒品', '海洛因', '冰毒', '大麻', '可卡因', '摇头丸', 'K粉', '吸毒', '贩毒', '制毒'],
    superstition: ['法轮', '法轮功', '全能神', '邪教', '传销'],
    other_banned: ['自杀方法', '教唆犯罪', '恐怖袭击', '爆炸制作', '制枪', '制弹']
};

const REPLACEMENT_MAP = {
    '杀人': '除掉', '砍头': '斩杀', '强奸': '侵犯', '做爱': '亲热',
    '性交': '亲密', '淫荡': '放荡', '淫乱': '混乱', '裸体': '赤身',
    '脱光': '卸甲', '赌场': '赌坊', '赌博': '博弈', '毒品': '禁药',
    '海洛因': '迷药', '冰毒': '毒粉', '大麻': '迷草', '高利贷': '重利',
    '自杀方法': '绝路', '恐怖袭击': '突袭'
};

const AI_HALLUCINATION_PHRASES = [
    '仿佛', '不禁', '深深', '殊不知', '令人', '不由得', '忍不住',
    '一股暖流', '心中一动', '暗自思忖', '恍然大悟', '不由自主',
    '心头一紧', '心中暗道', '不由一愣', '心中一惊', '嘴角微扬',
    '眼中闪过一丝', '嘴角勾起一抹', '眼底闪过', '瞳孔微缩'
];

const CUSTOM_REPLACEMENTS_PATH = path.join(__dirname, '..', '..', 'data', 'sensitive-replacements.json');

let _customReplacements = null;

function loadCustomReplacements() {
    if (_customReplacements) return _customReplacements;
    try {
        if (fs.existsSync(CUSTOM_REPLACEMENTS_PATH)) {
            const raw = fs.readFileSync(CUSTOM_REPLACEMENTS_PATH, 'utf-8').replace(/^\uFEFF/, '');
            _customReplacements = JSON.parse(raw);
        } else {
            _customReplacements = {};
        }
    } catch (e) {
        _customReplacements = {};
    }
    return _customReplacements;
}

function saveCustomReplacements(replacements) {
    _customReplacements = replacements;
    const dir = path.dirname(CUSTOM_REPLACEMENTS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CUSTOM_REPLACEMENTS_PATH, JSON.stringify(replacements, null, 2), 'utf-8');
}

function addCustomReplacement(word, replacement) {
    const custom = loadCustomReplacements();
    custom[word] = replacement;
    REPLACEMENT_MAP[word] = replacement;
    saveCustomReplacements(custom);
    return true;
}

function initCustomReplacements() {
    const custom = loadCustomReplacements();
    for (const [word, replacement] of Object.entries(custom)) {
        REPLACEMENT_MAP[word] = replacement;
    }
}

initCustomReplacements();

// 修复陷阱#53：敏感词无词边界匹配
// 原代码 new RegExp(word, 'g') 会误命中子串，如"大麻"误命中"大麻烦"
// 修复策略：维护已知子串冲突表，只对有冲突的词加后缀排除断言
//   - "大麻"在"大麻烦"里：后面是"烦" → (?!烦)断言失败 → 不匹配 ✓
//   - "大麻"在"他种植了大麻，"里：后面是"，"→ 匹配 ✓
//   - "大麻"在"大麻也得处理"里：后面是"也"→ 匹配 ✓（不漏）
//   - "K粉若干"：无冲突 → 无边界匹配 ✓
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 已知子串冲突表：敏感词 → 会产生误匹配的后续字符列表
// 新增冲突时往此表添加条目即可
const SUBSTRING_CONFLICTS = {
    '大麻': ['烦'],  // "大麻"+"烦"="大麻烦"是合法常用词
};

function buildWordBoundaryRegex(word, flags = 'g') {
    const escaped = escapeRegExp(word);
    const conflicts = SUBSTRING_CONFLICTS[word];
    if (conflicts && conflicts.length > 0) {
        // 有已知子串冲突：后面不能跟冲突字符
        const negativeLookahead = conflicts.map(c => escapeRegExp(c)).join('|');
        return new RegExp(`${escaped}(?!${negativeLookahead})`, flags);
    }
    // 无已知冲突：无边界匹配
    return new RegExp(escaped, flags);
}

function scanContent(content) {
    if (!content) return { clean: true, hits: [], replacedContent: content };

    const hits = [];
    let replacedContent = content;

    for (const [category, words] of Object.entries(SENSITIVE_WORDS)) {
        for (const word of words) {
            const regex = buildWordBoundaryRegex(word);
            const matches = content.match(regex);
            if (matches) {
                hits.push({ word, category, count: matches.length, severity: getSeverity(category) });
                if (REPLACEMENT_MAP[word]) {
                    replacedContent = replacedContent.replace(buildWordBoundaryRegex(word), REPLACEMENT_MAP[word]);
                }
            }
        }
    }

    // AI腔调短语不需要词边界，短语本身就是违规，"仿佛他发现"就是AI痕迹
    let aiHallucCount = 0;
    for (const phrase of AI_HALLUCINATION_PHRASES) {
        const regex = new RegExp(escapeRegExp(phrase), 'g');
        const matches = content.match(regex);
        if (matches) {
            aiHallucCount += matches.length;
        }
    }
    if (aiHallucCount > 5) {
        hits.push({ word: 'AI腔调高频词', category: 'ai_hallucination', count: aiHallucCount, severity: 'warning' });
    }

    return {
        clean: hits.filter(h => h.severity === 'block').length === 0,
        hasWarnings: hits.filter(h => h.severity === 'warning').length > 0,
        hits,
        replacedContent,
        summary: hits.map(h => `[${h.severity}][${h.category}] "${h.word}" x${h.count}`).join('; ')
    };
}

function getSeverity(category) {
    const BLOCK_CATEGORIES = ['political', 'sexual', 'drug', 'superstition', 'other_banned'];
    const WARN_CATEGORIES = ['violence', 'gambling'];
    if (BLOCK_CATEGORIES.includes(category)) return 'block';
    if (WARN_CATEGORIES.includes(category)) return 'warning';
    return 'info';
}

function getReplacementSuggestion(word) {
    return REPLACEMENT_MAP[word] || null;
}

module.exports = { scanContent, getReplacementSuggestion, addCustomReplacement, loadCustomReplacements, SENSITIVE_WORDS, REPLACEMENT_MAP, AI_HALLUCINATION_PHRASES, buildWordBoundaryRegex, escapeRegExp, SUBSTRING_CONFLICTS };
