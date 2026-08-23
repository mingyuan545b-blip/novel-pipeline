const store = require('../store');
const { resolveGenreFromProject } = require('./genreConfig');
const { getDataContext } = require('./dataContext');
const llm = require('./llm');
const { DEFAULT_MODEL } = require('../config/modelResolver');
const { PROVIDER_DEFAULTS } = require('../config/systemConfig');
const { REMEDIATION_TARGETS } = require('./remediationTargets');
const { isRuleRedundant, consolidateRules } = require('./remediationRules');
const {
    getWriterPromptInjection,
    getReviewPromptInjection,
    getWriterPromptInjectionSync,
    getReviewPromptInjectionSync
} = require('./remediationApplier');
const { buildRemediationPrompt, parseRemediationResponse, executeRemediations } = require('./remediationHelpers');

async function analyzeAndRemediate(projectId, reviewText, options = {}) {
    const _rmCtx = await getDataContext(projectId);
    const project = await _rmCtx.getProject();
    if (!project) throw new Error('Project not found');

    const mode = project.mode || 'novel';
    const genre = resolveGenreFromProject(project);
    const chapters = (await store.queryItems('chapters', { projectId }))
        .filter(ch => ch.content)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

    const sampleText = chapters.slice(0, 3).map(ch =>
        `【第${ch.chapterNumber}章 ${ch.title} - 开头200字】\n${ch.content.substring(0, 200)}\n【第${ch.chapterNumber}章 - 结尾200字】\n${ch.content.substring(ch.content.length - 200)}`
    ).join('\n\n');

    const apiConfig = {
        provider: process.env.LLM_PROVIDER || PROVIDER_DEFAULTS.DEFAULT_PROVIDER,
        model: process.env.LLM_MODEL || DEFAULT_MODEL,
        temperature: 0.2
    };

    const analysisPrompt = buildRemediationPrompt(project, genre, chapters, sampleText, reviewText);

    const result = await llm.chat(
        [{ role: 'system', content: '你是小说流水线整改专家，只输出JSON。' }, { role: 'user', content: analysisPrompt }],
        { maxTokens: 4096, temperature: 0.2, apiConfig }
    );
    const responseText = result.choices?.[0]?.message?.content || result.response || '';

    const parsed = parseRemediationResponse(responseText, reviewText);

    const autoApply = options.autoApply !== false;
    const executionLog = autoApply ? await executeRemediations(projectId, parsed.remediations, mode) : [];

    return {
        success: true,
        problems: parsed.problems,
        remediations: parsed.remediations,
        executionLog,
        autoApplied: autoApply
    };
}

module.exports = {
    REMEDIATION_TARGETS,
    analyzeAndRemediate,
    applyRemediation: require('./remediationApplier').applyRemediation,
    getWriterPromptInjection,
    getReviewPromptInjection,
    getWriterPromptInjectionSync,
    getReviewPromptInjectionSync,
    isRuleRedundant,
    consolidateRules
};
