const logger = require('../shared/logger');
function isRuleRedundant(existingRules, newRule) {
    const CONFLICT_PAIRS = [
        { a: /生物信号传导|网络共振|因果传导层/, b: /降维|感官隐喻|禁止.*术语|幼崽视角锁定/ },
        { a: /工程逻辑|曲线描述|严谨务实/, b: /具象比喻|感官化|降维映射/ }
    ];

    for (const existing of existingRules) {
        const existingLower = existing.rule.toLowerCase();
        const newLower = newRule.toLowerCase();

        const overlapKeywords = ['完整性', '悬空', '残缺', '闭环', '降维', '感官', '术语',
            '比喻', '轮换', '新鲜度', '视角', '幼崽', '重复', '粘贴', '查重'];
        let matchCount = 0;
        for (const kw of overlapKeywords) {
            if (existingLower.includes(kw) && newLower.includes(kw)) matchCount++;
        }
        if (matchCount >= 2) {
            logger.info('remediationRules', `[REMEDIATION] Rule redundant: ${matchCount} keyword overlaps with existing rule`);
            return true;
        }

        for (const pair of CONFLICT_PAIRS) {
            if ((pair.a.test(existing.rule) && pair.b.test(newRule)) ||
                (pair.b.test(existing.rule) && pair.a.test(newRule))) {
                logger.info('remediationRules', '[REMEDIATION] Rule conflicts with existing rule - skipping to avoid contradiction');
                return true;
            }
        }
    }

    return false;
}

function consolidateRules(existingRules, newRule, maxRules) {
    const consolidated = [...existingRules];

    const TOPICS = [
        { keywords: ['完整性', '悬空', '残缺', '闭环', '语义'], label: '章节完整性' },
        { keywords: ['降维', '感官', '术语', '技术', '数据', '设备', '参数'], label: '科技降维' },
        { keywords: ['比喻', '轮换', '新鲜度', '意象'], label: '比喻新鲜度' },
        { keywords: ['视角', '幼崽', '认知', '旁白'], label: '视角一致性' },
        { keywords: ['重复', '粘贴', '查重', '循环'], label: '防重复' },
        { keywords: ['节奏', '过渡', '铺垫', '切换'], label: '节奏过渡' },
        { keywords: ['传导', '因果', '逻辑链'], label: '因果传导' }
    ];

    for (const topic of TOPICS) {
        const matching = consolidated.filter(r =>
            topic.keywords.some(kw => r.rule.toLowerCase().includes(kw))
        );
        if (matching.length >= 2) {
            const keepIdx = consolidated.indexOf(matching[0]);
            const merged = matching.map(r => r.rule).join('；');
            consolidated[keepIdx] = {
                rule: `【${topic.label}】${merged.replace(/【[^】]+】/g, '')}`,
                source: 'consolidated',
                addedAt: new Date().toISOString()
            };
            for (let i = matching.length - 1; i >= 1; i--) {
                consolidated.splice(consolidated.indexOf(matching[i]), 1);
            }
        }
    }

    if (consolidated.length < maxRules && !isRuleRedundant(consolidated, newRule)) {
        consolidated.push({
            rule: newRule,
            source: 'review-remediation',
            addedAt: new Date().toISOString()
        });
    }

    if (consolidated.length > maxRules) {
        consolidated.sort((a, b) => {
            const aTime = a.addedAt ? new Date(a.addedAt).getTime() : 0;
            const bTime = b.addedAt ? new Date(b.addedAt).getTime() : 0;
            return bTime - aTime;
        });
        consolidated.length = maxRules;
    }

    return consolidated;
}

module.exports = { isRuleRedundant, consolidateRules };
