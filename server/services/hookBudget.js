const store = require('../store');

const MAX_ACTIVE_HOOKS = 12;
const STALE_THRESHOLD_CHAPTERS = 30;
const URGENT_THRESHOLD_CHAPTERS = 5;

const MODE_STALE_THRESHOLDS = {
    shuangwen: 10,
    'tomato-short': 8,
    novel: 30
};

const MODE_URGENT_THRESHOLDS = {
    shuangwen: 3,
    'tomato-short': 2,
    novel: 5
};

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

class HookBudgetSystem {
    constructor(projectId) {
        this.projectId = projectId;
    }

    _getHookStore() {
        const project = store.getItem('projects', this.projectId);
        if (!project) return { hooks: [], lastUpdated: null };
        if (!project.hookBudget) {
            project.hookBudget = { hooks: [], lastUpdated: null };
            store.setItem('projects', this.projectId, project);
        }
        return project.hookBudget;
    }

    _saveHookStore(data) {
        const project = store.getItem('projects', this.projectId);
        if (!project) return;
        project.hookBudget = { ...data, lastUpdated: new Date().toISOString() };
        store.setItem('projects', this.projectId, project);
    }

    getActiveHooks() {
        const store = this._getHookStore();
        return (store.hooks || []).filter(h => h.status === 'open' || h.status === 'active');
    }

    getAllHooks() {
        const store = this._getHookStore();
        return store.hooks || [];
    }

    _getModeThresholds() {
        const project = store.getItem('projects', this.projectId);
        const mode = project?.mode || 'novel';
        return {
            stale: MODE_STALE_THRESHOLDS[mode] || STALE_THRESHOLD_CHAPTERS,
            urgent: MODE_URGENT_THRESHOLDS[mode] || URGENT_THRESHOLD_CHAPTERS
        };
    }

    getBudgetStatus(currentChapter) {
        const activeHooks = this.getActiveHooks();
        const remaining = Math.max(0, MAX_ACTIVE_HOOKS - activeHooks.length);
        const nearCapacity = activeHooks.length >= MAX_ACTIVE_HOOKS - 2;
        const overCapacity = activeHooks.length > MAX_ACTIVE_HOOKS;
        const thresholds = this._getModeThresholds();

        const staleHooks = activeHooks.filter(h => {
            if (!currentChapter) return false;
            const age = currentChapter - h.startChapter;
            return age > thresholds.stale;
        });

        const urgentHooks = activeHooks.filter(h => {
            if (!h.expectedPayoffEnd || !currentChapter) return false;
            return currentChapter >= h.expectedPayoffEnd - thresholds.urgent;
        });

        return {
            activeCount: activeHooks.length,
            maxCapacity: MAX_ACTIVE_HOOKS,
            remaining,
            nearCapacity,
            overCapacity,
            staleCount: staleHooks.length,
            urgentCount: urgentHooks.length,
            staleHooks,
            urgentHooks
        };
    }

    generateHookAgenda(currentChapter) {
        const activeHooks = this.getActiveHooks();
        const budget = this.getBudgetStatus(currentChapter);
        const thresholds = this._getModeThresholds();

        const mustAdvance = [];
        const eligibleResolve = [];
        const staleDebt = [];
        const avoidNewFamilies = new Set();

        for (const hook of activeHooks) {
            const age = currentChapter ? currentChapter - hook.startChapter : 0;

            if (budget.urgentHooks.includes(hook)) {
                eligibleResolve.push(hook);
                avoidNewFamilies.add(hook.type);
            }

            if (age > thresholds.stale) {
                staleDebt.push(hook);
                avoidNewFamilies.add(hook.type);
            }

            if (hook.lastAdvancedChapter && currentChapter &&
                currentChapter - hook.lastAdvancedChapter >= 5) {
                mustAdvance.push(hook);
            } else if (!hook.lastAdvancedChapter && currentChapter &&
                currentChapter - hook.startChapter >= 3) {
                mustAdvance.push(hook);
            }
        }

        return {
            mustAdvance: mustAdvance.map(h => ({ id: h.id, type: h.type, notes: h.notes })),
            eligibleResolve: eligibleResolve.map(h => ({ id: h.id, type: h.type, notes: h.notes })),
            staleDebt: staleDebt.map(h => ({ id: h.id, type: h.type, age: currentChapter - h.startChapter, notes: h.notes })),
            avoidNewFamilies: [...avoidNewFamilies],
            budget: {
                active: budget.activeCount,
                max: budget.maxCapacity,
                remaining: budget.remaining,
                nearCapacity: budget.nearCapacity,
                overCapacity: budget.overCapacity
            }
        };
    }

    formatHookAgendaForPrompt(currentChapter) {
        const agenda = this.generateHookAgenda(currentChapter);

        const lines = [];
        lines.push('【伏笔预算与Hook Agenda】');
        lines.push(`- 当前 ${agenda.budget.active} 条活跃伏笔 / 上限 ${agenda.budget.max} 条 — 剩余 ${agenda.budget.remaining} 个新坑位`);
        if (agenda.budget.nearCapacity) {
            lines.push('- ⚠ 接近容量上限！优先回收旧债，不要轻易开新线。');
        }
        if (agenda.budget.overCapacity) {
            lines.push('- 🚨 超出容量上限！必须回收旧债后才能开新伏笔。');
        }

        if (agenda.mustAdvance.length > 0) {
            lines.push('');
            lines.push('### Must Advance (必须推进)');
            agenda.mustAdvance.forEach(h => {
                lines.push(`- ${h.id}(${h.type}): ${h.notes}`);
            });
        }

        if (agenda.eligibleResolve.length > 0) {
            lines.push('');
            lines.push('### Eligible Resolve (可回收)');
            agenda.eligibleResolve.forEach(h => {
                lines.push(`- ${h.id}(${h.type}): ${h.notes}`);
            });
        }

        if (agenda.staleDebt.length > 0) {
            lines.push('');
            lines.push('### Stale Debt (过期旧债 — 必须优先处理)');
            agenda.staleDebt.forEach(h => {
                lines.push(`- ${h.id}(${h.type}, 已${h.age}章未回收): ${h.notes}`);
            });
        }

        if (agenda.avoidNewFamilies.length > 0) {
            lines.push('');
            lines.push('### Avoid New Hook Families (禁止新增此类伏笔)');
            agenda.avoidNewFamilies.forEach(f => {
                lines.push(`- ${f}`);
            });
        }

        return lines.join('\n');
    }

    registerHook(hookData) {
        const hookStore = this._getHookStore();
        const activeHooks = (hookStore.hooks || []).filter(h => h.status === 'open' || h.status === 'active');
        if (activeHooks.length >= MAX_ACTIVE_HOOKS) {
            console.warn(`[HOOK] 伏笔预算已满(${activeHooks.length}/${MAX_ACTIVE_HOOKS})，拒绝注册新伏笔: ${hookData.notes?.substring(0, 30) || hookData.type}`);
            return null;
        }

        const id = hookData.id || `H${String(hookStore.hooks.length + 1).padStart(3, '0')}`;

        const typeConfig = HOOK_TYPES[hookData.type] || HOOK_TYPES['伏笔铺垫'];

        const project = store.getItem('projects', this.projectId);
        const mode = project?.mode || 'novel';
        const totalChapters = project?.targetChapters || 100;
        const rangeScale = mode === 'shuangwen' ? 0.4 : mode === 'tomato-short' ? 0.35 : 1.0;

        const defaultStart = Math.max(3, Math.round(typeConfig.defaultRange[0] * rangeScale));
        const defaultEnd = Math.max(defaultStart + 3, Math.round(typeConfig.defaultRange[1] * rangeScale));

        const hook = {
            id,
            type: hookData.type || '伏笔铺垫',
            status: 'open',
            startChapter: hookData.startChapter || 0,
            lastAdvancedChapter: 0,
            expectedPayoffStart: hookData.expectedPayoffStart || defaultStart,
            expectedPayoffEnd: hookData.expectedPayoffEnd || Math.min(defaultEnd, totalChapters),
            payoffTiming: hookData.payoffTiming || typeConfig.payoffTiming,
            notes: hookData.notes || '',
            linkedHookIds: hookData.linkedHookIds || [],
            createdAt: new Date().toISOString()
        };

        hookStore.hooks.push(hook);
        this._saveHookStore(hookStore);
        return hook;
    }

    advanceHook(hookId, chapterNumber) {
        const hookStore = this._getHookStore();
        const hook = hookStore.hooks.find(h => h.id === hookId);
        if (!hook) return null;

        hook.lastAdvancedChapter = chapterNumber;
        if (hook.status === 'open') hook.status = 'active';
        this._saveHookStore(hookStore);
        return hook;
    }

    resolveHook(hookId, chapterNumber, resolution) {
        const hookStore = this._getHookStore();
        const hook = hookStore.hooks.find(h => h.id === hookId);
        if (!hook) return null;

        hook.status = 'resolved';
        hook.resolvedChapter = chapterNumber;
        hook.resolution = resolution || '';
        hook.resolvedAt = new Date().toISOString();
        this._saveHookStore(hookStore);
        return hook;
    }

    updateHooksFromContent(chapterNumber, content) {
        const results = { advanced: [], resolved: [], newDetected: [] };
        if (!content) return results;

        const activeHooks = this.getActiveHooks();

        for (const hook of activeHooks) {
            const hookKeywords = this._extractHookKeywords(hook);
            let mentionCount = 0;
            for (const kw of hookKeywords) {
                if (kw && content.includes(kw)) mentionCount++;
            }

            if (mentionCount >= 1) {
                const resolutionPatterns = [
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
                let isResolved = false;
                for (const pattern of resolutionPatterns) {
                    if (pattern.test(content)) {
                        isResolved = true;
                        break;
                    }
                }

                if (isResolved) {
                    const semanticOk = this._semanticVerifyResolution(hook, content);
                    if (semanticOk) {
                        this.resolveHook(hook.id, chapterNumber, `在第${chapterNumber}章正文中检测到回收`);
                        results.resolved.push(hook.id);
                    } else {
                        this.advanceHook(hook.id, chapterNumber);
                        results.advanced.push(hook.id);
                    }
                } else {
                    this.advanceHook(hook.id, chapterNumber);
                    results.advanced.push(hook.id);
                }
            }
        }

        const newHookPatterns = [
            { pattern: /隐藏.{0,4}(惊天|重大|致命|核心|古老).{0,4}秘密/, type: '伏笔铺垫' },
            { pattern: /暗藏.{0,4}(杀机|玄机|危机|陷阱|阴谋)/, type: '伏笔铺垫' },
            { pattern: /神秘.{0,4}(人|影|声音|力量|组织).{0,6}(出现|逼近|浮现|降临)/, type: '身份悬念' },
            { pattern: /似乎.{0,6}(知道|明白|察觉|发现).{0,6}(不对|阴谋|陷阱|危险)/, type: '威胁逼近' },
            { pattern: /隐约(看到|听到|感觉到|察觉).{0,10}(异样|异常|不对).{0,6}(但|却|然而|不过)/, type: '能力异常' }
        ];

        const budget = this.getBudgetStatus(chapterNumber);
        const AUTO_DETECT_MAX_PER_CHAPTER = 1;
        let autoDetected = 0;
        for (const { pattern, type } of newHookPatterns) {
            if (autoDetected >= AUTO_DETECT_MAX_PER_CHAPTER) break;
            if (pattern.test(content) && budget.remaining > 0) {
                const existing = activeHooks.find(h => h.type === type && (chapterNumber - h.startChapter) < 5);
                if (!existing) {
                    const match = content.match(pattern);
                    const contextSnippet = match ? match[0] : '';
                    const newHook = this.registerHook({
                        type,
                        startChapter: chapterNumber,
                        notes: `第${chapterNumber}章自动检测：「${contextSnippet}」`
                    });
                    if (newHook) {
                        results.newDetected.push(newHook.id);
                        autoDetected++;
                    }
                }
            }
        }

        return results;
    }

    _semanticVerifyResolution(hook, content) {
        const FALSE_POSITIVE_CONTEXTS = [
            /揭开.{0,2}(锅盖|盖子|帘子|幕布|纱布|瓶盖)/,
            /真相.{0,4}(不是|并非|远非|不在于)/,
            /原来.{0,4}(不是|并非|只是)/,
            /识破.{0,4}(陷阱|骗局|伪装).{0,6}(但|却|然而|不过)/,
            /揭露.{0,4}(的只是|的不过)/,
            /破局.{0,4}(失败|未成|不成)/,
            /秘密.{0,4}(依然|仍然|依旧|还是|并未)/
        ];
        for (const fp of FALSE_POSITIVE_CONTEXTS) {
            if (fp.test(content)) return false;
        }

        const hookKeywords = this._extractHookKeywords(hook);
        let keywordNearResolution = false;
        for (const kw of hookKeywords) {
            if (!kw) continue;
            const kwIdx = content.indexOf(kw);
            if (kwIdx === -1) continue;
            const nearby = content.substring(Math.max(0, kwIdx - 50), Math.min(content.length, kwIdx + 50));
            if (/真相|揭露|揭开|识破|破局|坦白|揭晓|大白/.test(nearby)) {
                keywordNearResolution = true;
                break;
            }
        }
        return keywordNearResolution || hookKeywords.length === 0;
    }

    _extractHookKeywords(hook) {
        const keywords = [];
        if (hook.notes) {
            const segments = hook.notes.split(/[—\-，。、：；""''（）\[\]【】\s]/);
            for (const seg of segments) {
                const trimmed = seg.trim();
                if (trimmed.length >= 2 && trimmed.length <= 15) {
                    keywords.push(trimmed);
                }
            }
            const fullNotes = hook.notes.trim();
            if (fullNotes.length >= 2 && fullNotes.length <= 30) {
                keywords.push(fullNotes);
            }
        }
        if (hook.type) keywords.push(hook.type);
        const typeAliases = {
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
        if (hook.type && typeAliases[hook.type]) {
            keywords.push(...typeAliases[hook.type]);
        }
        return keywords.filter(k => k.length > 0);
    }

    syncFromForeshadowingMaterials() {
        const materials = store.queryItems('materials', { projectId: this.projectId });
        const foreshadowings = materials.filter(m => m.type === 'foreshadowing' && !m.archived);
        const hookStore = this._getHookStore();
        const existingNotes = new Set((hookStore.hooks || []).map(h => h.notes));

        let imported = 0;
        for (const f of foreshadowings) {
            const content = f.currentContent || f.initialContent || '';
            const isRecycled = content.includes('已回收') || content.includes('已揭示') || content.includes('已解决');
            const nameMatch = f.name.match(/第?(\d+)[章回]?/);
            const startChapter = nameMatch ? parseInt(nameMatch[1]) : 1;

            const existingHook = (hookStore.hooks || []).find(h =>
                h.notes && h.notes.includes(f.name)
            );

            if (existingHook) {
                if (isRecycled && existingHook.status !== 'resolved') {
                    existingHook.status = 'resolved';
                    existingHook.resolution = `素材库标记为已回收: ${f.name}`;
                }
            } else if (!isRecycled && !existingNotes.has(f.name)) {
                this.registerHook({
                    type: '伏笔铺垫',
                    startChapter,
                    notes: f.name,
                    payoffTiming: 'mid-arc'
                });
                imported++;
            }
        }

        return imported;
    }

    getHooksSummary() {
        const allHooks = this.getAllHooks();
        const active = allHooks.filter(h => h.status === 'open' || h.status === 'active');
        const resolved = allHooks.filter(h => h.status === 'resolved');

        const byType = {};
        for (const h of active) {
            byType[h.type] = (byType[h.type] || 0) + 1;
        }

        return {
            total: allHooks.length,
            active: active.length,
            resolved: resolved.length,
            byType,
            hooks: allHooks.map(h => ({
                id: h.id,
                type: h.type,
                status: h.status,
                start: h.startChapter,
                lastAdvanced: h.lastAdvancedChapter,
                expectedPayoff: `${h.expectedPayoffStart}-${h.expectedPayoffEnd}`,
                notes: h.notes
            }))
        };
    }
    cleanupInvalidHooks() {
        const hookStore = this._getHookStore();
        const INVALID_NOTES_PATTERNS = [
            /^(archiveLog|归档清单|新建素材|类型：|伏笔状态总览|伏笔执行计划)/,
            /^\d+\.\s/,
            /^`?\d+\./,
            /^\s*$/
        ];
        const before = hookStore.hooks.length;
        hookStore.hooks = hookStore.hooks.filter(h => {
            if (!h.notes || h.notes.trim().length < 3) return false;
            for (const pattern of INVALID_NOTES_PATTERNS) {
                if (pattern.test(h.notes.trim())) return false;
            }
            return true;
        });
        const removed = before - hookStore.hooks.length;
        if (removed > 0) {
            this._saveHookStore(hookStore);
            console.log(`[HOOK] 清理了${removed}条无效伏笔记录`);
        }
        return { removed, remaining: hookStore.hooks.length };
    }
}

function getHookBudgetForProject(projectId) {
    return new HookBudgetSystem(projectId);
}

module.exports = {
    HookBudgetSystem,
    getHookBudgetForProject,
    MAX_ACTIVE_HOOKS,
    HOOK_TYPES
};
