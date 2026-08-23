'use strict';

/**
 * Agent提示词组装引擎
 * 核心流程：岗位模板 → 逐Slot解析 → 带标签组装 → 去重
 * 每个Section带【标签】，出问题可直接定位到哪个Slot
 */

const { getDataContext } = require('../dataContext');
const { detectGenre } = require('../genreConfig');
const { getStyleProfileForProject } = require('./styleInjector');
const { deduplicateSystemPrompt, getAgentTemplate } = require('./promptBuilder');
const { SLOT_DEFINITIONS } = require('./agentSlotRegistry');
const { getJobTemplate } = require('./agentJobTemplates');
const { resolveSlotContent } = require('./slotResolvers');
const logger = require('../../shared/logger');

async function assembleAgentPrompt(agentType, mode, projectId, options = {}) {
    const jobTemplate = getJobTemplate(agentType);
    if (!jobTemplate) throw new Error(`No job template for agent type: ${agentType}`);

    const template = await getAgentTemplate(agentType, mode);
    if (!template) throw new Error(`No template for agent type: ${agentType}`);

    let baseSystem = template.system;
    const ctx = {
        agentType,
        mode,
        projectId,
        roleLabel: jobTemplate.label,
        taskDesc: jobTemplate.task,
        chapterNumber: options.chapterNumber,
        project: null,
        styleProfile: null,
        genrePlugin: null,
    };

    if (projectId) {
        const fetched = await _fetchSharedData(projectId);
        ctx.project = fetched.project;
        ctx.styleProfile = fetched.styleProfile;
        ctx.genrePlugin = fetched.genrePlugin;

        if (ctx.project?.agentOverrides?.[agentType]) {
            baseSystem = ctx.project.agentOverrides[agentType];
        }
    }

    // 陷阱#25: memory-pyramid 不能列为必填——新项目必然没有 knowledge_facts 数据
    // 否则新项目永远无法生成第一章（PROMPT_INCOMPLETE 阻断）
    // 改为：memory-pyramid 空时降级为提示"暂无历史记忆"，不阻断 pipeline
    const REQUIRED_SLOT_CATEGORIES = new Set(['genre', 'constraints', 'style']);
    const resolvedSlots = [];
    const missingSlots = [];
    for (const slotId of jobTemplate.slots) {
        const slotDef = SLOT_DEFINITIONS[slotId];
        if (!slotDef) {
            logger.warn('agentPromptAssembler', '[MISSING-SLOT-DEF] Slot {slotId} has no definition in SLOT_DEFINITIONS', { slotId });
            continue;
        }
        const content = await resolveSlotContent(slotDef, ctx);
        if (content) {
            resolvedSlots.push({ slotId, label: slotDef.label, content, hasOwnHeader: slotDef.hasOwnHeader });
        } else if (slotDef.category === 'knowledge') {
            // 知识类slot空时降级提示，不阻断（新项目/前几章无历史记忆是正常状态）
            resolvedSlots.push({
                slotId, label: slotDef.label,
                content: `（暂无历史记忆——这是新项目或前几章，无需强制约束历史一致性）`,
                hasOwnHeader: slotDef.hasOwnHeader
            });
            logger.info('agentPromptAssembler', '[KNOWLEDGE-SLOT-EMPTY] {agentType} knowledge slot {slotId} returned null — using placeholder (non-blocking)', { agentType, slotId });
        } else if (REQUIRED_SLOT_CATEGORIES.has(slotDef.category)) {
            missingSlots.push({ slotId, label: slotDef.label, category: slotDef.category });
            logger.error('agentPromptAssembler', '[REQUIRED-SLOT-NULL] {agentType} required slot {slotId}({label}) returned null — content will be missing from prompt', { agentType, slotId, label: slotDef.label });
        }
    }

    if (missingSlots.length > 0) {
        const missingDesc = missingSlots.map(s => `${s.slotId}(${s.label})`).join(', ');
        logger.error('agentPromptAssembler', '[PROMPT-INCOMPLETE] {agentType} prompt is missing {count} required slots: {missingDesc}. Pipeline cannot proceed with incomplete constraints.', { agentType, count: missingSlots.length, missingDesc });
        const err = new Error(`PROMPT_INCOMPLETE: ${agentType} missing ${missingSlots.length} required slots: ${missingDesc}. Constraints will NOT be enforced — pipeline must stop.`);
        err.code = 'PROMPT_INCOMPLETE';
        err.missingSlots = missingSlots;
        throw err;
    }

    const sections = resolvedSlots.map(s => {
        if (s.hasOwnHeader) return s.content;
        return `【${s.label}】\n${s.content}`;
    });

    // 陷阱#42: 注入T0元约束（少而精，覆盖大范围问题）
    // 详见 SOP: docs/sop/08-约束执行规范.md 第二节
    if (['writer', 'reviser', 'polisher', 'final-editor'].includes(agentType)) {
        const { getMetaConstraintsForPrompt } = require('./constraintMetaSpec');
        const metaText = getMetaConstraintsForPrompt();
        if (metaText) {
            sections.push(`【T0·元约束】\n${metaText}`);
        }
    }

    // 陷阱#42: 注入约束执行反馈（形成闭环，动态调整权重）
    if (projectId && ['writer', 'reviser'].includes(agentType)) {
        try {
            const { getConstraintFeedbackForPrompt } = require('./constraintFeedbackCollector');
            const feedbackText = await getConstraintFeedbackForPrompt(projectId, options.chapterNumber || 1);
            if (feedbackText) sections.push(feedbackText);
        } catch (e) {
            logger.warn('agentPromptAssembler', '[FEEDBACK-INJECT-FAILED] {agentType} feedback injection failed: {error}', { agentType, error: e.message });
        }
    }

    let fullSystem = baseSystem;
    if (sections.length) fullSystem += '\n\n' + sections.join('\n\n');

    if (ctx.styleProfile) {
        fullSystem = deduplicateSystemPrompt(fullSystem, agentType, ctx.styleProfile);
    }

    const buildLog = resolvedSlots.map(s => ({
        slot: s.slotId, label: s.label, chars: s.content.length,
        preview: s.content.substring(0, 80).replace(/\n/g, ' '),
    }));

    // 记录每个agent实际加载的约束内容，可追溯
    const constraintTrace = {
        agentType,
        projectId,
        genreId: ctx.genrePlugin?.id || null,
        genreLabel: ctx.genrePlugin?.label || null,
        hasBehaviorTemplate: !!(ctx.genrePlugin?.characterProfile?.behaviorTemplate),
        loadedSlots: resolvedSlots.map(s => s.slotId),
        missingRequiredSlots: missingSlots.map(s => s.slotId),
        totalChars: fullSystem.length,
        timestamp: new Date().toISOString(),
    };

    logger.info('agentPromptAssembler', '[ASSEMBLE] {agentType}: {slotCount} slots, {totalChars} chars, genre={genreLabel}, behaviorTemplate={hasBehaviorTemplate}', {
        agentType, slotCount: resolvedSlots.length, totalChars: fullSystem.length,
        genreLabel: constraintTrace.genreLabel, hasBehaviorTemplate: constraintTrace.hasBehaviorTemplate,
    });

    // 约束加载失败时详细记录，便于排查"执笔审核有没有加载到正确约束"
    if (missingSlots.length > 0) {
        logger.error('agentPromptAssembler', '[CONSTRAINT-TRACE] {agentType} MISSING constraints: {missingSlots}. This means writer/reviewer will NOT enforce these rules.', {
            agentType, missingSlots: missingSlots.map(s => `${s.slotId}(${s.label})`).join(', '),
        });
    }

    return {
        system: fullSystem,
        role: template.role,
        tool: template.tool,
        buildLog,
        constraintTrace,
    };
}

async function _fetchSharedData(projectId) {
    const _asmCtx = await getDataContext(projectId);
    const project = await _asmCtx.getProject();
    const styleProfile = await getStyleProfileForProject(projectId);
    const genrePlugin = styleProfile ? detectGenre(styleProfile) : null;
    return { project, styleProfile, genrePlugin };
}

module.exports = {
    assembleAgentPrompt,
};
