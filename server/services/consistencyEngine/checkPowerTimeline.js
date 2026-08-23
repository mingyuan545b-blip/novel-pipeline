const store = require('../../store');
const stateSnapshot = require('../stateSnapshot');
const { SEVERITY, CHECK_DIMENSIONS } = require('./constants');
const ext = require('./extractors');

async function checkPowerConsistency(projectId, chapterNumber, chapterContent) {
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
            const powerChange = ext.detectPowerChange(content, name);
            if (powerChange) {
                const prevPower = charState.powerLevel;
                const isBt = ext.isBreakthrough(content, name);
                if (!isBt && ext.isPowerDowngrade(prevPower, powerChange.newLevel)) {
                    issues.push({
                        dimension: CHECK_DIMENSIONS.POWER, severity: SEVERITY.WARNING,
                        title: '战力异常下降',
                        description: `角色"${name}"战力从"${prevPower}"变为"${powerChange.newLevel}"，无明显理由`,
                        characterId: char.id, characterName: name, previousPower: prevPower,
                        newPower: powerChange.newLevel, context: powerChange.context,
                        suggestion: '确认战力下降是否有合理解释（受伤/封印/消耗等）'
                    });
                }
                if (ext.isPowerUpgrade(prevPower, powerChange.newLevel) && !isBt) {
                    issues.push({
                        dimension: CHECK_DIMENSIONS.POWER, severity: SEVERITY.INFO,
                        title: '战力提升需确认',
                        description: `角色"${name}"战力从"${prevPower}"变为"${powerChange.newLevel}"`,
                        characterId: char.id, characterName: name, previousPower: prevPower,
                        newPower: powerChange.newLevel, context: powerChange.context,
                        suggestion: '确认战力提升是否有合理解释（突破/获得传承/觉醒等）'
                    });
                }
            }
        }
    }

    for (const ps of powerSystems) {
        const psContent = ps.currentContent || ps.initialContent || '';
        const rules = ext.extractPowerRules(psContent);
        for (const rule of rules) {
            const violation = ext.detectPowerRuleViolation(content, rule);
            if (violation) {
                issues.push({
                    dimension: CHECK_DIMENSIONS.POWER, severity: SEVERITY.CRITICAL,
                    title: '战力体系规则违反',
                    description: `战力体系"${ps.name}"的规则"${rule}"可能被违反`,
                    powerSystemId: ps.id, powerSystemName: ps.name, rule, context: violation,
                    suggestion: '确认是否需要修改战力体系设定或修正章节内容'
                });
            }
        }
    }
    return issues;
}

async function checkTimelineConsistency(projectId, chapterNumber, chapterContent) {
    const issues = [];
    const timelines = await store.queryItems('timelines', t => t.projectId === projectId);
    const snapshot = await stateSnapshot.getSnapshot(projectId, chapterNumber - 1);
    if (!snapshot) return issues;

    const content = chapterContent || '';
    const timeIndicators = ext.extractTimeIndicators(content);

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
                            dimension: CHECK_DIMENSIONS.TIMELINE, severity: SEVERITY.CRITICAL,
                            title: '时间线倒置',
                            description: `第${chapterNumber}章出现回忆第${flashbackChapter}章的内容，但第${flashbackChapter}章尚未发生`,
                            context: indicator.context, suggestion: '修正回忆引用的章节号，或调整时间线'
                        });
                    }
                }
                if (indicator.type === 'timeSkip' && indicator.duration) {
                    const prevTimeContext = lastEvent.timeContext || '';
                    if (prevTimeContext) {
                        issues.push({
                            dimension: CHECK_DIMENSIONS.TIMELINE, severity: SEVERITY.WARNING,
                            title: '时间跨度矛盾',
                            description: `时间跳跃"${indicator.duration}"可能与之前的时间上下文矛盾`,
                            context: indicator.context, suggestion: '确认时间流逝是否合理'
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
                dimension: CHECK_DIMENSIONS.TIMELINE, severity: SEVERITY.WARNING,
                title: '主线任务超时',
                description: `主线任务"${quest.name}"应在第${quest.requiredByChapter}章前完成，但当前进度仅${quest.progress}%`,
                questId: quest.id, questName: quest.name, requiredBy: quest.requiredByChapter,
                currentProgress: quest.progress, suggestion: '推进该任务或调整完成时限'
            });
        }
    }
    return issues;
}

module.exports = { checkPowerConsistency, checkTimelineConsistency };
