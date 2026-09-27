const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');

const AGENT_ROLE_NAMES = {
    writer: '执笔人',
    reviser: '返修员',
    'first-review': '初审',
    'second-review': '复审',
    'final-editor': '定稿人',
    'material-manager': '素材管理',
    'material-organizer': '素材整理',
    'material-registrar': '素材登记',
    'knowledge-extraction': '知识抽取',
    'consistency-check': '一致性校验',
    'hook-budget-update': '伏笔预算更新',
    'intent-planner': '意图规划',
    'hook-budget': '伏笔预算',
    'rule-stack': '规则栈',
    polisher: '润色师',
    reader: '阅读者'
};

function ensureOutputDir(projectId, subDir) {
    const dir = path.join(OUTPUT_DIR, projectId, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function getChapterFileName(chapter, agentType) {
    const num = String(chapter.chapterNumber).padStart(2, '0');
    const title = (chapter.title || 'untitled').replace(/[\\/:*?"<>|]/g, '_').substring(0, 30);
    const role = AGENT_ROLE_NAMES[agentType] || agentType;
    return `第${num}章 ${title}-${role}.txt`;
}

function saveAgentOutput(projectId, chapter, agentType, content) {
    const dir = ensureOutputDir(projectId, 'chapters');
    const fileName = getChapterFileName(chapter, agentType);
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
}

function saveFinalContent(projectId, chapter) {
    const { cleanFinalContent } = require('./contentUtils');
    const dir = ensureOutputDir(projectId, 'final');
    const num = String(chapter.chapterNumber).padStart(2, '0');
    const title = (chapter.title || 'untitled').replace(/[\\/:*?"<>|]/g, '_').substring(0, 30);
    const fileName = `第${num}章 ${title}.txt`;
    const filePath = path.join(dir, fileName);
    const content = cleanFinalContent(chapter.content || '');
    fs.writeFileSync(filePath, content, 'utf-8');
    logger.info('fileOutput', `Final content saved: ${filePath} (${content.length} chars)`);
    return filePath;
}

function getAgentOutputPaths(projectId, chapter) {
    const dir = ensureOutputDir(projectId, 'chapters');
    const agentTypes = ['intent-planner', 'writer', 'reviser', 'first-review', 'second-review', 'final-editor', 'polisher', 'material-manager', 'reader'];
    const paths = {};
    for (const type of agentTypes) {
        const fileName = getChapterFileName(chapter, type);
        const filePath = path.join(dir, fileName);
        paths[type] = {
            relative: `output/${projectId}/chapters/${fileName}`,
            absolute: filePath,
            exists: fs.existsSync(filePath)
        };
    }
    return paths;
}

module.exports = {
    OUTPUT_DIR,
    AGENT_ROLE_NAMES,
    ensureOutputDir,
    getChapterFileName,
    saveAgentOutput,
    saveFinalContent,
    getAgentOutputPaths
};
