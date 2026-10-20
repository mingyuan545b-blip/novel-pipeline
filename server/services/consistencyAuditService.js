// ConsistencyAuditService — 长线一致性检查点
// 定期触发全局审计：战力/伏笔/角色弧线/时间线
// 直接使用各guard/service获取数据，不依赖DataContext（避免循环依赖）

const { powerGuard } = require('./powerGuard');
const { foreshadowGuard } = require('./foreshadowGuard');
const { characterArcGuard } = require('./characterArcGuard');
const { timelineService } = require('./timelineService');
const { consistencyChecker } = require('./knowledgeBase');
const logger = require('../shared/logger');

const AUDIT_CONFIG = {
    // 每N章触发一次自动审计
    CHECKPOINT_INTERVAL: 10,
    // 审计涵盖的维度
    DIMENSIONS: ['power', 'foreshadow', 'character_arc', 'timeline'],
    // 审计报告最大token
    MAX_REPORT_TOKENS: 2000
};

class ConsistencyAuditService {
    /**
     * 执行全局一致性审计
     * @param {string} projectId
     * @param {number} currentChapter - 当前章节号
     * @returns {Promise<object>} 审计报告
     */
    async runFullAudit(projectId, currentChapter) {
        const startTime = Date.now();
        const report = {
            projectId,
            chapterNumber: currentChapter,
            timestamp: new Date().toISOString(),
            dimensions: {},
            summary: {
                totalIssues: 0,
                criticalCount: 0,
                warningCount: 0,
                passed: true
            }
        };

        // 战力一致性审计
        try {
            const powerIssues = await powerGuard.checkPowerConsistency(projectId, currentChapter);
            report.dimensions.power = {
                status: powerIssues.length === 0 ? 'pass' : 'fail',
                issues: powerIssues,
                issueCount: powerIssues.length
            };
        } catch (err) {
            report.dimensions.power = { status: 'error', error: err.message, issues: [], issueCount: 0 };
        }

        // 伏笔一致性审计
        try {
            const foreshadowIssues = await foreshadowGuard.checkForeshadowConsistency(projectId, currentChapter);
            const foreshadowStats = await foreshadowGuard.getResolveStats(projectId);
            report.dimensions.foreshadow = {
                status: foreshadowIssues.length === 0 ? 'pass' : 'fail',
                issues: foreshadowIssues,
                issueCount: foreshadowIssues.length,
                stats: foreshadowStats
            };
        } catch (err) {
            report.dimensions.foreshadow = { status: 'error', error: err.message, issues: [], issueCount: 0 };
        }

        // 角色弧线审计
        try {
            const arcIssues = await characterArcGuard.checkCharacterArcs(projectId, currentChapter);
            const activityStats = await characterArcGuard.getCharacterActivityStats(projectId, currentChapter);
            report.dimensions.character_arc = {
                status: arcIssues.length === 0 ? 'pass' : 'fail',
                issues: arcIssues,
                issueCount: arcIssues.length,
                activityStats
            };
        } catch (err) {
            report.dimensions.character_arc = { status: 'error', error: err.message, issues: [], issueCount: 0 };
        }

        // 时间线审计
        try {
            const timelineConflicts = await timelineService.detectTimeConflicts(projectId, currentChapter);
            const timelineStats = await timelineService.getStats(projectId);
            report.dimensions.timeline = {
                status: timelineConflicts.length === 0 ? 'pass' : 'fail',
                issues: timelineConflicts,
                issueCount: timelineConflicts.length,
                stats: timelineStats
            };
        } catch (err) {
            report.dimensions.timeline = { status: 'error', error: err.message, issues: [], issueCount: 0 };
        }

        // 汇总
        for (const dim of Object.values(report.dimensions)) {
            report.summary.totalIssues += dim.issueCount || 0;
            const criticals = (dim.issues || []).filter(i => i.severity === 'critical');
            const warnings = (dim.issues || []).filter(i => i.severity === 'warning');
            report.summary.criticalCount += criticals.length;
            report.summary.warningCount += warnings.length;
        }
        report.summary.passed = report.summary.criticalCount === 0;
        report.summary.durationMs = Date.now() - startTime;

        // 记录审计结果
        try {
            await consistencyChecker.recordCheck(projectId, currentChapter, 'full_audit',
                `全局审计：${report.summary.totalIssues}个问题（${report.summary.criticalCount}严重，${report.summary.warningCount}警告）`,
                report.summary
            );
        } catch (_) { logger.warn('consistencyAuditServ', '[consistency-audit]', _.message || _); }  // DEGRADE: 影响=consistencyChecker.recordCheck 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

        logger.info('consistencyAudit', `Audit completed for ch${currentChapter}: ${report.summary.totalIssues} issues (${report.summary.durationMs}ms)`);
        return report;
    }

    /**
     * 检查是否到达审计检查点
     */
    shouldRunAudit(chapterNumber) {
        return chapterNumber > 0 && chapterNumber % AUDIT_CONFIG.CHECKPOINT_INTERVAL === 0;
    }

    /**
     * 生成审计报告文本（用于注入review或展示）
     */
    formatAuditReport(report) {
        if (!report) return '';

        const lines = [];
        lines.push(`═══ 长线一致性审计报告 ═══`);
        lines.push(`章节：第${report.chapterNumber}章 | 时间：${report.timestamp}`);
        lines.push(`结果：${report.summary.passed ? '✅ 通过' : '❌ 未通过'} | 问题：${report.summary.totalIssues}个（严重${report.summary.criticalCount}，警告${report.summary.warningCount}）`);

        for (const [dimName, dim] of Object.entries(report.dimensions)) {
            if (dim.status === 'pass') {
                lines.push(`  ${dimName}: ✅ 无问题`);
            } else if (dim.status === 'fail') {
                lines.push(`  ${dimName}: ❌ ${dim.issueCount}个问题`);
                for (const issue of (dim.issues || []).slice(0, 3)) {
                    const icon = issue.severity === 'critical' ? '🚨' : '⚠️';
                    lines.push(`    ${icon} ${issue.description}`);
                }
            } else {
                lines.push(`  ${dimName}: ⚡ 检查失败 - ${dim.error}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * 获取历史审计记录
     */
    async getAuditHistory(projectId, limit = 10) {
        try {
            const store = require('../store');
            const checks = await store.queryItems('consistency-checks', { projectId });
            return checks
                .filter(c => c.checkType === 'full_audit')
                .sort((a, b) => (b.chapterNumber || 0) - (a.chapterNumber || 0))
                .slice(0, limit);
        } catch (_) {
            return [];
        }
    }
}

const consistencyAuditService = new ConsistencyAuditService();

module.exports = {
    consistencyAuditService,
    ConsistencyAuditService,
    AUDIT_CONFIG
};
