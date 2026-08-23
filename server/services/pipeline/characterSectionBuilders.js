/**
 * characterSectionBuilders.js — 角色段构建函数集合
 * 从sectionBuilders.js拆分出来，避免单文件超200行
 * 包含所有角色相关的素材段构建函数
 *
 * 角色段格式差异（通过声明式配置characterFormat选择）：
 * - buildCharacterSection: reviser用，name+role+content截断200字
 * - buildCharacterBriefSection: finalEditor/polisher用，只有name+role
 * - buildCharacterReaderSection: reader用，name:content极简格式
 * - buildCharacterReviewSection: 审核员用，显示lifecycleState+审核依据措辞
 * - buildKnowledgeAccessSection: 审核员专属限知约束段
 */
'use strict';

/**
 * 构建角色段（简化版）- 供reviser使用
 * 格式：name(role): content截断200字 + 深度字段摘要，标题"角色设定（修改时必须遵守）"
 * 陷阱#79修复：reviser修改时必须知道深度字段，避免改没
 */
function buildCharacterSection(scheduledChars) {
    if (!scheduledChars || scheduledChars.length === 0) return '';
    const charLines = scheduledChars.map(cs => {
        const role = cs.roleLevel === 'protagonist' ? '主角' : (cs.roleLevel === 'supporting' ? '配角' : 'NPC');
        let line = `- "${cs.name}"(${role})`;
        if (cs.content) line += `: ${cs.content.substring(0, 200)}`;
        // 陷阱#79修复：注入深度字段摘要
        const sj = cs.stateJson || {};
        const depthParts = [];
        if (sj.innerConflict) depthParts.push(`内心冲突:${sj.innerConflict}`);
        if (sj.independentStance) depthParts.push(`独立立场:${sj.independentStance}`);
        if (sj.fateArc) depthParts.push(`命运弧光:${sj.fateArc}`);
        if (depthParts.length > 0) line += ` | ${depthParts.join('；')}`;
        return line;
    });
    return `\n\n【角色设定（修改时必须遵守）】\n${charLines.join('\n')}`;
}

/**
 * 构建角色简表段 - 供finalEditor/polisher使用
 * 格式：只有name和role，无content，标题"角色状态（{label}依据）"
 * @param {Array} scheduledChars - 调度器返回的角色素材
 * @param {string} label - 标题中的依据标签（如"定稿依据"、"润色时保持一致"）
 */
function buildCharacterBriefSection(scheduledChars, label) {
    if (!scheduledChars || scheduledChars.length === 0) return '';
    const charLines = scheduledChars.map(cs => {
        const role = cs.roleLevel === 'protagonist' ? '主角' : (cs.roleLevel === 'supporting' ? '配角' : 'NPC');
        return `- "${cs.name}"(${role})`;
    });
    return `\n\n【角色状态（${label}依据）】\n${charLines.join('\n')}`;
}

/**
 * 构建角色段（reader极简版）- 供reader使用
 * 格式：name: content，无role标签，无截断（reader需要完整content做跨章节对比）
 */
function buildCharacterReaderSection(scheduledChars) {
    if (!scheduledChars || scheduledChars.length === 0) return '';
    const charLines = scheduledChars.map(cs => `${cs.name}: ${cs.content || ''}`);
    return `\n\n【角色素材参考】\n${charLines.join('\n')}`;
}

/**
 * 构建角色段（审核员版）- 供first-review/second-review/fast-review使用
 * 格式：name(role) [lifecycleState] + 深度字段摘要，标题"实体中心·角色状态（审核依据）"
 * 与buildCharacterBriefSection的差异：显示lifecycleState（非active时）+ 深度字段 + 审核依据措辞
 * 陷阱#79修复：审核员必须拿到深度字段才能判断工具人化
 * 迁移自reviewShared.js的loadReviewEntityData
 */
// 陷阱#79修复：审核员需要看到的深度字段标签映射
const REVIEW_DEPTH_LABELS = {
    innerConflict: '内心冲突', independentStance: '独立立场', fateArc: '命运弧光',
    protagonistMirror: '主角镜像', signatureDetail: '标志细节', catchphrases: '口头禅'
};

function buildCharacterReviewSection(scheduledChars) {
    if (!scheduledChars || scheduledChars.length === 0) return '';
    const stateLines = scheduledChars.map(cs => {
        const name = cs.name;
        const role = cs.roleLevel === 'protagonist' ? '主角' : (cs.roleLevel === 'supporting' ? '配角' : 'NPC');
        let line = `- "${name}"(${role})`;
        if (cs.lifecycleState && cs.lifecycleState !== 'active') line += ` [${cs.lifecycleState}]`;
        // 陷阱#79修复：注入深度字段摘要，让审核员能判断工具人化
        const sj = cs.stateJson || {};
        const depthParts = [];
        for (const [key, label] of Object.entries(REVIEW_DEPTH_LABELS)) {
            const v = sj[key];
            if (v !== null && v !== undefined && v !== '') {
                depthParts.push(`${label}:${Array.isArray(v) ? v.join('、') : v}`);
            }
        }
        if (depthParts.length > 0) line += ` | ${depthParts.join('；')}`;
        return line;
    });
    return `\n\n【实体中心·角色状态（审核依据——角色名/状态/设定以此为准）】\n${stateLines.join('\n')}\n以上角色名和状态是项目锁定的核心设定，审核时必须以此为基准判断正文是否一致。\n⚠️审核工具人化：如果正文角色没有体现上述深度字段（内心冲突/独立立场/命运弧光等），判为工具人化违规。`;
}

/**
 * 构建限知约束段 - 供审核员使用
 * 检查角色是否泄露不该知道的信息
 * 迁移自reviewShared.js的loadReviewEntityData
 * @param {Array} accessItems - 调度器返回的knowledge-access素材
 */
function buildKnowledgeAccessSection(accessItems) {
    if (!accessItems || accessItems.length === 0) return '';
    const accessContent = accessItems.map(i => i.content).filter(Boolean).join('\n');
    if (!accessContent) return '';
    return `\n\n【限知约束（审核依据——检查角色是否泄露不该知道的信息）】\n${accessContent}\n审核时必须检查：1.角色对话/行为是否使用了该角色不知道的信息 2.误信信息的角色是否按错误认知行动\n注意：视角切换本身不是违规，只要每章锁定一个视角角色，且该视角角色没有使用自己不知道的信息。视角规则以【风格配置】中的povRule为准，不得自行提高标准。`;
}

// ============ 角色相关辅助素材段 ============

function buildCharacterCombatSection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【角色战斗能力】\n';
    for (const c of items) {
        section += `▸ ${c.name}: ${c.content || ''}\n`;
    }
    return section;
}

function buildGrowthHistorySection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【角色成长史】\n';
    for (const g of items) {
        section += `▸ ${g.name}: ${g.content || ''}\n`;
    }
    return section;
}

function buildRelationshipSection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【角色关系】\n';
    for (const r of items) {
        section += `▸ ${r.name}: ${r.content || ''}\n`;
    }
    return section;
}

module.exports = {
    buildCharacterSection,
    buildCharacterBriefSection,
    buildCharacterReaderSection,
    buildCharacterReviewSection,
    buildKnowledgeAccessSection,
    buildCharacterCombatSection,
    buildGrowthHistorySection,
    buildRelationshipSection,
};
