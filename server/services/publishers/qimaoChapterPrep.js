const { cleanChapterContent } = require('../contentUtils');
const { filterContent } = require('./sensitiveWordFilter');

function prepareChapterData(chapter, forUpdate = false) {
    let rawTitle = chapter.title || '';
    let chapterTitle = rawTitle.replace(/^第\s*\d+\s*章\s*/, '').trim();
    if (chapterTitle.length > 20) chapterTitle = chapterTitle.substring(0, 20);

    const chapterNum = String(parseInt(String(chapter.chapterNumber), 10));
    let content = cleanChapterContent(chapter.content);
    content = filterContent(content, 'qimao');

    return { chapterTitle, chapterNum, content, rawTitle };
}

module.exports = { prepareChapterData };
