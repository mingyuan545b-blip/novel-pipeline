/**
 * supportingRoleDepthCheck.js - 配角反工具人化硬检测
 *
 * 职责边界：
 *   - 检测配角是否工具人化（连续N章无内心描写/无自主决策/无反预期行为）
 *   - 检测配角命运弧光是否停滞
 *   - 输出 high/medium 级问题，供firstReview注入
 *
 * 单一职责：只做检测和报告，不做修改
 * 数据源：entityCenter（通过characterArcGuard） + supportingRoleQuota配置
 *
 * 修复历史问题：characterArcGuard的工具人检测靠innerVoiceCount，
 *   但该字段从无人写入（改造二-2已修复写入链路）
 */

const entityCenter = require('../../../entityCenter');
const { characterArcGuard } = require('../../../characterArcGuard');
const logger = require('../../../../shared/logger');

// 配角深度检测阈值（fallback默认值，题材模块supportingRoleQuota可覆盖）
const DEPTH_THRESHOLDS = Object.freeze({
    TOOL_CHARACTER_ROUNDS: 3,        // 连续3章无内心描写视为工具人化
    ARC_STALL_ROUNDS: 10,            // 10章无弧光推进视为停滞
    SUBVERSIVE_WINDOW: 5,            // 5章窗口检测反预期行为
    MIN_SUBVERSIVE_IN_WINDOW: 1,     // 5章内至少1次反预期行为
    SIGNATURE_DETAIL_INTERVAL: 3,    // 每3章至少展现1次标志性细节
    MIRROR_CONTRAST_INTERVAL: 5      // 每5章至少1次与主角的对比/互补
});

/**
 * 检测配角工具人化问题
 * @param {string} projectId
 * @param {number} chapterNumber
 * @returns {Array<{severity, type, entityName, description}>}
 */
async function checkSupportingRoleDepth(projectId, chapterNumber) {
    const issues = [];

    try {
        const stats = await characterArcGuard.getCharacterActivityStats(projectId, chapterNumber);
        // 只检测主要配角和配角，不检测背景角色和主角
        const targets = stats.filter(s =>
            s.roleLevel === 'main' || s.roleLevel === 'supporting'
        );

        // 获取完整实体数据（含genreState）
        const entities = await entityCenter.getEntitiesForProject(projectId, { activeOnly: true });

        for (const char of targets) {
            // 跳过本章未出场的角色（gap>1表示非本章出场）
            if (char.gap > 1) continue;

            const full = entities.find(e => e.id === char.id);
            if (!full) continue;

            const genreState = full.genreState || full.baseState?.genreState || {};
            const innerVoiceCount = genreState.innerVoiceCount || 0;
            const lastDepthUpdate = genreState.lastDepthUpdateChapter || 0;

            // 1. 工具人化检测：连续N章无内心描写
            const chaptersSinceDepth = chapterNumber - lastDepthUpdate;
            if (chaptersSinceDepth >= DEPTH_THRESHOLDS.TOOL_CHARACTER_ROUNDS && innerVoiceCount === 0) {
                issues.push({
                    severity: 'high',
                    type: 'tool_character_no_inner_voice',
                    entityName: char.name,
                    description: `配角【${char.name}】连续${chaptersSinceDepth}章无内心描写，工具人化风险。需在近期章节补充其内心活动/自主决策/反预期行为。`
                });
            }

            // 2. 弧光停滞检测
            const lastArcChange = genreState.lastArcChangeChapter || 0;
            if (lastArcChange > 0 && chapterNumber - lastArcChange >= DEPTH_THRESHOLDS.ARC_STALL_ROUNDS) {
                issues.push({
                    severity: 'medium',
                    type: 'arc_stalled',
                    entityName: char.name,
                    description: `配角【${char.name}】已${chapterNumber - lastArcChange}章无命运弧光推进（当前阶段：${genreState.arcPhase || '未知'}），需安排情感/命运变化。`
                });
            }

            // 3. 反预期行为缺失检测（5章窗口）
            const subversiveCount = genreState.subversiveBehaviorCount || 0;
            if (chapterNumber >= DEPTH_THRESHOLDS.SUBVERSIVE_WINDOW && subversiveCount === 0) {
                issues.push({
                    severity: 'medium',
                    type: 'lack_subversive_behavior',
                    entityName: char.name,
                    description: `配角【${char.name}】从未展现反预期行为，人设单一。需安排1次与既有人设形成对比的行为（如冰山角色偶尔流露温情/怯懦角色关键时刻挺身）。`
                });
            }
        }
    } catch (err) {
        logger.warn('supportingRoleDepthCheck', `Check failed: ${err.message}`);
    }

    return issues;
}

/**
 * 生成注入review prompt的文本
 * @param {string} projectId
 * @param {number} chapterNumber
 * @returns {string}
 */
async function buildSupportingDepthHint(projectId, chapterNumber) {
    const issues = await checkSupportingRoleDepth(projectId, chapterNumber);
    if (issues.length === 0) return '';

    const lines = issues.map(i => {
        const icon = i.severity === 'high' ? '⚠️' : 'ℹ️';
        return `${icon} ${i.description}`;
    });

    return `【配角反工具人化检测】发现${issues.length}个问题：\n${lines.join('\n')}`;
}

module.exports = {
    checkSupportingRoleDepth,
    buildSupportingDepthHint,
    DEPTH_THRESHOLDS
};
