// CharacterArcGuard — 角色弧线守卫
// 检测角色弧线问题：工具人化、弧线停滞、角色消失、弧线矛盾
// 直接使用entityCenter获取数据，不依赖DataContext（避免循环依赖）

const entityCenter = require('./entityCenter');
const { consistencyChecker } = require('./knowledgeBase');
const logger = require('../shared/logger');

const ARC_CONFIG = {
    // 角色消失阈值：N章未出现视为消失
    DISAPPEAR_THRESHOLD_CHAPTERS: 8,
    // 弧线停滞阈值：N章状态未变化视为停滞
    STALL_THRESHOLD_CHAPTERS: 10,
    // 工具人化阈值：配角连续N章只有对话无内心描写
    TOOL_CHARACTER_THRESHOLD: 5,
    // 主角每N章至少出现一次内心独白
    PROTAGONIST_INNER_VOICE_INTERVAL: 3
};

class CharacterArcGuard {
    /**
     * 检查角色弧线一致性
     */
    async checkCharacterArcs(projectId, chapterNumber) {
        const issues = [];

        try {
            const entities = await entityCenter.getEntitiesForProject(projectId, { activeOnly: true });
            const characters = entities.filter(e => e.entityType === 'character');

            if (characters.length === 0) return issues;

            for (const char of characters) {
                // 检测角色消失
                const lastAppear = char.lastAppearChapter || char.baseState?.lastAppearChapter || 0;
                if (lastAppear > 0 && chapterNumber - lastAppear > ARC_CONFIG.DISAPPEAR_THRESHOLD_CHAPTERS) {
                    const roleLevel = char.roleLevel || char.baseState?.roleLevel || 'supporting';
                    const isProtagonist = roleLevel === 'protagonist';
                    if (isProtagonist || roleLevel === 'main') {
                        issues.push({
                            type: 'character_disappeared',
                            severity: isProtagonist ? 'critical' : 'warning',
                            entityId: char.id,
                            entityName: char.name,
                            chapterNumber,
                            description: `${isProtagonist ? '主角' : '主要角色'}${char.name}已${chapterNumber - lastAppear}章未出现（最后出现：第${lastAppear}章）`,
                            lastAppearChapter: lastAppear,
                            gap: chapterNumber - lastAppear
                        });
                    }
                }

                // 检测弧线停滞
                const arcState = char.genreState || char.baseState?.genreState || {};
                const arcPhase = arcState.arcPhase || arcState.emotionalState || '';
                const lastArcChange = arcState.lastArcChangeChapter || 0;
                if (lastArcChange > 0 && chapterNumber - lastArcChange > ARC_CONFIG.STALL_THRESHOLD_CHAPTERS) {
                    const roleLevel = char.roleLevel || char.baseState?.roleLevel || 'supporting';
                    if (roleLevel === 'protagonist' || roleLevel === 'main') {
                        issues.push({
                            type: 'arc_stalled',
                            severity: 'warning',
                            entityId: char.id,
                            entityName: char.name,
                            chapterNumber,
                            description: `${char.name}弧线停滞：已${chapterNumber - lastArcChange}章无变化（当前阶段：${arcPhase || '未知'}）`,
                            arcPhase,
                            lastArcChangeChapter: lastArcChange
                        });
                    }
                }

                // 检测工具人化（配角连续多章只有对话标签）
                const appearances = char.appearances || char.baseState?.appearances || 0;
                const innerVoiceCount = char.innerVoiceCount || char.baseState?.innerVoiceCount || 0;
                if (appearances > ARC_CONFIG.TOOL_CHARACTER_THRESHOLD && innerVoiceCount === 0) {
                    const roleLevel = char.roleLevel || char.baseState?.roleLevel || 'supporting';
                    if (roleLevel !== 'background') {
                        issues.push({
                            type: 'tool_character',
                            severity: 'warning',
                            entityId: char.id,
                            entityName: char.name,
                            chapterNumber,
                            description: `${char.name}疑似工具人化：出场${appearances}次但无内心描写`,
                            appearances,
                            innerVoiceCount
                        });
                    }
                }
            }

            // 记录到一致性检查表
            for (const issue of issues) {
                try {
                    await consistencyChecker.recordCheck(projectId, chapterNumber, 'character_arc', issue.description, {
                        severity: issue.severity,
                        entityId: issue.entityId
                    });
                } catch (_) { logger.warn('characterArcGuard', '[arc-guard]', _.message || _); }  // DEGRADE: 影响=consistencyChecker.recordCheck 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
            }
        } catch (err) {
            logger.warn('characterArcGuard', `Character arc check failed for ch${chapterNumber}: ${err.message}`);
        }

        return issues;
    }

    /**
     * 获取角色活跃度统计
     */
    async getCharacterActivityStats(projectId, chapterNumber) {
        const stats = [];

        try {
            const entities = await entityCenter.getEntitiesForProject(projectId, { activeOnly: true });
            const characters = entities.filter(e => e.entityType === 'character');

            for (const char of characters) {
                const lastAppear = char.lastAppearChapter || char.baseState?.lastAppearChapter || 0;
                const roleLevel = char.roleLevel || char.baseState?.roleLevel || 'supporting';
                const gap = lastAppear > 0 ? chapterNumber - lastAppear : chapterNumber;

                stats.push({
                    id: char.id,
                    name: char.name,
                    roleLevel,
                    lastAppearChapter: lastAppear,
                    gap,
                    isActive: gap <= ARC_CONFIG.DISAPPEAR_THRESHOLD_CHAPTERS,
                    arcPhase: (char.genreState || char.baseState?.genreState || {}).arcPhase || ''
                });
            }
        } catch (_) { logger.warn('characterArcGuard', '[arc-guard]', _.message || _); }  // DEGRADE: 影响=角色弧光守卫 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

        return stats.sort((a, b) => {
            const roleOrder = { protagonist: 0, main: 1, supporting: 2, background: 3 };
            // R5 修复 BUG: 原代码 (roleOrder[x] || 99) 在 protagonist=0 时被 || 99 覆盖为 99
            // 改用 nullish coalescing 或显式判断，确保 0 不被覆盖
            const aOrder = roleOrder[a.roleLevel] !== undefined ? roleOrder[a.roleLevel] : 99;
            const bOrder = roleOrder[b.roleLevel] !== undefined ? roleOrder[b.roleLevel] : 99;
            return aOrder - bOrder;
        });
    }

    /**
     * 生成角色弧线review提示
     */
    async generateCharacterArcCheckHint(projectId, chapterNumber) {
        const issues = await this.checkCharacterArcs(projectId, chapterNumber);
        if (issues.length === 0) return '';

        const lines = issues.map(i => {
            const icon = i.severity === 'critical' ? '🚨' : '⚠️';
            return `${icon} ${i.description}`;
        });

        return `【角色弧线检测】发现${issues.length}个问题：\n${lines.join('\n')}`;
    }

    /**
     * 生成角色活跃度注入文本（用于writer prompt）
     */
    async generateCharacterActivityHint(projectId, chapterNumber) {
        const stats = await this.getCharacterActivityStats(projectId, chapterNumber);
        const inactive = stats.filter(s => !s.isActive && s.roleLevel !== 'background');

        if (inactive.length === 0) return '';

        const lines = inactive.map(s =>
            `▸ ${s.name}（${s.roleLevel}，${s.gap}章未出现）`
        );

        return `【角色活跃度提醒】以下角色久未出场，考虑在近期章节中安排出场：\n${lines.join('\n')}`;
    }
}

const characterArcGuard = new CharacterArcGuard();

module.exports = {
    characterArcGuard,
    CharacterArcGuard,
    ARC_CONFIG
};
