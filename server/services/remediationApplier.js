const logger = require('../shared/logger');
const store = require('../store');
const { BASE_CONSTRAINT_PRESETS } = require('./prompts/constraintInjector');
const { getDataContext } = require('./dataContext');
const { isRuleRedundant, consolidateRules } = require('./remediationRules');

async function applyRemediation(projectId, remediation, mode) {
    const _arCtx = await getDataContext(projectId);
    const project = await _arCtx.getProject();
    if (!project) throw new Error('Project not found');

    switch (remediation.target) {
        case 'constraint': {
            const constraintId = remediation.content;
            if (!BASE_CONSTRAINT_PRESETS[constraintId]) throw new Error(`Unknown constraint: ${constraintId}`);
            if (!project.constraints) project.constraints = [];
            if (!project.constraints.includes(constraintId)) {
                project.constraints.push(constraintId);
                await store.setItem('projects', projectId, project);
            }
            return `添加约束: ${BASE_CONSTRAINT_PRESETS[constraintId].label}`;
        }

        case 'material': {
            let matData;
            try {
                matData = typeof remediation.content === 'string' ? JSON.parse(remediation.content) : remediation.content;
            } catch (_) {
                matData = { type: 'other', name: remediation.action, content: String(remediation.content) };
            }
            const { v4: uuidv4 } = require('uuid');
            const matId = uuidv4();
            await store.setItem('materials', matId, {
                id: matId,
                projectId,
                type: matData.type || 'other',
                name: matData.name || remediation.action,
                content: matData.content || '',
                archived: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return `添加素材: ${matData.name} (${matData.type})`;
        }

        case 'style-guidance': {
            const existingGuidance = project.styleGuidance || '';
            const newGuidance = existingGuidance
                ? `${existingGuidance}\n\n【追加整改指导】\n${remediation.content}`
                : `【整改指导】\n${remediation.content}`;
            project.styleGuidance = newGuidance;
            project.styleGuidanceUpdatedAt = new Date().toISOString();
            await store.setItem('projects', projectId, project);
            return '更新风格指导';
        }

        case 'writer-prompt': {
            const promptKey = 'writerPromptAdditions';
            if (!project[promptKey]) project[promptKey] = [];
            const MAX_RULES = 8;
            if (project[promptKey].length >= MAX_RULES) {
                logger.warn('remediationApplier', `[REMEDIATION] writer rules already at max (${MAX_RULES}), consolidating instead of adding`);
                project[promptKey] = consolidateRules(project[promptKey], remediation.content, MAX_RULES);
            } else if (!isRuleRedundant(project[promptKey], remediation.content)) {
                project[promptKey].push({
                    rule: remediation.content,
                    source: 'review-remediation',
                    addedAt: new Date().toISOString()
                });
            } else {
                logger.info('remediationApplier', '[REMEDIATION] writer rule skipped as redundant');
            }
            await store.setItem('projects', projectId, project);
            return `处理Writer规则: ${remediation.content.substring(0, 50)}...`;
        }

        case 'review-prompt': {
            const promptKey = 'reviewPromptAdditions';
            if (!project[promptKey]) project[promptKey] = [];
            const MAX_RULES = 6;
            if (project[promptKey].length >= MAX_RULES) {
                logger.warn('remediationApplier', `[REMEDIATION] review rules already at max (${MAX_RULES}), consolidating instead of adding`);
                project[promptKey] = consolidateRules(project[promptKey], remediation.content, MAX_RULES);
            } else if (!isRuleRedundant(project[promptKey], remediation.content)) {
                project[promptKey].push({
                    rule: remediation.content,
                    source: 'review-remediation',
                    addedAt: new Date().toISOString()
                });
            } else {
                logger.info('remediationApplier', '[REMEDIATION] review rule skipped as redundant');
            }
            await store.setItem('projects', projectId, project);
            return `处理Review规则: ${remediation.content.substring(0, 50)}...`;
        }

        default:
            throw new Error(`Unknown remediation target: ${remediation.target}`);
    }
}

async function getWriterPromptInjection(projectId) {
    const _wpiCtx = await getDataContext(projectId);
    const project = await _wpiCtx.getProject();
    if (!project?.writerPromptAdditions?.length) return '';

    return '\n\n【专项写作规则 - 基于评测整改】\n' +
        project.writerPromptAdditions
            .map((r, i) => `${i + 1}. ${r.rule}`)
            .join('\n');
}

async function getReviewPromptInjection(projectId) {
    const _rpiCtx = await getDataContext(projectId);
    const project = await _rpiCtx.getProject();
    if (!project?.reviewPromptAdditions?.length) return '';

    return '\n\n【专项审核规则 - 基于评测整改】\n' +
        project.reviewPromptAdditions
            .map((r, i) => `${i + 1}. ${r.rule}`)
            .join('\n');
}

function getWriterPromptInjectionSync(project) {
    if (!project?.writerPromptAdditions?.length) return '';
    return '\n\n【专项写作规则 - 基于评测整改】\n' +
        project.writerPromptAdditions
            .map((r, i) => `${i + 1}. ${r.rule}`)
            .join('\n');
}

function getReviewPromptInjectionSync(project) {
    if (!project?.reviewPromptAdditions?.length) return '';
    return '\n\n【专项审核规则 - 基于评测整改】\n' +
        project.reviewPromptAdditions
            .map((r, i) => `${i + 1}. ${r.rule}`)
            .join('\n');
}

module.exports = {
    applyRemediation,
    getWriterPromptInjection,
    getReviewPromptInjection,
    getWriterPromptInjectionSync,
    getReviewPromptInjectionSync
};
