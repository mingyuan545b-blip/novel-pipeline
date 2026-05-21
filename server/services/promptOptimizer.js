const store = require('../store');
const { estimateTokens } = require('./contextBudget');
const promptAuditor = require('./promptAuditor');
const { getAgentPrompt, buildFoundationPrompt, buildConstraintInjection, deduplicateSystemPrompt, getStyleProfileForProject } = require('./agentPrompts');

const PROBLEM_PATTERNS = [
    {
        id: 'tech-jargon-not-dedim',
        keywords: ['术语未降维', '科技降维', '术语直接暴露', '专业术语', '科技术语', '技术名词未经角色感官过滤', '术语降维不彻底', '术语降维'],
        category: '术语降维',
        rootCause: 'behaviorRule中术语降维指导不够具体',
        targetField: 'behaviorRule',
        targetCollection: 'style-profiles'
    },
    {
        id: 'adult-perspective-leak',
        keywords: ['视角偏移', '视角越界', '全知旁白', '成人心理动词', '成人内心', '视角一致性', '成人技术报告口吻', '视角混入', '叙述视角微偏移', '成人视角'],
        category: '视角违规',
        rootCause: 'povRule中视角禁用词列表不够精确或成人/幼崽语境区分不够',
        targetField: 'povRule',
        targetCollection: 'style-profiles'
    },
    {
        id: 'word-count-insufficient',
        keywords: ['字数不足', '字数严重不足', '字数未达标', '纯正文字数'],
        category: '字数不足',
        rootCause: '字数约束在user prompt中被截断或不够强调',
        targetField: 'foundation',
        targetCollection: 'foundation-prompts'
    },
    {
        id: 'content-repetition',
        keywords: ['重复粘贴', '防重复', '段落重复', '动作描写轻微原地循环', '动作循环', '重复'],
        category: '内容重复',
        rootCause: '防重复规则不够具体或与字数扩展规则冲突',
        targetField: 'foundation',
        targetCollection: 'foundation-prompts'
    },
    {
        id: 'hook-weak-ending',
        keywords: ['章末钩子', '收束张力', '悬念钩子', '结尾', '章末悬念', '收束偏静态', '末段张力'],
        category: '章末钩子',
        rootCause: 'toneRule中钩子要求不够具体',
        targetField: 'toneRule',
        targetCollection: 'style-profiles'
    },
    {
        id: 'horror-description',
        keywords: ['恐怖', '阴森', '诡异', '克苏鲁'],
        category: '恐怖描写',
        rootCause: 'toneRule中恐怖禁用词不够全面',
        targetField: 'toneRule',
        targetCollection: 'style-profiles'
    },
    {
        id: 'info-dump',
        keywords: ['信息注入节奏', '信息倾倒', '说明书式', '理论说明占比', '平铺直叙'],
        category: '信息注入节奏',
        rootCause: 'foundation中展示代替告知规则不够具体',
        targetField: 'foundation',
        targetCollection: 'foundation-prompts'
    },
    {
        id: 'baby-cute-missing',
        keywords: ['萌感', '萌宝交互', '幼崽萌感', '幼崽行为'],
        category: '萌感缺失',
        rootCause: 'behaviorRule中萌感行为要求不够具体',
        targetField: 'behaviorRule',
        targetCollection: 'style-profiles'
    },
    {
        id: 'dialogue-style',
        keywords: ['对话', '台词书面化', '成人对话', '儿童化表达', '对话降维', '沟通未匹配幼崽认知'],
        category: '对话风格',
        rootCause: 'dialogueRule中对话规范不够具体',
        targetField: 'dialogueRule',
        targetCollection: 'style-profiles'
    },
    {
        id: 'character-consistency',
        keywords: ['角色命名', '角色称呼', '代词', '物品设定前后矛盾', '设定矛盾'],
        category: '角色一致性',
        rootCause: 'characterRefRules中称呼规范不够具体',
        targetField: 'characterRefRules',
        targetCollection: 'style-profiles'
    }
];

const OPTIMIZER_LIMITS = {
    MIN_CHAPTERS_PATTERN: 3,
    MAX_MODIFICATION_CHARS: 200,
    MAX_DAILY_OPTIMIZATIONS: 1,
    COOLDOWN_CHAPTERS: 3,
    MAX_CUMULATIVE_MODIFICATIONS: 10,
    MIN_HEALTH_SCORE_AFTER: 70,
    TOKEN_DELTA_MAX: 50
};

class PromptOptimizer {
    constructor(projectId) {
        this.projectId = projectId;
    }

    detectProblemPatterns(lastNChapters = 10) {
        const reviews = store.queryItems('reviews')
            .filter(r => r.projectId === this.projectId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const chapters = store.queryItems('chapters')
            .filter(c => c.projectId === this.projectId && !c.archived)
            .sort((a, b) => (b.chapterNumber || 0) - (a.chapterNumber || 0));

        const recentChapters = chapters.slice(0, lastNChapters);
        const recentChapterIds = new Set(recentChapters.map(c => c.id));

        const recentReviews = reviews.filter(r => recentChapterIds.has(r.chapterId));

        const patternHits = {};
        const patternChapterMap = {};
        const patternExamples = {};

        for (const review of recentReviews) {
            if (review.passed) continue;

            const allIssueText = [
                ...(review.issues || []).map(i => [i.title || '', i.desc || i.description || ''].join(' ')),
                review.content || ''
            ].join(' ');

            for (const pattern of PROBLEM_PATTERNS) {
                let matched = false;
                for (const kw of pattern.keywords) {
                    if (allIssueText.includes(kw)) {
                        matched = true;
                        break;
                    }
                }
                if (matched) {
                    if (!patternHits[pattern.id]) {
                        patternHits[pattern.id] = 0;
                        patternChapterMap[pattern.id] = new Set();
                        patternExamples[pattern.id] = [];
                    }
                    patternHits[pattern.id]++;
                    const chNum = chapters.find(c => c.id === review.chapterId)?.chapterNumber || '?';
                    patternChapterMap[pattern.id].add(chNum);
                    if (patternExamples[pattern.id].length < 3) {
                        patternExamples[pattern.id].push({
                            chapter: chNum,
                            step: review.step,
                            round: review.round,
                            issueText: allIssueText.substring(0, 200)
                        });
                    }
                }
            }
        }

        const results = [];
        for (const pattern of PROBLEM_PATTERNS) {
            const hits = patternHits[pattern.id] || 0;
            const affectedChapters = patternChapterMap[pattern.id] || new Set();
            const chapterCount = affectedChapters.size;

            if (chapterCount >= OPTIMIZER_LIMITS.MIN_CHAPTERS_PATTERN) {
                results.push({
                    patternId: pattern.id,
                    category: pattern.category,
                    rootCause: pattern.rootCause,
                    targetField: pattern.targetField,
                    targetCollection: pattern.targetCollection,
                    totalHits: hits,
                    affectedChapters: Array.from(affectedChapters).sort((a, b) => a - b),
                    chapterCount,
                    severity: chapterCount >= 6 ? 'critical' : chapterCount >= 4 ? 'high' : 'medium',
                    examples: patternExamples[pattern.id] || [],
                    canAutoOptimize: pattern.targetCollection === 'style-profiles'
                });
            }
        }

        results.sort((a, b) => b.chapterCount - a.chapterCount);

        return {
            projectId: this.projectId,
            analyzedChapters: recentChapters.length,
            totalReviewsAnalyzed: recentReviews.length,
            patterns: results,
            detectedAt: new Date().toISOString()
        };
    }

    canOptimize(patternId) {
        const project = store.getItem('projects', this.projectId);
        if (!project) return { allowed: false, reason: '项目不存在' };

        const optimizationLog = project._optimizationLog || [];
        const today = new Date().toISOString().split('T')[0];
        const todayOptimizations = optimizationLog.filter(l => l.timestamp.startsWith(today));
        if (todayOptimizations.length >= OPTIMIZER_LIMITS.MAX_DAILY_OPTIMIZATIONS) {
            return { allowed: false, reason: `今日已优化${todayOptimizations.length}次，超过每日上限${OPTIMIZER_LIMITS.MAX_DAILY_OPTIMIZATIONS}` };
        }

        if (optimizationLog.length >= OPTIMIZER_LIMITS.MAX_CUMULATIVE_MODIFICATIONS) {
            return { allowed: false, reason: `累计优化已达${optimizationLog.length}次上限${OPTIMIZER_LIMITS.MAX_CUMULATIVE_MODIFICATIONS}` };
        }

        const lastOpt = optimizationLog[optimizationLog.length - 1];
        if (lastOpt) {
            const chapters = store.queryItems('chapters')
                .filter(c => c.projectId === this.projectId && !c.archived)
                .sort((a, b) => (b.chapterNumber || 0) - (a.chapterNumber || 0));
            const chaptersSince = chapters.filter(c => {
                const chDate = new Date(c.updatedAt || c.createdAt);
                const optDate = new Date(lastOpt.timestamp);
                return chDate > optDate;
            }).length;

            if (chaptersSince < OPTIMIZER_LIMITS.COOLDOWN_CHAPTERS) {
                return { allowed: false, reason: `上次优化后仅完成${chaptersSince}章，冷却期需${OPTIMIZER_LIMITS.COOLDOWN_CHAPTERS}章` };
            }
        }

        const samePatternOpt = optimizationLog.filter(l => l.patternId === patternId);
        if (samePatternOpt.length >= 2) {
            return { allowed: false, reason: `模式${patternId}已优化${samePatternOpt.length}次，同一模式最多优化2次` };
        }

        return { allowed: true };
    }

    generateSuggestion(patternId) {
        const canOpt = this.canOptimize(patternId);
        if (!canOpt.allowed) return { error: canOpt.reason };

        const pattern = PROBLEM_PATTERNS.find(p => p.id === patternId);
        if (!pattern) return { error: '未知问题模式' };

        const profile = getStyleProfileForProject(this.projectId);
        if (!profile) return { error: '项目无风格配置' };

        const currentValue = profile[pattern.targetField] || '';
        const currentTokens = estimateTokens(currentValue);

        const suggestions = this._getSuggestionTemplate(patternId, currentValue);

        return {
            patternId,
            category: pattern.category,
            rootCause: pattern.rootCause,
            targetField: pattern.targetField,
            targetCollection: pattern.targetCollection,
            currentValue: currentValue.substring(0, 500),
            currentTokens,
            suggestions,
            limits: {
                maxModificationChars: OPTIMIZER_LIMITS.MAX_MODIFICATION_CHARS,
                tokenDeltaMax: OPTIMIZER_LIMITS.TOKEN_DELTA_MAX
            }
        };
    }

    _getSuggestionTemplate(patternId, currentValue) {
        const templates = {
            'tech-jargon-not-dedim': [
                {
                    action: 'replace',
                    findPattern: '术语降维',
                    replacement: '术语降维：幼崽段→1句感官隐喻（安全阈值→安全线/后台日志→小本本/净化装置→洗澡大机器/地下管网→蚂蚁通道），成人段→保留',
                    reason: '用精简映射表替换冗长描述',
                    estimatedTokenDelta: -10
                }
            ],
            'adult-perspective-leak': [
                {
                    action: 'replace',
                    findPattern: '幼崽段落禁用',
                    replacement: '幼崽段禁用：意识到/明白/暗想/盘算/权衡。可用：觉得/感觉/看见/听见。成人段≤2处内心/章',
                    reason: '精简视角禁用词列表并区分语境',
                    estimatedTokenDelta: -5
                }
            ],
            'word-count-insufficient': [
                {
                    action: 'note',
                    message: '字数不足通常是user prompt超预算导致字数约束被截断，建议精简user prompt而非修改提示词',
                    reason: '根因是token截断而非约束不足'
                }
            ],
            'content-repetition': [
                {
                    action: 'replace',
                    findPattern: '防重复',
                    replacement: '防重复：不逐字复制前文，时间推进须有新动作/对话',
                    reason: '精简防重复规则',
                    estimatedTokenDelta: -15
                }
            ],
            'hook-weak-ending': [
                {
                    action: 'replace',
                    findPattern: '章末钩子',
                    replacement: '章末必须：异常变量/未解之谜/新发现/关系转折（任选1），禁纯静态安抚结尾',
                    reason: '明确钩子具体形式',
                    estimatedTokenDelta: -5
                }
            ],
            'horror-description': [
                {
                    action: 'replace',
                    findPattern: '禁恐怖',
                    replacement: '禁恐怖：暗红纹路/鬼爪/阴森/古咒。可用科学奇幻化表达',
                    reason: '精简恐怖禁用词',
                    estimatedTokenDelta: -5
                }
            ],
            'info-dump': [
                {
                    action: 'replace',
                    findPattern: '展示代替告知',
                    replacement: '设定≤2句+角色反应≥1句，禁连续3句纯设定',
                    reason: '量化信息注入限制',
                    estimatedTokenDelta: -10
                }
            ],
            'baby-cute-missing': [
                {
                    action: 'replace',
                    findPattern: '萌感',
                    replacement: '每章≥3处萌感行为（拍手/蹦跳/抱大腿/蹭人/歪头/哼唧/吧唧）',
                    reason: '量化萌感频率',
                    estimatedTokenDelta: -5
                }
            ],
            'dialogue-style': [
                {
                    action: 'replace',
                    findPattern: '对话',
                    replacement: '成人对幼崽：短句+叠词+具象比喻，禁抽象词。成人之间正常表达',
                    reason: '精简对话降维规则',
                    estimatedTokenDelta: -5
                }
            ],
            'character-consistency': [
                {
                    action: 'replace',
                    findPattern: '角色称呼',
                    replacement: '物品/设定引用前回查前文，禁同一物品属性突变',
                    reason: '精简一致性检查',
                    estimatedTokenDelta: -10
                }
            ]
        };

        return templates[patternId] || [{ action: 'note', message: '暂无此模式的优化模板', reason: '需要手动分析' }];
    }

    applyOptimization(patternId, suggestionIndex = 0, customModification = null) {
        const canOpt = this.canOptimize(patternId);
        if (!canOpt.allowed) return { success: false, error: canOpt.reason };

        const pattern = PROBLEM_PATTERNS.find(p => p.id === patternId);
        if (!pattern) return { success: false, error: '未知问题模式' };

        const suggestion = this.generateSuggestion(patternId);
        if (suggestion.error) return { success: false, error: suggestion.error };

        const sug = customModification || suggestion.suggestions[suggestionIndex];
        if (!sug) return { success: false, error: '无效的建议索引' };

        const profile = getStyleProfileForProject(this.projectId);
        if (!profile) return { success: false, error: '项目无风格配置' };

        const oldValue = profile[pattern.targetField] || '';
        const oldTokens = estimateTokens(oldValue);

        let newValue = oldValue;
        if (sug.action === 'append') {
            if (oldValue.includes(sug.addition.substring(0, 20))) {
                return { success: false, error: '该优化内容已存在，避免重复注入' };
            }
            newValue = oldValue + '\n' + sug.addition;
        } else if (sug.action === 'replace' && sug.findPattern) {
            const idx = oldValue.indexOf(sug.findPattern);
            if (idx >= 0) {
                newValue = oldValue.substring(0, idx) + sug.replacement + oldValue.substring(idx + sug.findPattern.length);
            } else {
                newValue = oldValue + '\n' + sug.replacement;
            }
        } else if (sug.action === 'custom' && customModification) {
            newValue = customModification.newValue;
        } else if (sug.action === 'note') {
            return { success: false, error: '此模式无需修改提示词：' + sug.message };
        }

        const charDelta = newValue.length - oldValue.length;
        if (Math.abs(charDelta) > OPTIMIZER_LIMITS.MAX_MODIFICATION_CHARS) {
            return { success: false, error: `修改量${charDelta}字超过上限${OPTIMIZER_LIMITS.MAX_MODIFICATION_CHARS}字` };
        }

        const newTokens = estimateTokens(newValue);
        const tokenDelta = newTokens - oldTokens;
        if (tokenDelta > OPTIMIZER_LIMITS.TOKEN_DELTA_MAX) {
            return { success: false, error: `Token增量${tokenDelta}超过上限${OPTIMIZER_LIMITS.TOKEN_DELTA_MAX}（只减不增原则）` };
        }

        const mockProfile = { ...profile, [pattern.targetField]: newValue };
        const mockSystem = this._buildMockSystem(mockProfile);
        const auditResult = promptAuditor.audit(mockSystem, '', 'writer');
        if (auditResult.healthScore < OPTIMIZER_LIMITS.MIN_HEALTH_SCORE_AFTER) {
            return { success: false, error: `修改后健康度${auditResult.healthScore}<${OPTIMIZER_LIMITS.MIN_HEALTH_SCORE_AFTER}，存在重复/膨胀风险` };
        }

        this._saveSnapshot(pattern.targetField, oldValue, pattern.targetCollection);

        const profiles = store.listItems('style-profiles');
        const targetProfile = profiles.find(p => p.key === profile.key || p.id === profile.id);
        if (targetProfile) {
            targetProfile[pattern.targetField] = newValue;
            store.setItem('style-profiles', targetProfile.id, targetProfile);
        }

        const project = store.getItem('projects', this.projectId);
        if (!project._optimizationLog) project._optimizationLog = [];
        project._optimizationLog.push({
            patternId,
            category: pattern.category,
            targetField: pattern.targetField,
            oldTokens,
            newTokens,
            tokenDelta,
            healthScoreAfter: auditResult.healthScore,
            timestamp: new Date().toISOString()
        });
        store.setItem('projects', this.projectId, project);

        return {
            success: true,
            patternId,
            targetField: pattern.targetField,
            charDelta,
            tokenDelta,
            healthScoreAfter: auditResult.healthScore,
            oldValue: oldValue.substring(0, 300),
            newValue: newValue.substring(0, 300)
        };
    }

    _buildMockSystem(profile) {
        const project = store.getItem('projects', this.projectId);
        const mode = project?.mode || 'novel';
        const foundation = buildFoundationPrompt('writer', mode, this.projectId);
        const agent = getAgentPrompt('writer', mode, this.projectId);
        const constraint = buildConstraintInjection(this.projectId);
        return deduplicateSystemPrompt(foundation + '\n\n' + (agent.system || '') + constraint, 'writer');
    }

    _saveSnapshot(field, oldValue, collection) {
        const snapshots = store.listItems('prompt-snapshots');
        const project = store.getItem('projects', this.projectId);
        const snapshot = {
            id: `snap_${Date.now()}`,
            projectId: this.projectId,
            collection,
            field,
            oldValue,
            oldTokens: estimateTokens(oldValue),
            createdAt: new Date().toISOString(),
            projectName: project?.name || ''
        };
        store.setItem('prompt-snapshots', snapshot.id, snapshot);
        return snapshot.id;
    }

    rollback(snapshotId) {
        const snapshot = store.getItem('prompt-snapshots', snapshotId);
        if (!snapshot) return { success: false, error: '快照不存在' };

        const profiles = store.listItems('style-profiles');
        const profile = getStyleProfileForProject(this.projectId);
        if (!profile) return { success: false, error: '风格配置不存在' };

        const targetProfile = profiles.find(p => p.key === profile.key || p.id === profile.id);
        if (targetProfile) {
            targetProfile[snapshot.field] = snapshot.oldValue;
            store.setItem('style-profiles', targetProfile.id, targetProfile);
        }

        return {
            success: true,
            field: snapshot.field,
            restoredValue: snapshot.oldValue.substring(0, 300),
            restoredTokens: snapshot.oldTokens
        };
    }

    getOptimizationHistory() {
        const project = store.getItem('projects', this.projectId);
        return {
            log: project?._optimizationLog || [],
            snapshots: store.listItems('prompt-snapshots').filter(s => s.projectId === this.projectId)
        };
    }

    getFullReport(lastNChapters = 10) {
        const detection = this.detectProblemPatterns(lastNChapters);
        const history = this.getOptimizationHistory();

        return {
            detection,
            history,
            limits: OPTIMIZER_LIMITS,
            canOptimize: detection.patterns.map(p => ({
                patternId: p.patternId,
                category: p.category,
                ...this.canOptimize(p.patternId)
            }))
        };
    }
}

module.exports = { PromptOptimizer, PROBLEM_PATTERNS, OPTIMIZER_LIMITS };
