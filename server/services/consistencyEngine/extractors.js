const { isPowerDowngrade, isPowerUpgrade } = require('./extractorPower');
const { extractTimeIndicators, detectNewForeshadowing, formatStateSummary } = require('./extractorTimeline');

function extractContext(content, keyword, radius = 50) {
    const idx = content.indexOf(keyword);
    if (idx === -1) return '';
    const start = Math.max(0, idx - radius);
    const end = Math.min(content.length, idx + keyword.length + radius);
    return '...' + content.substring(start, end) + '...';
}

function extractCharacterTraits(content) {
    const traits = [];
    const patterns = [
        /性格[：:]\s*([^，。；\n]+)/g,
        /特点[：:]\s*([^，。；\n]+)/g,
        /为人\s*([^，。；\n]+)/g,
        /性格\s*([^，。；\n]+)/g
    ];
    for (const p of patterns) {
        let match;
        while ((match = p.exec(content)) !== null) {
            traits.push(match[1].trim());
        }
    }
    return traits;
}

function detectTraitContradiction(content, name, trait) {
    const nameIdx = content.indexOf(name);
    if (nameIdx === -1) return null;
    const segment = content.substring(Math.max(0, nameIdx - 200), Math.min(content.length, nameIdx + 500));
    const negativeTraits = {
        '冷静': ['暴怒', '失控', '歇斯底里'],
        '温柔': ['残忍', '冷酷', '无情'],
        '胆小': ['勇敢', '无畏', '挺身而出'],
        '忠诚': ['背叛', '出卖', '反叛'],
        '沉默': ['滔滔不绝', '喋喋不休']
    };
    const contradictions = negativeTraits[trait];
    if (!contradictions) return null;
    for (const c of contradictions) {
        if (segment.includes(c)) return extractContext(segment, c, 30);
    }
    return null;
}

function findLocationMentions(content, name, expectedLocation) {
    const nameIdx = content.indexOf(name);
    if (nameIdx === -1) return { conflict: false };
    const segment = content.substring(Math.max(0, nameIdx - 100), Math.min(content.length, nameIdx + 300));
    const locationKeywords = ['在', '来到', '抵达', '身处', '位于', '回到'];
    for (const kw of locationKeywords) {
        const kwIdx = segment.indexOf(kw);
        if (kwIdx !== -1) {
            const afterKw = segment.substring(kwIdx, kwIdx + 20);
            if (afterKw.length > 1 && !afterKw.includes(expectedLocation) && !expectedLocation.includes(afterKw.substring(1, 3))) {
                const knownLocations = ['城', '山', '谷', '海', '岛', '宫', '殿', '阁', '楼', '院', '营', '洞'];
                const hasLocation = knownLocations.some(l => afterKw.includes(l));
                if (hasLocation) return { conflict: true, context: extractContext(segment, kw, 20) };
            }
        }
    }
    return { conflict: false };
}

function mentionsRelationship(content, relName) {
    if (!relName) return false;
    const parts = relName.split(/[与和及→←↔\-]/);
    return parts.every(p => content.includes(p.trim()));
}

function detectFriendlyInteraction(content, relName) {
    const friendlyWords = ['微笑', '拥抱', '握手', '感谢', '帮助', '合作', '信任', '友善', '亲切'];
    const parts = relName.split(/[与和及→←↔\-]/);
    if (parts.length < 2) return null;
    const segment = findSegmentWithBoth(content, parts[0].trim(), parts[1].trim());
    if (!segment) return null;
    for (const fw of friendlyWords) {
        if (segment.includes(fw)) return extractContext(segment, fw, 20);
    }
    return null;
}

function detectHostileInteraction(content, relName) {
    const hostileWords = ['怒', '恨', '杀', '打', '骂', '攻击', '敌视', '冲突', '决裂'];
    const parts = relName.split(/[与和及→←↔\-]/);
    if (parts.length < 2) return null;
    const segment = findSegmentWithBoth(content, parts[0].trim(), parts[1].trim());
    if (!segment) return null;
    for (const hw of hostileWords) {
        if (segment.includes(hw)) return extractContext(segment, hw, 20);
    }
    return null;
}

function findSegmentWithBoth(content, name1, name2) {
    const idx1 = content.indexOf(name1);
    const idx2 = content.indexOf(name2);
    if (idx1 === -1 || idx2 === -1) return null;
    const start = Math.max(0, Math.min(idx1, idx2) - 100);
    const end = Math.min(content.length, Math.max(idx1, idx2) + 200);
    return content.substring(start, end);
}

function detectPowerChange(content, name) {
    const nameIdx = content.indexOf(name);
    if (nameIdx === -1) return null;
    const segment = content.substring(Math.max(0, nameIdx - 50), Math.min(content.length, nameIdx + 300));
    const powerKeywords = ['突破', '晋级', '升阶', '实力大增', '修为精进', '境界提升', '战力飙升', '实力暴增'];
    const downgradeKeywords = ['修为尽失', '实力大减', '跌落', '退化', '封印', '削弱'];
    for (const kw of powerKeywords) {
        if (segment.includes(kw)) return { newLevel: kw, context: extractContext(segment, kw, 30), direction: 'up' };
    }
    for (const kw of downgradeKeywords) {
        if (segment.includes(kw)) return { newLevel: kw, context: extractContext(segment, kw, 30), direction: 'down' };
    }
    return null;
}

function isBreakthrough(content, name) {
    const breakthroughWords = ['突破', '顿悟', '觉醒', '传承', '蜕变', '涅槃', '机缘', '奇遇'];
    const nameIdx = content.indexOf(name);
    if (nameIdx === -1) return false;
    const segment = content.substring(Math.max(0, nameIdx - 100), Math.min(content.length, nameIdx + 500));
    return breakthroughWords.some(w => segment.includes(w));
}

function extractPowerRules(content) {
    const rules = [];
    const lines = content.split(/[。\n]/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes('不可') || trimmed.includes('不能') || trimmed.includes('禁止') ||
            trimmed.includes('必须') || trimmed.includes('只能') || trimmed.includes('无法') ||
            trimmed.includes('绝不') || trimmed.includes('规则') || trimmed.includes('定律')) {
            if (trimmed.length > 5 && trimmed.length < 100) rules.push(trimmed);
        }
    }
    return rules;
}

function detectPowerRuleViolation(content, rule) {
    const keyTerms = rule.replace(/不可|不能|禁止|必须|只能|无法|绝不/g, '').trim();
    if (keyTerms.length < 2) return null;
    if (content.includes(keyTerms)) {
        const negations = ['不可', '不能', '禁止', '无法', '绝不'];
        const isProhibition = negations.some(n => rule.includes(n));
        if (isProhibition) return extractContext(content, keyTerms, 30);
    }
    return null;
}

module.exports = {
    extractContext, extractCharacterTraits, detectTraitContradiction,
    findLocationMentions, mentionsRelationship, detectFriendlyInteraction,
    detectHostileInteraction, findSegmentWithBoth, detectPowerChange,
    isBreakthrough, isPowerDowngrade, isPowerUpgrade,
    extractPowerRules, detectPowerRuleViolation, extractTimeIndicators,
    detectNewForeshadowing, formatStateSummary
};
