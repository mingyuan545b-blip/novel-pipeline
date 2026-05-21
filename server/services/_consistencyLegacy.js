const store = require('../store');
const stateSnapshot = require('./stateSnapshot');
const llm = require('./llm');

const SEVERITY = {
    CRITICAL: 'critical',
    WARNING: 'warning',
    INFO: 'info'
};

const CHECK_DIMENSIONS = {
    CHARACTER: 'character',
    RELATIONSHIP: 'relationship',
    POWER: 'power',
    TIMELINE: 'timeline',
    FORESHADOWING: 'foreshadowing',
    WORLDVIEW: 'worldview'
};

class ConsistencyEngine {
    async fullCheck(projectId, chapterNumber, chapterContent, chapterOutline) {
        const results = [];

        const [charResults, relResults, powerResults, timelineResults, foreshadowResults, worldResults] = await Promise.all([
            this.checkCharacterConsistency(projectId, chapterNumber, chapterContent),
            this.checkRelationshipConsistency(projectId, chapterNumber, chapterContent),
            this.checkPowerConsistency(projectId, chapterNumber, chapterContent),
            this.checkTimelineConsistency(projectId, chapterNumber, chapterContent),
            this.checkForeshadowingConsistency(projectId, chapterNumber, chapterContent),
            this.checkWorldviewConsistency(projectId, chapterNumber, chapterContent)
        ]);

        results.push(...charResults, ...relResults, ...powerResults, ...timelineResults, ...foreshadowResults, ...worldResults);

        const summary = {
            projectId,
            chapterNumber,
            timestamp: new Date().toISOString(),
            totalIssues: results.length,
            criticalCount: results.filter(r => r.severity === SEVERITY.CRITICAL).length,
            warningCount: results.filter(r => r.severity === SEVERITY.WARNING).length,
            infoCount: results.filter(r => r.severity === SEVERITY.INFO).length,
            dimensions: {
                character: charResults.length,
                relationship: relResults.length,
                power: powerResults.length,
                timeline: timelineResults.length,
                foreshadowing: foreshadowResults.length,
                worldview: worldResults.length
            },
            issues: results,
            passed: results.filter(r => r.severity === SEVERITY.CRITICAL).length === 0
        };

        await store.setItem('consistency-reports', `${projectId}_ch${chapterNumber}_${Date.now()}`, summary);
        return summary;
    }

    async quickCheck(projectId, chapterNumber, chapterContent) {
        const results = [];
        const charResults = await this.checkCharacterConsistency(projectId, chapterNumber, chapterContent);
        const powerResults = await this.checkPowerConsistency(projectId, chapterNumber, chapterContent);
        results.push(...charResults, ...powerResults);
        return {
            passed: results.filter(r => r.severity === SEVERITY.CRITICAL).length === 0,
            issues: results,
            criticalCount: results.filter(r => r.severity === SEVERITY.CRITICAL).length
        };
    }

    async checkCharacterConsistency(projectId, chapterNumber, chapterContent) {
        const issues = [];
        const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
        const characters = materials.filter(m => m.type === 'character');

        const snapshot = await stateSnapshot.getSnapshot(projectId, chapterNumber - 1);
        if (!snapshot) return issues;

        for (const char of characters) {
            const charState = snapshot.characterStates?.[char.id];
            if (!charState) continue;

            const name = char.name;
            const content = chapterContent || '';

            if (content.includes(name)) {
                if (charState.status === '死亡' || charState.status === '已故') {
                    const context = this._extractContext(content, name, 50);
                    if (!context.includes('回忆') && !context.includes('幻象') && !context.includes('梦中') && !context.includes('记忆')) {
                        issues.push({
                            dimension: CHECK_DIMENSIONS.CHARACTER,
                            severity: SEVERITY.CRITICAL,
                            title: '已故角色出现',
                            description: `角色"${name}"在第${charState.lastAppearanceChapter || '?'}章已标记为"${charState.status}"，但在第${chapterNumber}章中直接出现`,
                            characterId: char.id,
                            characterName: name,
                            context,
                            suggestion: `确认"${name}"是否真的复活，或改为回忆/梦境/幻象形式出现`
                        });
                    }
                }

                if (charState.location && charState.location !== '未知' && charState.location !== '行踪不定') {
                    const locationMentions = this._findLocationMentions(content, name, charState.location);
                    if (locationMentions.conflict) {
                        issues.push({
                            dimension: CHECK_DIMENSIONS.CHARACTER,
                            severity: SEVERITY.WARNING,
                            title: '角色位置矛盾',
                            description: `角色"${name}"上一章在"${charState.location}"，本章出现位置可能矛盾`,
                            characterId: char.id,
                            characterName: name,
                            expectedLocation: charState.location,
                            context: locationMentions.context,
                            suggestion: `确认"${name}"是否有合理的移动理由`
                        });
                    }
                }

                const charContent = char.currentContent || char.initialContent || '';
                const traits = this._extractCharacterTraits(charContent);
                for (const trait of traits) {
                    const contradiction = this._detectTraitContradiction(content, name, trait);
                    if (contradiction) {
                        issues.push({
                            dimension: CHECK_DIMENSIONS.CHARACTER,
                            severity: SEVERITY.WARNING,
                            title: '角色性格矛盾',
                            description: `角色"${name}"的设定特征"${trait}"与本章行为可能矛盾`,
                            characterId: char.id,
                            characterName: name,
                            trait,
                            context: contradiction,
                            suggestion: `确认"${name}"的行为是否符合其性格设定，或是否有合理的变化理由`
                        });
                    }
                }
            }
        }

        return issues;
    }

    async checkRelationshipConsistency(projectId, chapterNumber, chapterContent) {
        const issues = [];
        const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
        const relationships = materials.filter(m => m.type === 'relationship');

        const snapshot = await stateSnapshot.getSnapshot(projectId, chapterNumber - 1);
        if (!snapshot) return issues;

        for (const rel of relationships) {
            const relState = snapshot.relationshipStates?.[rel.id];
            if (!relState) continue;

            const content = chapterContent || '';
            const relContent = rel.currentContent || rel.initialContent || '';
            const relName = rel.name;

            if (this._mentionsRelationship(content, relName)) {
                const relType = relState.type;
                const strength = relState.strength;

                if (relType === '敌对' || relType === '仇恨') {
                    const friendlyInteraction = this._detectFriendlyInteraction(content, relName);
                    if (friendlyInteraction && strength > 70) {
                        issues.push({
                            dimension: CHECK_DIMENSIONS.RELATIONSHIP,
                            severity: SEVERITY.WARNING,
                            title: '敌对关系友好互动',
                            description: `关系"${relName}"标记为${relType}(强度${strength})，但本章出现友好互动`,
                            relationshipId: rel.id,
                            relationshipName: relName,
                            context: friendlyInteraction,
                            suggestion: '确认是否有合理的和解/伪装/利益交换等解释'
                        });
                    }
                }

                if (relType === '恋人' || relType === '亲密') {
                    const hostileInteraction = this._detectHostileInteraction(content, relName);
                    if (hostileInteraction && strength > 60) {
                        issues.push({
                            dimension: CHECK_DIMENSIONS.RELATIONSHIP,
                            severity: SEVERITY.WARNING,
                            title: '亲密关系敌对互动',
                            description: `关系"${relName}"标记为${relType}(强度${strength})，但本章出现敌对互动`,
                            relationshipId: rel.id,
                            relationshipName: relName,
                            context: hostileInteraction,
                            suggestion: '确认是否有合理的误会/考验/转变等解释'
                        });
                    }
                }
            }
        }

        return issues;
    }

    async checkPowerConsistency(projectId, chapterNumber, chapterContent) {
        const issues = [];
        const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
        const powerSystems = materials.filter(m => m.type === 'power-system');
        const characters = materials.filter(m => m.type === 'character');

        const snapshot = await stateSnapshot.getSnapshot(projectId, chapterNumber - 1);
        if (!snapshot) return issues;

        for (const char of characters) {
            const charState = snapshot.characterStates?.[char.id];
            if (!charState) continue;

            const name = char.name;
            const content = chapterContent || '';

            if (content.includes(name) && charState.powerLevel && charState.powerLevel !== '未知') {
                const powerChange = this._detectPowerChange(content, name);
                if (powerChange) {
                    const prevPower = charState.powerLevel;
                    const isBreakthrough = this._isBreakthrough(content, name);

                    if (!isBreakthrough && this._isPowerDowngrade(prevPower, powerChange.newLevel)) {
                        issues.push({
                            dimension: CHECK_DIMENSIONS.POWER,
                            severity: SEVERITY.WARNING,
                            title: '战力异常下降',
                            description: `角色"${name}"战力从"${prevPower}"变为"${powerChange.newLevel}"，无明显理由`,
                            characterId: char.id,
                            characterName: name,
                            previousPower: prevPower,
                            newPower: powerChange.newLevel,
                            context: powerChange.context,
                            suggestion: '确认战力下降是否有合理解释（受伤/封印/消耗等）'
                        });
                    }

                    if (this._isPowerUpgrade(prevPower, powerChange.newLevel) && !isBreakthrough) {
                        issues.push({
                            dimension: CHECK_DIMENSIONS.POWER,
                            severity: SEVERITY.INFO,
                            title: '战力提升需确认',
                            description: `角色"${name}"战力从"${prevPower}"变为"${powerChange.newLevel}"`,
                            characterId: char.id,
                            characterName: name,
                            previousPower: prevPower,
                            newPower: powerChange.newLevel,
                            context: powerChange.context,
                            suggestion: '确认战力提升是否有合理解释（突破/获得传承/觉醒等）'
                        });
                    }
                }
            }
        }

        for (const ps of powerSystems) {
            const psContent = ps.currentContent || ps.initialContent || '';
            const rules = this._extractPowerRules(psContent);
            for (const rule of rules) {
                const violation = this._detectPowerRuleViolation(content, rule);
                if (violation) {
                    issues.push({
                        dimension: CHECK_DIMENSIONS.POWER,
                        severity: SEVERITY.CRITICAL,
                        title: '战力体系规则违反',
                        description: `战力体系"${ps.name}"的规则"${rule}"可能被违反`,
                        powerSystemId: ps.id,
                        powerSystemName: ps.name,
                        rule,
                        context: violation,
                        suggestion: '确认是否需要修改战力体系设定或修正章节内容'
                    });
                }
            }
        }

        return issues;
    }

    async checkTimelineConsistency(projectId, chapterNumber, chapterContent) {
        const issues = [];
        const timelines = await store.queryItems('timelines', t => t.projectId === projectId);
        const snapshot = await stateSnapshot.getSnapshot(projectId, chapterNumber - 1);
        if (!snapshot) return issues;

        const content = chapterContent || '';
        const timeIndicators = this._extractTimeIndicators(content);

        if (timeIndicators.length > 0 && timelines.length > 0) {
            const sortedTimelines = timelines.sort((a, b) => (a.order || 0) - (b.order || 0));
            const prevEvents = sortedTimelines.filter(t => t.chapterNumber < chapterNumber);
            const lastEvent = prevEvents[prevEvents.length - 1];

            if (lastEvent) {
                for (const indicator of timeIndicators) {
                    if (indicator.type === 'flashback' && indicator.explicitChapter) {
                        const flashbackChapter = parseInt(indicator.explicitChapter);
                        if (flashbackChapter > chapterNumber) {
                            issues.push({
                                dimension: CHECK_DIMENSIONS.TIMELINE,
                                severity: SEVERITY.CRITICAL,
                                title: '时间线倒置',
                                description: `第${chapterNumber}章出现回忆第${flashbackChapter}章的内容，但第${flashbackChapter}章尚未发生`,
                                context: indicator.context,
                                suggestion: '修正回忆引用的章节号，或调整时间线'
                            });
                        }
                    }

                    if (indicator.type === 'timeSkip' && indicator.duration) {
                        const prevTimeContext = lastEvent.timeContext || '';
                        if (prevTimeContext && this._isTimeContradiction(prevTimeContext, indicator)) {
                            issues.push({
                                dimension: CHECK_DIMENSIONS.TIMELINE,
                                severity: SEVERITY.WARNING,
                                title: '时间跨度矛盾',
                                description: `时间跳跃"${indicator.duration}"可能与之前的时间上下文矛盾`,
                                context: indicator.context,
                                suggestion: '确认时间流逝是否合理'
                            });
                        }
                    }
                }
            }
        }

        const quests = await store.queryItems('quests', q => q.projectId === projectId);
        const activeQuests = quests.filter(q => q.status === 'active');
        for (const quest of activeQuests) {
            if (quest.requiredByChapter && chapterNumber > quest.requiredByChapter && quest.progress < 100) {
                issues.push({
                    dimension: CHECK_DIMENSIONS.TIMELINE,
                    severity: SEVERITY.WARNING,
                    title: '主线任务超时',
                    description: `主线任务"${quest.name}"应在第${quest.requiredByChapter}章前完成，但当前进度仅${quest.progress}%`,
                    questId: quest.id,
                    questName: quest.name,
                    requiredBy: quest.requiredByChapter,
                    currentProgress: quest.progress,
                    suggestion: '推进该任务或调整完成时限'
                });
            }
        }

        return issues;
    }

    async checkForeshadowingConsistency(projectId, chapterNumber, chapterContent) {
        const issues = [];
        const tracker = await stateSnapshot.getForeshadowingTracker(projectId);
        const content = chapterContent || '';

        for (const fs of tracker) {
            if (fs.status === 'planted' && fs.urgency > 80) {
                issues.push({
                    dimension: CHECK_DIMENSIONS.FORESHADOWING,
                    severity: SEVERITY.WARNING,
                    title: '伏笔长期未回收',
                    description: `伏笔"${fs.name}"在第${fs.plantedChapter}章埋下，已过${chapterNumber - fs.plantedChapter}章仍未回收`,
                    foreshadowingId: fs.id,
                    foreshadowingName: fs.name,
                    plantedChapter: fs.plantedChapter,
                    chaptersSincePlanted: chapterNumber - fs.plantedChapter,
                    suggestion: '考虑在近期章节中回收此伏笔，或更新其状态'
                });
            }

            if (fs.status === 'harvesting' && content.includes(fs.name)) {
                issues.push({
                    dimension: CHECK_DIMENSIONS.FORESHADOWING,
                    severity: SEVERITY.INFO,
                    title: '伏笔回收进行中',
                    description: `伏笔"${fs.name}"可能在本章被回收`,
                    foreshadowingId: fs.id,
                    foreshadowingName: fs.name,
                    suggestion: '确认伏笔是否完整回收，更新伏笔状态为"已回收"'
                });
            }
        }

        const newForeshadowingHints = this._detectNewForeshadowing(content);
        if (newForeshadowingHints.length > 0) {
            issues.push({
                dimension: CHECK_DIMENSIONS.FORESHADOWING,
                severity: SEVERITY.INFO,
                title: '检测到新伏笔线索',
                description: `本章可能埋下了${newForeshadowingHints.length}个新伏笔线索`,
                detectedHints: newForeshadowingHints,
                suggestion: '确认是否需要将这些线索登记为正式伏笔'
            });
        }

        return issues;
    }

    async checkWorldviewConsistency(projectId, chapterNumber, chapterContent) {
        const issues = [];
        const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
        const worldviews = materials.filter(m => m.type === 'worldview');
        const content = chapterContent || '';

        for (const wv of worldviews) {
            const wvContent = wv.currentContent || wv.initialContent || '';
            const rules = this._extractWorldRules(wvContent);

            for (const rule of rules) {
                const violation = this._detectWorldRuleViolation(content, rule);
                if (violation) {
                    issues.push({
                        dimension: CHECK_DIMENSIONS.WORLDVIEW,
                        severity: SEVERITY.CRITICAL,
                        title: '世界观规则违反',
                        description: `世界观"${wv.name}"的规则可能被违反: ${rule.substring(0, 50)}...`,
                        worldviewId: wv.id,
                        worldviewName: wv.name,
                        rule: rule.substring(0, 100),
                        context: violation,
                        suggestion: '确认是否需要修改世界观设定或修正章节内容'
                    });
                }
            }
        }

        return issues;
    }

    async aiAssistedCheck(projectId, chapterNumber, chapterContent, apiConfig) {
        const snapshot = await stateSnapshot.getSnapshot(projectId, chapterNumber - 1);
        if (!snapshot) return { issues: [], passed: true };

        const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
        const materialSummary = materials.slice(0, 20).map(m =>
            `[${m.type}] ${m.name}: ${(m.currentContent || m.initialContent || '').substring(0, 100)}`
        ).join('\n');

        const stateSummary = this._formatStateSummary(snapshot);

        const prompt = `你是一位严谨的小说一致性审核专家。请检查以下章节内容是否与已建立的设定和状态一致。

【素材库摘要】
${materialSummary}

【上一章世界状态】
${stateSummary}

【本章内容】
${(chapterContent || '').substring(0, 3000)}

请检查以下维度并输出JSON：
1. 人物一致性：角色行为是否符合性格设定？位置是否合理？
2. 关系一致性：人物互动是否符合已建立的关系？
3. 战力一致性：战力表现是否与设定匹配？有无不合理突破？
4. 时间线一致性：事件顺序是否合理？有无时间矛盾？
5. 伏笔一致性：伏笔回收是否合理？有无遗忘的伏笔？
6. 世界观一致性：是否违反了世界观的基本规则？

输出格式：
{
  "issues": [
    {
      "dimension": "character|relationship|power|timeline|foreshadowing|worldview",
      "severity": "critical|warning|info",
      "title": "问题标题",
      "description": "详细描述",
      "suggestion": "修改建议"
    }
  ],
  "passed": true/false,
  "overallComment": "总体评价"
}`;

        try {
            const response = await llm.chat([
                { role: 'system', content: '你是小说一致性审核专家，只输出JSON。' },
                { role: 'user', content: prompt }
            ], { apiConfig, temperature: 0.1 });

            const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const result = JSON.parse(jsonStr);
            return result;
        } catch (e) {
            return { issues: [], passed: true, error: e.message };
        }
    }

    async getReportHistory(projectId) {
        const reports = await store.queryItems('consistency-reports', r => r.projectId === projectId);
        return reports.sort((a, b) => (b.chapterNumber || 0) - (a.chapterNumber || 0));
    }

    _extractContext(content, keyword, radius = 50) {
        const idx = content.indexOf(keyword);
        if (idx === -1) return '';
        const start = Math.max(0, idx - radius);
        const end = Math.min(content.length, idx + keyword.length + radius);
        return '...' + content.substring(start, end) + '...';
    }

    _extractCharacterTraits(content) {
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

    _detectTraitContradiction(content, name, trait) {
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
            if (segment.includes(c)) {
                return this._extractContext(segment, c, 30);
            }
        }
        return null;
    }

    _findLocationMentions(content, name, expectedLocation) {
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
                    if (hasLocation) {
                        return { conflict: true, context: this._extractContext(segment, kw, 20) };
                    }
                }
            }
        }
        return { conflict: false };
    }

    _mentionsRelationship(content, relName) {
        if (!relName) return false;
        const parts = relName.split(/[与和及→←↔\-]/);
        return parts.every(p => content.includes(p.trim()));
    }

    _detectFriendlyInteraction(content, relName) {
        const friendlyWords = ['微笑', '拥抱', '握手', '感谢', '帮助', '合作', '信任', '友善', '亲切'];
        const parts = relName.split(/[与和及→←↔\-]/);
        if (parts.length < 2) return null;
        const segment = this._findSegmentWithBoth(content, parts[0].trim(), parts[1].trim());
        if (!segment) return null;
        for (const fw of friendlyWords) {
            if (segment.includes(fw)) return this._extractContext(segment, fw, 20);
        }
        return null;
    }

    _detectHostileInteraction(content, relName) {
        const hostileWords = ['怒', '恨', '杀', '打', '骂', '攻击', '敌视', '冲突', '决裂'];
        const parts = relName.split(/[与和及→←↔\-]/);
        if (parts.length < 2) return null;
        const segment = this._findSegmentWithBoth(content, parts[0].trim(), parts[1].trim());
        if (!segment) return null;
        for (const hw of hostileWords) {
            if (segment.includes(hw)) return this._extractContext(segment, hw, 20);
        }
        return null;
    }

    _findSegmentWithBoth(content, name1, name2) {
        const idx1 = content.indexOf(name1);
        const idx2 = content.indexOf(name2);
        if (idx1 === -1 || idx2 === -1) return null;
        const start = Math.max(0, Math.min(idx1, idx2) - 100);
        const end = Math.min(content.length, Math.max(idx1, idx2) + 200);
        return content.substring(start, end);
    }

    _detectPowerChange(content, name) {
        const nameIdx = content.indexOf(name);
        if (nameIdx === -1) return null;
        const segment = content.substring(Math.max(0, nameIdx - 50), Math.min(content.length, nameIdx + 300));
        const powerKeywords = ['突破', '晋级', '升阶', '实力大增', '修为精进', '境界提升', '战力飙升', '实力暴增'];
        const downgradeKeywords = ['修为尽失', '实力大减', '跌落', '退化', '封印', '削弱'];

        for (const kw of powerKeywords) {
            if (segment.includes(kw)) {
                return { newLevel: kw, context: this._extractContext(segment, kw, 30), direction: 'up' };
            }
        }
        for (const kw of downgradeKeywords) {
            if (segment.includes(kw)) {
                return { newLevel: kw, context: this._extractContext(segment, kw, 30), direction: 'down' };
            }
        }
        return null;
    }

    _isBreakthrough(content, name) {
        const breakthroughWords = ['突破', '顿悟', '觉醒', '传承', '蜕变', '涅槃', '机缘', '奇遇'];
        const nameIdx = content.indexOf(name);
        if (nameIdx === -1) return false;
        const segment = content.substring(Math.max(0, nameIdx - 100), Math.min(content.length, nameIdx + 500));
        return breakthroughWords.some(w => segment.includes(w));
    }

    _isPowerDowngrade(prev, newLevel) {
        const levels = ['凡人', '入门', '初阶', '中阶', '高阶', '大师', '宗师', '超凡', '圣境', '神境', '至高'];
        const prevIdx = levels.findIndex(l => prev.includes(l));
        const newIdx = levels.findIndex(l => newLevel.includes(l));
        if (prevIdx === -1 || newIdx === -1) return true;
        return newIdx < prevIdx;
    }

    _isPowerUpgrade(prev, newLevel) {
        const levels = ['凡人', '入门', '初阶', '中阶', '高阶', '大师', '宗师', '超凡', '圣境', '神境', '至高'];
        const prevIdx = levels.findIndex(l => prev.includes(l));
        const newIdx = levels.findIndex(l => newLevel.includes(l));
        if (prevIdx === -1 || newIdx === -1) return true;
        return newIdx > prevIdx;
    }

    _extractPowerRules(content) {
        const rules = [];
        const lines = content.split(/[。\n]/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.includes('不可') || trimmed.includes('不能') || trimmed.includes('禁止') ||
                trimmed.includes('必须') || trimmed.includes('只能') || trimmed.includes('无法') ||
                trimmed.includes('绝不') || trimmed.includes('规则') || trimmed.includes('定律')) {
                if (trimmed.length > 5 && trimmed.length < 100) {
                    rules.push(trimmed);
                }
            }
        }
        return rules;
    }

    _detectPowerRuleViolation(content, rule) {
        const keyTerms = rule.replace(/不可|不能|禁止|必须|只能|无法|绝不/g, '').trim();
        if (keyTerms.length < 2) return null;
        if (content.includes(keyTerms)) {
            const negations = ['不可', '不能', '禁止', '无法', '绝不'];
            const isProhibition = negations.some(n => rule.includes(n));
            if (isProhibition) {
                return this._extractContext(content, keyTerms, 30);
            }
        }
        return null;
    }

    _extractTimeIndicators(content) {
        const indicators = [];
        const flashbackPatterns = [/回忆起第(\d+)章/, /想起第(\d+)章/, /回想起.*第(\d+)章/];
        const timeSkipPatterns = [/(\d+)天后/, /(\d+)个月后/, /(\d+)年后/, /过了(\d+)天/, /过了(\d+)个月/];

        for (const p of flashbackPatterns) {
            const match = content.match(p);
            if (match) {
                indicators.push({
                    type: 'flashback',
                    explicitChapter: match[1],
                    context: this._extractContext(content, match[0], 30)
                });
            }
        }

        for (const p of timeSkipPatterns) {
            const match = content.match(p);
            if (match) {
                indicators.push({
                    type: 'timeSkip',
                    duration: match[0],
                    context: this._extractContext(content, match[0], 30)
                });
            }
        }

        return indicators;
    }

    _isTimeContradiction(prevContext, indicator) {
        return false;
    }

    _detectNewForeshadowing(content) {
        const hints = [];
        const patterns = [
            /似乎.*?隐藏着.*?秘密/g,
            /暗藏.*?玄机/g,
            /不为人知.*?真相/g,
            /神秘.*?尚未揭开/g,
            /这一切.*?并非.*?简单/g,
            /隐隐约约.*?感觉/g
        ];
        for (const p of patterns) {
            const matches = content.match(p);
            if (matches) {
                hints.push(...matches.map(m => m.substring(0, 50)));
            }
        }
        return hints;
    }

    _extractWorldRules(content) {
        return this._extractPowerRules(content);
    }

    _detectWorldRuleViolation(content, rule) {
        return this._detectPowerRuleViolation(content, rule);
    }

    _formatStateSummary(snapshot) {
        const parts = [];
        if (snapshot.characterStates) {
            parts.push('人物状态:');
            for (const [id, s] of Object.entries(snapshot.characterStates)) {
                parts.push(`  ${s.name}: 位置=${s.location}, 战力=${s.powerLevel}, 状态=${s.status}`);
            }
        }
        if (snapshot.relationshipStates) {
            parts.push('人物关系:');
            for (const [id, r] of Object.entries(snapshot.relationshipStates)) {
                parts.push(`  ${r.name}: 类型=${r.type}, 强度=${r.strength}`);
            }
        }
        if (snapshot.foreshadowingStates) {
            parts.push('伏笔状态:');
            for (const [id, f] of Object.entries(snapshot.foreshadowingStates)) {
                parts.push(`  ${f.name}: 状态=${f.status}, 紧急度=${f.urgency}`);
            }
        }
        return parts.join('\n');
    }
}

module.exports = new ConsistencyEngine();
