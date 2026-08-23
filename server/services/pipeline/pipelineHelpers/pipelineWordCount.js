const logger = require('../../../shared/logger');
const store = require('../../../store');
const { resolveGenreFromProject } = require('../../genreConfig');
const { resolveConfig } = require('../../../config');

function formatFeedbackText(feedback) {
    const fb = feedback || {};
    const issueLines = (fb.issues || []).map((i, idx) => {
        const desc = typeof i === 'string' ? i : i.description || JSON.stringify(i);
        const sev = i.severity ? `[${i.severity}]` : '';
        return `${idx + 1}. ${sev} ${desc}`;
    });
    const suggestionLines = (fb.suggestions || []).map((s, idx) => {
        const desc = typeof s === 'string' ? s : s.description || JSON.stringify(s);
        return `${idx + 1}. ${desc}`;
    });
    return [
        fb.summary ? '【总结】' + fb.summary : '',
        issueLines.length > 0 ? '【必须修改的问题】\n' + issueLines.join('\n') : '',
        suggestionLines.length > 0 ? '【修改建议】\n' + suggestionLines.join('\n') : ''
    ].filter(Boolean).join('\n\n');
}

async function checkWordCountHardLimit(step, chapterId, project, mode) {
    if (!['first-review', 'fast-review', 'second-review'].includes(step)) return { blocked: false };
    const currentChapterData = await store.getItem('chapters', chapterId);
    const currentWordCount = (currentChapterData?.content || '').replace(/\s/g, '').length;
    const genre = resolveGenreFromProject(project);
    const config = resolveConfig(genre, project);
    const currentRejectMin = config.word.rejectMin;
    const currentMaxWords = config.word.maxChapter;

    if (currentWordCount < currentRejectMin) {
        const wcGap = currentRejectMin - currentWordCount;
        logger.warn('wordCount', `字数硬拦截 ${currentWordCount}< 最低${currentRejectMin}字，直接拒绝`);
        return {
            blocked: true,
            stepResult: {
                step, passed: false,
                feedback: {
                    approved: false,
                    summary: `【字数严重不足】当前${currentWordCount}字，距离最低${currentRejectMin}字还差${wcGap}字。必须大幅扩展内容。`,
                    issues: [{ desc: `字数${currentWordCount}字低于最低要求${currentRejectMin}字，差${wcGap}字`, severity: 'critical' }],
                    suggestions: [
                        `在场景转换处插入至少150字的环境描写和角色感受`,
                        '为每段对话补充至50字的微动作和表情描写',
                        '在开头和结尾各增加至300字的铺垫和收束',
                        '将简略叙述改为详细描写，每个动作拆解为3-5个感官细节',
                        `绝对不要删减现有内容，只做加法，至少新增${wcGap + 200}字`
                    ],
                    edits: []
                },
                result: { response: '' }
            }
        };
    }

    if (currentWordCount > currentMaxWords) {
        const wcOver = currentWordCount - currentMaxWords;
        logger.warn('wordCount', `字数超限硬拦截 ${currentWordCount}> 上限${currentMaxWords}字，超${wcOver}字`);
        return {
            blocked: true,
            stepResult: {
                step, passed: false,
                feedback: {
                    approved: false,
                    summary: `【字数超限】当前${currentWordCount}字，超过上限${currentMaxWords}字超${wcOver}字。必须精简内容。`,
                    issues: [{ desc: `字数${currentWordCount}字超过上限${currentMaxWords}字，超${wcOver}字`, severity: 'major' }],
                    suggestions: [
                        `删除重复的感官描写和场景描写，至少精简${wcOver + 200}字`,
                        '合并功能重叠的段落，保留最精彩的版本',
                        '精简过渡段和环境描写，每个场景保留1-2个核心感官细节即可',
                        '删除与主线无关的支线描写',
                        `绝对不要新增内容，只做减法，至少删减${wcOver + 200}字`
                    ],
                    edits: []
                },
                result: { response: '' }
            }
        };
    }

    return { blocked: false };
}

module.exports = { formatFeedbackText, checkWordCountHardLimit };
