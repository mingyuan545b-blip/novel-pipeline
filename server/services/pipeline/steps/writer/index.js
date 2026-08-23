const logger = require('../../../../shared/logger');
const { getDataContext, resolveConfig, detectGenre, materialIndex } = require('./writerShared');
const { buildMaterialSection } = require('./writerMaterialBuilder');
const { buildWriterPrompt } = require('./writerPromptBuilder');
const { postProcessWriter } = require('./writerPostProcess');

async function handleWriter(params) {
    const { projectId, chapter, materials, agentContext, context, runAgent, saveAgentOutput, round, mode, modeConfig, maxChapterWords, budget } = params;
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    const genre = await ctx.getGenre();
    const config = resolveConfig(genre, project);

    try {
        const discoverySummary = materialIndex.getDiscoverySummary(projectId);
        if (discoverySummary) agentContext.discoveryLog = discoverySummary;
    } catch(_) { logger.warn('index', '[writer]', _.message || _); }

    let materialSectionData;
    try {
        logger.info('index', '[writer] step1: buildMaterialSection start');
        materialSectionData = await buildMaterialSection({
            projectId, chapter, materials, ctx, project, genre, config
        });
        logger.info('index', '[writer] step1: buildMaterialSection done');
    } catch (err) {
        logger.error('index', '[writer] step1 buildMaterialSection failed', { error: err.message, stack: err.stack, name: err.name });
        throw err;
    }

    try {
        logger.info('index', '[writer] step2: buildWriterPrompt start');
        await buildWriterPrompt({
            projectId, chapter, agentContext, context, config, genre, styleProfile: materialSectionData.styleProfile, outlineText: materialSectionData.outlineText,
            materialSection: materialSectionData.materialSection, characterRefSection: materialSectionData.characterRefSection, nameLockSection: materialSectionData.nameLockSection, knowledgeAccessSection: materialSectionData.knowledgeAccessSection, budget, round
        });
        logger.info('index', '[writer] step2: buildWriterPrompt done');
    } catch (err) {
        logger.error('index', '[writer] step2 buildWriterPrompt failed', { error: err.message, stack: err.stack, name: err.name });
        throw err;
    }

    let result;
    try {
        logger.info('index', '[writer] step3: runAgent start');
        result = await runAgent('writer', agentContext);
        logger.info('index', '[writer] step3: runAgent done');
    } catch (err) {
        logger.error('index', '[writer] step3 runAgent failed', { error: err.message, stack: err.stack, name: err.name });
        throw err;
    }

    if (!result.response || result.response.trim().length === 0) {
        logger.error('index', 'writer returned empty response');
        throw new Error('Writer agent returned empty response. Model may have used all tokens for reasoning.');
    }

    try {
        logger.info('index', '[writer] step4: postProcessWriter start');
        const postResult = await postProcessWriter({
            projectId, chapter, result, config, genre, maxChapterWords, saveAgentOutput, round
        });
        logger.info('index', '[writer] step4: postProcessWriter done');
        return postResult;
    } catch (err) {
        logger.error('index', '[writer] step4 postProcessWriter failed', { error: err.message, stack: err.stack, name: err.name });
        throw err;
    }
}

module.exports = { handleWriter };
