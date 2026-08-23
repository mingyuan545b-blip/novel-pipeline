/**
 * 统一配置入口 - 所有配置消费方只从这里读取业务配置
 * 优先级: project.wordConfig > genre.pipelineConfig > NOVEL_DEFAULTS
 * 所有项目统一走长篇(novel)模式，题材差异通过genre.pipelineConfig区分
 *
 * Schema-First：wordConfig通过normalizeWordConfig归一化，兼容所有历史变体
 */

const { getDefaultsForGenre } = require('./genreDefaults');
const { normalizeWordConfig } = require('./wordConfigNormalizer');
const { normalizeTargetChapters } = require('./targetChaptersNormalizer');

function resolveConfig(genre, project) {
    const defaults = getDefaultsForGenre(genre, project);
    const gpc = genre?.pipelineConfig || {};
    // 归一化project.wordConfig：兼容历史变体{targetMin,targetMax,rejectMin,maxWords}、{target,rejectMin}等
    const pwc = normalizeWordConfig(project?.wordConfig) || {};

    return {
        word: {
            // 统一从归一化后的标准字段名读取
            targetMin: pwc.minWords || gpc.targetMinWords || defaults.targetMinWords,
            targetMax: pwc.targetWords || gpc.targetMaxWords || defaults.targetMaxWords,
            rejectMin: pwc.rejectMin || gpc.rejectMinWords || defaults.rejectMinWords,
            maxChapter: pwc.maxWords || gpc.maxChapterWords || defaults.maxChapterWords
        },
        chapter: {
            // Schema-First：通过归一化函数读取targetChapters，兼容targetChapterCount历史字段名
            total: normalizeTargetChapters(project) ?? gpc.totalChapters ?? defaults.totalChapters,
            // 修复数据断链：前端settings.chapterRounds用户可配置，应优先于genre默认值
            // 优先级: project.settings.chapterRounds > genre.pipelineConfig.maxRounds > defaults.maxRounds
            maxRounds: project?.settings?.chapterRounds ?? gpc.maxRounds ?? defaults.maxRounds,
            chaptersPerBatch: gpc.chaptersPerBatch ?? defaults.chaptersPerBatch
        },
        flow: {
            skipSecondReview: gpc.skipSecondReview ?? defaults.skipSecondReview,
            requireCliffhanger: gpc.requireCliffhanger ?? defaults.requireCliffhanger,
            requireTrendingMemes: gpc.requireTrendingMemes ?? defaults.requireTrendingMemes
        },
        validation: {
            ...defaults.validation,
            ...(gpc.validation || {}),
            ...(genre?.pacingConfig ? { openingHookRange: genre.pacingConfig.openingHookRange } : {})
        },
        milestones: (gpc.milestones && Object.keys(gpc.milestones).length > 0) ? gpc.milestones
            : (genre?.entitySchema?.milestones && Object.keys(genre.entitySchema.milestones).length > 0) ? genre.entitySchema.milestones
            : defaults.milestones,
        hook: { rangeScale: gpc.rangeScale ?? defaults.rangeScale },
        reader: { triggers: gpc.readerTriggers || defaults.readerTriggers },
        seasons: gpc.seasons || defaults.seasons,
        genre: genre ? { id: genre.id, label: genre.label } : null
    };
}

module.exports = { resolveConfig };
