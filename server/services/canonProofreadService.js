const store = require('../store');
const { getGenreById } = require('./genreConfig');

class CanonProofreadService {
    constructor() {
        this.cache = {};
        this.KNOWN_IP_PATTERNS = {
            '火影': { franchise: '火影忍者', keyChars: ['鸣人', '佐助', '卡卡西', '小樱', '鼬', '自来也'] },
            '海贼': { franchise: '海贼王', keyChars: ['路飞', '索隆', '娜美', '山治', '罗宾', '乔巴'] },
            '龙珠': { franchise: '龙珠', keyChars: ['悟空', '贝吉塔', '比克', '克林', '弗利萨'] },
            '猎魔人': { franchise: '猎魔人', keyChars: ['杰洛特', '叶奈法', '特莉丝', '丹德里恩'] },
            '奥特曼': { franchise: '奥特曼', keyChars: ['初代', '赛文', '迪迦', '泰罗', '雷欧'] },
            '哆啦A梦': { franchise: '哆啦A梦', keyChars: ['哆啦A梦', '大雄', '静香', '胖虎', '小夫'] }
        };
    }

    detectIPMentions(content) {
        const mentions = [];
        for (const [keyword, ipData] of Object.entries(this.KNOWN_IP_PATTERNS)) {
            if (content.includes(keyword)) {
                mentions.push({ keyword, ...ipData });
            }
            for (const char of ipData.keyChars) {
                if (content.includes(char)) {
                    const already = mentions.find(m => m.franchise === ipData.franchise);
                    if (!already) {
                        mentions.push({ keyword: char, ...ipData });
                    }
                }
            }
        }
        return mentions;
    }

    async verify(content, styleProfile) {
        const mentions = this.detectIPMentions(content);
        if (mentions.length === 0) {
            return { verified: true, deviations: [], corrections: [], ipMentions: [] };
        }

        const results = [];
        for (const mention of mentions) {
            const cacheKey = mention.franchise;
            if (this.cache[cacheKey]) {
                const cached = this.cache[cacheKey];
                const deviations = this._checkDeviations(content, cached.canonRules, mention);
                results.push({ ...mention, ...cached, deviations });
                continue;
            }

            const canonRules = this._buildCanonRules(mention);
            this.cache[cacheKey] = { canonRules };
            const deviations = this._checkDeviations(content, canonRules, mention);
            results.push({ ...mention, canonRules, deviations });
        }

        const allDeviations = [];
        const allCorrections = [];
        for (const r of results) {
            allDeviations.push(...r.deviations);
            for (const d of r.deviations) {
                allCorrections.push({
                    ip: r.franchise,
                    character: d.character,
                    issue: d.issue,
                    correction: d.correction,
                    severity: d.severity
                });
            }
        }

        return {
            verified: allDeviations.filter(d => d.severity === 'critical').length === 0,
            deviations: allDeviations,
            corrections: allCorrections,
            ipMentions: mentions.map(m => m.franchise)
        };
    }

    _buildCanonRules(mention) {
        const rules = {};
        const franchise = mention.franchise;

        if (franchise === '火影忍者') {
            rules['鸣人'] = { personality: '热血直率、永不放弃、重视羁绊', coreAbility: '影分身+螺旋丸+九尾查克拉', powerLevel: '下忍→七代目火影', forbidden: ['冷酷无情', '背叛同伴', '使用写轮眼'] };
            rules['佐助'] = { personality: '孤傲冷峻、复仇执念、最终回归', coreAbility: '写轮眼+千鸟+须佐能乎', powerLevel: '下忍→影级', forbidden: ['开朗活泼', '使用螺旋丸', '火影身份'] };
        } else if (franchise === '海贼王') {
            rules['路飞'] = { personality: '天真热血、重视同伴、自由奔放', coreAbility: '橡胶果实+霸气+尼卡形态', powerLevel: '超新星→四皇', forbidden: ['精于算计', '背叛同伴', '使用剑术'] };
        } else if (franchise === '龙珠') {
            rules['悟空'] = { personality: '战斗狂热、单纯善良、追求更强', coreAbility: '龟派气功+超级赛亚人+自在极意功', powerLevel: '赛亚人→神级', forbidden: ['阴险狡诈', '使用魔法', '害怕战斗'] };
        } else if (franchise === '哆啦A梦') {
            rules['哆啦A梦'] = { personality: '热心助人、贪吃铜锣烧、怕老鼠', coreAbility: '四次元口袋+各种道具', powerLevel: '育儿机器人', forbidden: ['冷酷暴力', '战斗型', '独立作战'] };
        }

        return rules;
    }

    _checkDeviations(content, canonRules, mention) {
        const deviations = [];
        for (const [charName, rules] of Object.entries(canonRules)) {
            if (!content.includes(charName)) continue;

            for (const forbidden of rules.forbidden) {
                if (content.includes(forbidden)) {
                    deviations.push({
                        character: charName,
                        issue: `角色"${charName}"出现禁止属性"${forbidden}"，违反原著设定`,
                        correction: `移除"${forbidden}"，替换为符合原著的"${rules.personality}"相关描写`,
                        severity: 'critical'
                    });
                }
            }

            const oocPatterns = [`${charName}冷酷`, `${charName}阴险`, `${charName}背叛`, `${charName}战力暴涨`];
            for (const pattern of oocPatterns) {
                if (content.includes(pattern)) {
                    deviations.push({
                        character: charName,
                        issue: `检测到OOC描写"${pattern}"`,
                        correction: `修正为符合原著性格"${rules.personality}"的描写`,
                        severity: 'high'
                    });
                }
            }
        }
        return deviations;
    }

    async verifyWithLLM(content, ipMentions, llmService, apiConfig) {
        if (ipMentions.length === 0) return { verified: true, deviations: [], corrections: [] };

        const ipList = ipMentions.join('、');
        const prompt = `你是原著设定校对专家。以下正文涉及知名IP角色（${ipList}），请校对是否符合原著设定。

校对规则：
1. 角色性格是否与原著一致
2. 角色能力是否在原著范围内（允许弱化但不允许篡改）
3. 角色关系是否与原著一致
4. 是否存在OOC（Out of Character）描写

正文：
${content.substring(0, 3000)}

请输出JSON格式：
{
    "verified": true/false,
    "deviations": [{"character":"角色名","issue":"问题描述","correction":"修正建议","severity":"critical/high/medium"}],
    "canonSummary": {"角色名": "原著设定摘要"}
}`;

        try {
            const { extractJSON } = require('./jsonUtils');
            const result = await llmService.chat(
                [{ role: 'system', content: '你只输出JSON，不输出其他内容。' }, { role: 'user', content: prompt }],
                { temperature: 0.2, maxTokens: 2048, apiConfig }
            );
            const text = result.choices?.[0]?.message?.content || '';
            const parsed = extractJSON(text);
            if (parsed) {
                return {
                    verified: parsed.verified !== false,
                    deviations: parsed.deviations || [],
                    corrections: (parsed.deviations || []).map(d => ({
                        ip: ipList,
                        character: d.character,
                        issue: d.issue,
                        correction: d.correction,
                        severity: d.severity
                    }))
                };
            }
        } catch (e) {
            console.warn('[CANON-PROOFREAD] LLM verification failed:', e.message);
        }

        return { verified: true, deviations: [], corrections: [] };
    }

    clearCache() {
        this.cache = {};
    }
}

module.exports = new CanonProofreadService();
