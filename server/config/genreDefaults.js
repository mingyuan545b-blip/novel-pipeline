/**
 * 题材默认配置 - 统一来源
 * 禁止在其他文件定义题材默认值，所有消费方必须从这里读取
 * 所有项目统一走长篇(novel)模式，题材差异通过genre插件的pipelineConfig区分
 */

const NOVEL_DEFAULTS = {
    targetMinWords: 2400,
    targetMaxWords: 2800,
    rejectMinWords: 2000,
    maxChapterWords: 3500,
    totalChapters: 100,
    maxRounds: 7,
    chaptersPerBatch: 5,
    skipSecondReview: false,
    requireCliffhanger: false,
    requireTrendingMemes: false,
    rangeScale: 1.0,
    milestones: {},
    validation: {
        openingHookRange: 100,
        dialogueRatioMax: 0.28,
        sweetPointRequired: false,
        reversalRequired: false
    },
    readerTriggers: [5, 10, 15, 20],
    seasons: null,
    defaultConstraints: ['no-derailment', 'proper-introduction', 'character-consistency', 'worldview-consistency', 'no-random-plot']
};

function getDefaultsForGenre(genre, project) {
    // 所有项目统一走长篇模式
    // 题材差异通过 genre.pipelineConfig 在 resolveConfig 中覆盖
    return NOVEL_DEFAULTS;
}

module.exports = { NOVEL_DEFAULTS, getDefaultsForGenre };
