const store = require('../../store');
const stateSnapshot = require('../stateSnapshot');
const { SEVERITY, CHECK_DIMENSIONS } = require('./constants');
const ext = require('./extractors');
const { checkCharacterConsistency, checkRelationshipConsistency } = require('./checkCharRelation');
const { checkPowerConsistency, checkTimelineConsistency } = require('./checkPowerTimeline');

async function checkForeshadowingConsistency(projectId, chapterNumber, chapterContent) {
    const issues = [];
    const tracker = await stateSnapshot.getForeshadowingTracker(projectId);
    const content = chapterContent || '';

    for (const fs of tracker) {
        if (fs.status === 'planted' && fs.urgency > 80) {
            issues.push({
                dimension: CHECK_DIMENSIONS.FORESHADOWING, severity: SEVERITY.WARNING,
                title: '伏笔长期未回收',
                description: `伏笔"${fs.name}"在第${fs.plantedChapter}章埋下，已过${chapterNumber - fs.plantedChapter}章仍未回收`,
                foreshadowingId: fs.id, foreshadowingName: fs.name, plantedChapter: fs.plantedChapter,
                chaptersSincePlanted: chapterNumber - fs.plantedChapter, suggestion: '考虑在近期章节中回收此伏笔，或更新其状态'
            });
        }
        if (fs.status === 'harvesting' && content.includes(fs.name)) {
            issues.push({
                dimension: CHECK_DIMENSIONS.FORESHADOWING, severity: SEVERITY.INFO,
                title: '伏笔回收进行中',
                description: `伏笔"${fs.name}"可能在本章被回收`,
                foreshadowingId: fs.id, foreshadowingName: fs.name,
                suggestion: '确认伏笔是否完整回收，更新伏笔状态为"已回收"'
            });
        }
    }

    const newHints = ext.detectNewForeshadowing(content);
    if (newHints.length > 0) {
        issues.push({
            dimension: CHECK_DIMENSIONS.FORESHADOWING, severity: SEVERITY.INFO,
            title: '检测到新伏笔线索',
            description: `本章可能埋下了${newHints.length}个新伏笔线索`,
            detectedHints: newHints, suggestion: '确认是否需要将这些线索登记为正式伏笔'
        });
    }
    return issues;
}

async function checkWorldviewConsistency(projectId, chapterNumber, chapterContent) {
    const issues = [];
    const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
    const worldviews = materials.filter(m => m.type === 'worldview');
    const content = chapterContent || '';

    for (const wv of worldviews) {
        const wvContent = wv.currentContent || wv.initialContent || '';
        const rules = ext.extractPowerRules(wvContent);
        for (const rule of rules) {
            const violation = ext.detectPowerRuleViolation(content, rule);
            if (violation) {
                issues.push({
                    dimension: CHECK_DIMENSIONS.WORLDVIEW, severity: SEVERITY.CRITICAL,
                    title: '世界观规则违反',
                    description: `世界观"${wv.name}"的规则可能被违反: ${rule.substring(0, 50)}...`,
                    worldviewId: wv.id, worldviewName: wv.name, rule: rule.substring(0, 100),
                    context: violation, suggestion: '确认是否需要修改世界观设定或修正章节内容'
                });
            }
        }
    }
    return issues;
}

module.exports = {
    checkCharacterConsistency, checkRelationshipConsistency,
    checkPowerConsistency, checkTimelineConsistency,
    checkForeshadowingConsistency, checkWorldviewConsistency
};
