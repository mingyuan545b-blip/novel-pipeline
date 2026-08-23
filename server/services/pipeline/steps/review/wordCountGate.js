const { getDataContext } = require('../../../dataContext');
const { resolveGenreFromProject } = require('../../../genreConfig');
const { resolveConfig } = require('../../../../config');

async function checkWordCountGate(content, projectId) {
    try {
        const ctx = await getDataContext(projectId);
        const proj = await ctx.getProject();
        const genre = resolveGenreFromProject(proj);
        const config = resolveConfig(genre, proj);
        const rejectMin = config.word.rejectMin;
        const maxWords = config.word.maxChapter;
        const actualWc = (content || '').replace(/\s/g, '').length;
        const blocks = [];
        if (actualWc < rejectMin) {
            blocks.push({ severity: 'critical', description: `字数不达标：${actualWc}字 < 最低${rejectMin}字，必须扩展内容`, title: '字数不达标' });
        }
        if (actualWc > maxWords) {
            blocks.push({ severity: 'critical', description: `字数超标：${actualWc}字 > 上限${maxWords}字，必须精简内容`, title: '字数超标' });
        }
        return blocks;
    } catch (_) {
        return [];
    }
}

module.exports = { checkWordCountGate };
