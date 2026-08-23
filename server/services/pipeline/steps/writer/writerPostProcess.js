const logger = require('../../../../shared/logger');
const { store, cleanChapterContent, deduplicateContent, truncateChapter, validateTomatoMetrics, ensureCliffhanger, detectReversalDensity, detectCowardBehavior, resolveConfig, detectGenre } = require('./writerShared');
const { getDataContext } = require('../../../dataContext');

async function postProcessWriter(params) {
    const { projectId, chapter, result, config, genre, maxChapterWords, saveAgentOutput, round } = params;

    chapter.content = cleanChapterContent(result.response);
    const rawLen = (result.response || '').replace(/\s/g, '').length;
    const cleanLen = (chapter.content || '').replace(/\s/g, '').length;
    if (rawLen > 0 && cleanLen / rawLen < 0.6) {
        logger.warn('writerPostProcess', `⚠️ Writer输出大量非正文内容！原始${rawLen}字→清洗后${cleanLen}字（保留率${(cleanLen / rawLen * 100).toFixed(0)}%）。`);
    }
    chapter.writerOutput = chapter.content;
    chapter.status = 'written';
    chapter.round = round;

    const dedup = deduplicateContent(chapter.content);
    if (dedup.removed > 0) {
        logger.info('writerPostProcess', `去重: 移除${dedup.removed}处重复内容`);
        chapter.content = dedup.content;
        chapter.wordCount = chapter.content.replace(/\s/g, '').length;
    }
    chapter.wordCount = chapter.content.replace(/\s/g, '').length;

    if (chapter.wordCount > maxChapterWords) {
        logger.info('writerPostProcess', `字数超标: ${chapter.wordCount}字 > ${maxChapterWords}字，执行智能截断`);
        const truncated = truncateChapter(chapter.content, maxChapterWords);
        chapter.content = truncated.content;
        chapter.wordCount = truncated.content.replace(/\s/g, '').length;
        chapter.truncated = true;
        chapter.originalWordCount = result.response.length;
    }

    const rejectMinWords = config.word.rejectMin;
    if (chapter.wordCount < rejectMinWords) {
        return _handleWordCountReject(chapter, config, rejectMinWords);
    }

    _runValidation(chapter, config, genre);

    if (config.flow.requireCliffhanger) {
        chapter.content = ensureCliffhanger(chapter.content);
        chapter.wordCount = chapter.content.replace(/\s/g, '').length;
    }

    saveAgentOutput(projectId, chapter, 'writer', result.response);
    logger.info('writerPostProcess', `writer done: wordCount=${chapter.wordCount}`);

    await _activateQuests(projectId, chapter);

    return { step: 'writer', passed: true, result, chapter };
}

function _handleWordCountReject(chapter, config, rejectMinWords) {
    const gap = rejectMinWords - chapter.wordCount;
    const targetMinWords = config.word.targetMin;
    const targetMaxWords = config.word.targetMax;
    logger.warn('writerPostProcess', `字数不达标: ${chapter.wordCount}字 < 最低${rejectMinWords}字，直接退回重写`);
    chapter._wordCountRejected = true;
    chapter._wordCountDetail = `${chapter.wordCount}字 < 最低${rejectMinWords}字`;
    chapter.status = 'written';
    chapter.updatedAt = new Date().toISOString();
    store.setItem('chapters', chapter.id, chapter);
    return {
        step: 'writer',
        result: { response: chapter.content },
        passed: false,
        feedback: {
            approved: false,
            summary: `【字数严重不足】当前${chapter.wordCount}字，距离最低${rejectMinWords}字还差${gap}字，距离目标${targetMinWords}-${targetMaxWords}字还差${targetMinWords - chapter.wordCount}字以上。必须大幅扩展内容。`,
            issues: [{ desc: `字数${chapter.wordCount}字低于最低要求${rejectMinWords}字，差${gap}字`, severity: 'critical' }],
            suggestions: [
                `在现有场景之间插入新的过渡段落（至少${gap}字）`,
                '为每个角色动作补充感官描写（视觉+听觉+触觉+嗅觉至少2种）',
                '增加2-3段角色与环境的互动细节',
                '在对话之间插入角色微动作和表情描写',
                '扩展场景开场描写，用3-5句话铺垫环境氛围',
                '如果场景转换太快，放慢节奏补充过渡'
            ],
            edits: []
        },
        materialGuidance: ''
    };
}

function _runValidation(chapter, config, genre) {
    if (!config.validation || Object.keys(config.validation).length === 0) return;
    const tomatoValidation = validateTomatoMetrics(chapter.content, config);
    if (!tomatoValidation.pass) {
        logger.info('writerPostProcess', `番茄硬校验未通过: ${tomatoValidation.reason}`);
        chapter.tomatoValidation = tomatoValidation;
    } else {
        chapter.tomatoValidation = { pass: true };
    }
    if (config.validation?.reversalRequired) {
        const reversalResult = detectReversalDensity(chapter.content);
        chapter.reversalDensity = reversalResult;
        logger.info('writerPostProcess', `题材[${genre?.label || ''}] 反转密度: ${reversalResult.per2000}/2000字`);
    }
    const cowardResult = detectCowardBehavior(chapter.content);
    if (cowardResult.isViolation) {
        chapter.cowardBehavior = cowardResult;
        logger.info('writerPostProcess', `🚨 傻比行为检测: ${cowardResult.issues.map(i => i.desc).join('；')}`);
    }
}

async function _activateQuests(projectId, chapter) {
    const ctx = await getDataContext(projectId);
    const writerQuests = (await ctx.getQuests()).filter(q =>
        (q.chapterIds || []).includes(chapter.id) && q.status === 'planned'
    );
    for (const q of writerQuests) {
        await store.setItem('quests', q.id, { ...q, status: 'active', updatedAt: new Date().toISOString() });
    }
}

module.exports = { postProcessWriter };
