const logger = require('../../shared/logger');
const store = require('../../store');
const stateSnapshot = require('../stateSnapshot');
const llm = require('../llm');
const { SEVERITY, CHECK_DIMENSIONS } = require('./constants');
const { formatStateSummary } = require('./extractors');
const {
    checkCharacterConsistency, checkRelationshipConsistency,
    checkPowerConsistency, checkTimelineConsistency,
    checkForeshadowingConsistency, checkWorldviewConsistency
} = require('./checkMethods');

class ConsistencyEngine {
    async fullCheck(projectId, chapterNumber, chapterContent, chapterOutline) {
        const results = [];
        const [charResults, relResults, powerResults, timelineResults, foreshadowResults, worldResults] = await Promise.all([
            checkCharacterConsistency(projectId, chapterNumber, chapterContent),
            checkRelationshipConsistency(projectId, chapterNumber, chapterContent),
            checkPowerConsistency(projectId, chapterNumber, chapterContent),
            checkTimelineConsistency(projectId, chapterNumber, chapterContent),
            checkForeshadowingConsistency(projectId, chapterNumber, chapterContent),
            checkWorldviewConsistency(projectId, chapterNumber, chapterContent)
        ]);

        results.push(...charResults, ...relResults, ...powerResults, ...timelineResults, ...foreshadowResults, ...worldResults);

        const summary = {
            projectId, chapterNumber,
            timestamp: new Date().toISOString(),
            totalIssues: results.length,
            criticalCount: results.filter(r => r.severity === SEVERITY.CRITICAL).length,
            warningCount: results.filter(r => r.severity === SEVERITY.WARNING).length,
            infoCount: results.filter(r => r.severity === SEVERITY.INFO).length,
            dimensions: {
                character: charResults.length, relationship: relResults.length,
                power: powerResults.length, timeline: timelineResults.length,
                foreshadowing: foreshadowResults.length, worldview: worldResults.length
            },
            issues: results,
            passed: results.filter(r => r.severity === SEVERITY.CRITICAL).length === 0
        };

        await store.setItem('consistency-reports', `${projectId}_ch${chapterNumber}_${Date.now()}`, summary);
        return summary;
    }

    async quickCheck(projectId, chapterNumber, chapterContent) {
        const results = [];
        const charResults = await checkCharacterConsistency(projectId, chapterNumber, chapterContent);
        const powerResults = await checkPowerConsistency(projectId, chapterNumber, chapterContent);
        results.push(...charResults, ...powerResults);
        return {
            passed: results.filter(r => r.severity === SEVERITY.CRITICAL).length === 0,
            issues: results,
            criticalCount: results.filter(r => r.severity === SEVERITY.CRITICAL).length
        };
    }

    async checkCharacterConsistency(projectId, chapterNumber, chapterContent) {
        return checkCharacterConsistency(projectId, chapterNumber, chapterContent);
    }

    async checkRelationshipConsistency(projectId, chapterNumber, chapterContent) {
        return checkRelationshipConsistency(projectId, chapterNumber, chapterContent);
    }

    async checkPowerConsistency(projectId, chapterNumber, chapterContent) {
        return checkPowerConsistency(projectId, chapterNumber, chapterContent);
    }

    async checkTimelineConsistency(projectId, chapterNumber, chapterContent) {
        return checkTimelineConsistency(projectId, chapterNumber, chapterContent);
    }

    async checkForeshadowingConsistency(projectId, chapterNumber, chapterContent) {
        return checkForeshadowingConsistency(projectId, chapterNumber, chapterContent);
    }

    async checkWorldviewConsistency(projectId, chapterNumber, chapterContent) {
        return checkWorldviewConsistency(projectId, chapterNumber, chapterContent);
    }

    async aiAssistedCheck(projectId, chapterNumber, chapterContent, apiConfig) {
        const snapshot = await stateSnapshot.getSnapshot(projectId, chapterNumber - 1);
        if (!snapshot) return { issues: [], passed: true };

        const materials = await store.queryItems('materials', m => m.projectId === projectId && !m.archived);
        const materialSummary = materials.slice(0, 20).map(m =>
            `[${m.type}] ${m.name}: ${(m.currentContent || m.initialContent || '').substring(0, 100)}`
        ).join('\n');

        const stateSummaryStr = formatStateSummary(snapshot);

        const prompt = `你是一位严谨的小说一致性审核专家。请检查以下章节内容是否与已建立的设定和状态一致。

【素材库摘要】
${materialSummary}

【上一章世界状态】
${stateSummaryStr}

【本章内容】
${(chapterContent || '').substring(0, 3000)}

请检查以下维度并输出JSON：
1. character: 角色行为是否与设定一致
2. relationship: 角色互动是否与关系状态一致
3. power: 战力变化是否合理
4. timeline: 时间线是否连贯
5. worldview: 是否违反世界观规则

输出格式：
{"issues":[{"dimension":"character|relationship|power|timeline|worldview","severity":"critical|warning|info","description":"问题描述","suggestion":"修改建议"}],"passed":true/false}`;

        try {
            const response = await llm.chat([{ role: 'user', content: prompt }], { maxTokens: 2000, ...(apiConfig || {}) });
            const responseText = response?.choices?.[0]?.message?.content || '';
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            logger.warn('index', '[CONSISTENCY] AI-assisted check failed:', e.message);
        }
        return { issues: [], passed: true };
    }

    async getReportHistory(projectId) {
        const reports = await store.queryItems('consistency-reports', r => r.projectId === projectId);
        return reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
}

module.exports = new ConsistencyEngine();
