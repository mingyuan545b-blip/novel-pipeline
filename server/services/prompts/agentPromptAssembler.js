'use strict';
// Agent提示词组装引擎：岗位模板 → 逐Slot解析 → 带标签组装 → 去重（Section带标签便于定位）
const { getDataContext } = require('../dataContext');
const { detectGenre, resolveGenreFromProject } = require('../genreConfig');
const { getStyleProfileForProject } = require('./styleInjector');
const { deduplicateSystemPrompt, getAgentTemplate } = require('./promptBuilder');
const { SLOT_DEFINITIONS } = require('./agentSlotRegistry');
const { getJobTemplate } = require('./agentJobTemplates');
const { resolveSlotContent } = require('./slotResolvers');
const { buildNarrativePromiseBlock } = require('./narrativePromise');
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

    const { resolvedSlots, missingSlots } = await _resolveJobSlots(agentType, jobTemplate, ctx);
    _assertRequiredSlots(agentType, missingSlots);

    const sections = await _buildSections(agentType, projectId, options.chapterNumber, resolvedSlots);

    let fullSystem = baseSystem;
    if (sections.length) fullSystem += '\n\n' + sections.join('\n\n');

    // 12-创作工艺：注入"本书叙事承诺"——让写手知道读者要什么，而非只拿到素材与约束
    const promiseBlock = buildNarrativePromiseBlock(ctx.project);
    if (promiseBlock) fullSystem = promiseBlock + '\n\n' + fullSystem;

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

/**
 * 逐Slot解析岗位模板：有内容则收录；知识类slot空时降级为占位提示（陷阱#25）；
 * 必填类别（genre/constraints/style）为空则记入missingSlots。
 */
async function _resolveJobSlots(agentType, jobTemplate, ctx) {
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
    return { resolvedSlots, missingSlots };
}

/**
 * 必填slot缺失时抛 PROMPT_INCOMPLETE，阻断流水线（约束缺失不可放行）。
 */
function _assertRequiredSlots(agentType, missingSlots) {
    if (missingSlots.length === 0) return;
    const missingDesc = missingSlots.map(s => `${s.slotId}(${s.label})`).join(', ');
    logger.error('agentPromptAssembler', '[PROMPT-INCOMPLETE] {agentType} prompt is missing {count} required slots: {missingDesc}. Pipeline cannot proceed with incomplete constraints.', { agentType, count: missingSlots.length, missingDesc });
    const err = new Error(`PROMPT_INCOMPLETE: ${agentType} missing ${missingSlots.length} required slots: ${missingDesc}. Constraints will NOT be enforced — pipeline must stop.`);
    err.code = 'PROMPT_INCOMPLETE';
    err.missingSlots = missingSlots;
    throw err;
}

/**
 * 组装带标签的Section列表，并注入T0元约束与约束执行反馈（陷阱#42）。
 */
async function _buildSections(agentType, projectId, chapterNumber, resolvedSlots) {
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
            const feedbackText = await getConstraintFeedbackForPrompt(projectId, chapterNumber || 1);
            if (feedbackText) sections.push(feedbackText);
        } catch (e) {
            logger.warn('agentPromptAssembler', '[FEEDBACK-INJECT-FAILED] {agentType} feedback injection failed: {error}', { agentType, error: e.message });
        }
    }
    return sections;
}

async function _fetchSharedData(projectId) {
    const _asmCtx = await getDataContext(projectId);
    const project = await _asmCtx.getProject();
    const styleProfile = await getStyleProfileForProject(projectId);
    // 陷阱（分支题材）：detectGenre(styleProfile) 会丢失分支上下文——分支的
    // styleProfileOverrides.key 不是题材 id（如 kanding 分支 key="kanding-rules-thriller"），
    // detectGenre 按 key/genreProfile 匹配可能返回基础题材或 null，导致 genre-foundation
    // 等"题材级"槽位解析为 null → writer 提示词不完整 → PROMPT_INCOMPLETE 硬停。
    // 修复：优先用 resolveGenreFromProject（含 subGenre + branchKey 分支解析），失败再回退 detectGenre。
    let genrePlugin = null;
    try {
        genrePlugin = resolveGenreFromProject(project);
    } catch (_) { /* fall through to detectGenre */ }
    if (!genrePlugin) genrePlugin = styleProfile ? detectGenre(styleProfile) : null;
    return { project, styleProfile, genrePlugin };
}

module.exports = {
    assembleAgentPrompt,
};
