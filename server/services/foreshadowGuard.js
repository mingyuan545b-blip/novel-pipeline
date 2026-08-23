// ForeshadowGuard — 伏笔回收守卫
// 增强ForeshadowLedger：超期检测、writer注入、review检查、回收率统计
// 直接使用knowledgeBase获取数据，不依赖DataContext（避免循环依赖）

const { foreshadowLedger } = require('./knowledgeBase');
const { consistencyChecker } = require('./knowledgeBase');
const logger = require('../shared/logger');

const FORESHADOW_CONFIG = {
    // 超期阈值：埋设超过N章未推进视为超期
    OVERDUE_ADVANCE_CHAPTERS: 10,
    // 超期阈值：埋设超过N章未回收视为严重超期
    OVERDUE_RESOLVE_CHAPTERS: 30,
    // 重要伏笔超期阈值更严格
    IMPORTANT_OVERDUE_CHAPTERS: 5,
    // 回收率目标
    TARGET_RESOLVE_RATE: 0.7
};

class ForeshadowGuard {
    /**
     * 获取超期伏笔列表
     */
    async getOverdueForeshadows(projectId, currentChapter) {
        const active = await foreshadowLedger.getActive(projectId);
        const overdue = [];

        for (const fs of active) {
            const age = currentChapter - (fs.plantChapter || 0);
            const lastAdvance = currentChapter - (fs.lastAdvanceChapter || fs.plantChapter || 0);
            const isImportant = fs.importance === 'critical' || fs.importance === 'major';
            const advanceThreshold = isImportant
                ? FORESHADOW_CONFIG.IMPORTANT_OVERDUE_CHAPTERS
                : FORESHADOW_CONFIG.OVERDUE_ADVANCE_CHAPTERS;

            if (lastAdvance > advanceThreshold) {
                overdue.push({
                    ...fs,
                    overdueType: 'no_advance',
                    chaptersSinceAdvance: lastAdvance,
                    chaptersSincePlant: age,
                    severity: lastAdvance > FORESHADOW_CONFIG.OVERDUE_RESOLVE_CHAPTERS ? 'critical' : 'warning',
                    suggestion: lastAdvance > FORESHADOW_CONFIG.OVERDUE_RESOLVE_CHAPTERS
                        ? `伏笔"${fs.name}"已${age}章未回收，建议尽快推进或回收`
                        : `伏笔"${fs.name}"已${lastAdvance}章未推进，建议在近期章节中提及`
                });
            }
        }

        return overdue;
    }

    /**
     * 获取伏笔回收率统计
     */
    async getResolveStats(projectId) {
        const stats = await foreshadowLedger.getStats(projectId);
        const total = stats.total || 0;
        const resolved = stats.resolved || 0;
        const abandoned = stats.abandoned || 0;
        const active = stats.planted + stats.advanced;

        const resolveRate = total > 0 ? resolved / total : 0;
        const abandonRate = total > 0 ? abandoned / total : 0;

        return {
            total,
            planted: stats.planted || 0,
            advanced: stats.advanced || 0,
            resolved,
            abandoned,
            active,
            resolveRate,
            abandonRate,
            meetsTarget: resolveRate >= FORESHADOW_CONFIG.TARGET_RESOLVE_RATE
        };
    }

    /**
     * 生成活跃伏笔注入文本（用于writer prompt）
     */
    async generateForeshadowHint(projectId, currentChapter) {
        const active = await foreshadowLedger.getActive(projectId);
        const overdue = await this.getOverdueForeshadows(projectId, currentChapter);

        if (active.length === 0 && overdue.length === 0) return '';

        const lines = [];
        const mainline = active.filter(f => f.storyline === 'main');
        const subline = active.filter(f => f.storyline !== 'main');

        if (mainline.length > 0) {
            lines.push(`【主线伏笔 - 共${mainline.length}个（必须推进）】`);
            for (const fs of mainline.slice(0, 5)) {
                const age = currentChapter - (fs.plantChapter || 0);
                lines.push(`▸ "${fs.name}"（第${fs.plantChapter}章埋设，已${age}章，${fs.status === 'advanced' ? '已推进' : '待推进'}）`);
            }
        }

        if (subline.length > 0) {
            lines.push(`【支线伏笔 - 共${subline.length}个】`);
            for (const fs of subline.slice(0, 5)) {
                const age = currentChapter - (fs.plantChapter || 0);
                lines.push(`▸ "${fs.name}"（第${fs.plantChapter}章埋设，已${age}章，${fs.status === 'advanced' ? '已推进' : '待推进'}）`);
            }
        }

        if (overdue.length > 0) {
            const mainOverdue = overdue.filter(f => f.storyline === 'main');
            const subOverdue = overdue.filter(f => f.storyline !== 'main');
            if (mainOverdue.length > 0) {
                lines.push(`\n【🚨 主线伏笔超期 - 必须处理！】`);
                for (const fs of mainOverdue.slice(0, 3)) {
                    lines.push(`🚨 "${fs.name}" - ${fs.suggestion}`);
                }
            }
            if (subOverdue.length > 0) {
                lines.push(`\n【⚠️ 支线伏笔超期 - 建议推进】`);
                for (const fs of subOverdue.slice(0, 3)) {
                    lines.push(`⚠️ "${fs.name}" - ${fs.suggestion}`);
                }
            }
        }

        return lines.join('\n');
    }

    /**
     * 检查伏笔一致性（用于review）
     */
    async checkForeshadowConsistency(projectId, chapterNumber) {
        const issues = [];
        const overdue = await this.getOverdueForeshadows(projectId, chapterNumber);

        for (const fs of overdue) {
            issues.push({
                type: 'foreshadow_overdue',
                severity: fs.severity,
                entityId: fs.id,
                description: fs.suggestion,
                foreshadowName: fs.name,
                chaptersSinceAdvance: fs.chaptersSinceAdvance
            });

            try {
                await consistencyChecker.recordCheck(projectId, chapterNumber, 'foreshadow', fs.suggestion, {
                    severity: fs.severity,
                    entityId: fs.id
                });
            } catch (_) { logger.warn('foreshadowGuard', '[foreshadow-guard]', _.message || _); }
        }

        return issues;
    }

    /**
     * 生成伏笔review提示文本
     */
    async generateForeshadowCheckHint(projectId, chapterNumber) {
        const issues = await this.checkForeshadowConsistency(projectId, chapterNumber);
        if (issues.length === 0) return '';

        const lines = issues.map(i => {
            const icon = i.severity === 'critical' ? '🚨' : '⚠️';
            return `${icon} ${i.description}`;
        });

        return `【伏笔一致性检测】发现${issues.length}个问题：\n${lines.join('\n')}`;
    }
}

const foreshadowGuard = new ForeshadowGuard();

module.exports = {
    foreshadowGuard,
    ForeshadowGuard,
    FORESHADOW_CONFIG
};
