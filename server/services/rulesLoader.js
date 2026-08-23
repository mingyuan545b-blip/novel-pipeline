const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function loadJsonFile(filePath) {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(DATA_DIR, filePath);
    if (!fs.existsSync(absPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(absPath, 'utf8'));
    } catch (e) {
        logger.warn('rulesLoader', `[RULES_LOADER] Failed to load ${absPath}: ${e.message}`);
        return null;
    }
}

function loadJsonDir(dirPath) {
    const absDir = path.isAbsolute(dirPath) ? dirPath : path.join(DATA_DIR, dirPath);
    if (!fs.existsSync(absDir)) return {};
    const result = {};
    for (const f of fs.readdirSync(absDir).filter(f => f.endsWith('.json'))) {
        const data = loadJsonFile(path.join(absDir, f));
        if (data) {
            const key = data.id || path.basename(f, '.json');
            result[key] = data;
        }
    }
    return result;
}

function getFoundation() {
    const files = fs.readdirSync(path.join(DATA_DIR, 'foundation-prompts')).filter(f => f.endsWith('.json'));
    if (files.length === 0) return null;
    files.sort();
    const latest = files[files.length - 1];
    return loadJsonFile(path.join(DATA_DIR, 'foundation-prompts', latest));
}

function getConstraintPresets() {
    return loadJsonDir('constraint-presets');
}

function getGenreRules(genreId) {
    const genreDir = path.join(DATA_DIR, 'genre-rules');
    if (!fs.existsSync(genreDir)) return null;
    const filePath = path.join(genreDir, `${genreId}.json`);
    return loadJsonFile(filePath);
}

function getAllGenreRules() {
    return loadJsonDir('genre-rules');
}

function getHierarchyRules() {
    return loadJsonFile(path.join(DATA_DIR, 'hierarchy-rules.json'));
}

function getAgentTemplates() {
    return loadJsonFile(path.join(DATA_DIR, 'agent-templates.json'));
}

function getFoundationContent() {
    const foundation = getFoundation();
    if (!foundation) return null;
    return foundation.content || null;
}

function getConstraintPresetsAsArray() {
    const presets = getConstraintPresets();
    return Object.values(presets);
}

function buildFoundationFromData(agentType, mode) {
    const content = getFoundationContent();
    if (!content) return null;
    let result = content;
    result = result.replace(/\[Agent类型\]/g, getAgentRoleName(agentType));
    result = result.replace(/\[任务描述\]/g, getAgentTaskDesc(agentType));
    return result;
}

function getAgentRoleName(agentType) {
    const names = {
        writer: '执笔人', reviser: '返修员', 'first-review': '初审编辑',
        'second-review': '复审编辑', 'final-editor': '定稿编辑',
        'material-manager': '素材管理员', 'fast-review': '快审编辑',
        'intent-planner': '意图规划师', reader: '读者代理'
    };
    return names[agentType] || agentType;
}

function getAgentTaskDesc(agentType) {
    const descs = {
        writer: '根据大纲和素材库创作章节正文',
        reviser: '根据审核反馈精准修改章节正文',
        'first-review': '审核正文与素材库一致性、视角、术语、写作手法',
        'second-review': '对初审结果二次校验，纠正初审误判',
        'final-editor': '最终润色定稿，确保无错别字/标点规范',
        'material-manager': '从正文中提取/更新角色、世界观、伏笔等素材',
        'fast-review': '快速审核节奏和关键节点',
        'intent-planner': '规划章节写作意图'
    };
    return descs[agentType] || '完成指定任务';
}

function getReviewRulesForGenre(genreId) {
    const rules = getGenreRules(genreId);
    if (!rules) return null;
    return rules.reviewRules || null;
}

function getFoundationAdditionsForGenre(genreId) {
    const rules = getGenreRules(genreId);
    if (!rules) return null;
    return rules.foundation || null;
}

function getDetectorsForGenre(genreId) {
    const rules = getGenreRules(genreId);
    if (!rules) return null;
    return rules.detectors || null;
}

function getInterceptorsForGenre(genreId) {
    const rules = getGenreRules(genreId);
    if (!rules) return null;
    return rules.interceptors || null;
}

function getMaterialTemplatesForGenre(genreId) {
    const rules = getGenreRules(genreId);
    if (!rules) return null;
    return rules.materialTemplates || null;
}

function getConstraintPresetsForGenre(genreId) {
    const rules = getGenreRules(genreId);
    if (!rules) return null;
    return rules.constraintPresets || null;
}

function getDedupRulesForGenre(genreId) {
    const rules = getGenreRules(genreId);
    if (!rules) return null;
    return rules.dedupRules || null;
}

function getNewContentValidationForGenre(genreId) {
    const rules = getGenreRules(genreId);
    if (!rules) return null;
    return rules.newContentValidation || null;
}

function listAvailableGenres() {
    const genreDir = path.join(DATA_DIR, 'genre-rules');
    if (!fs.existsSync(genreDir)) return [];
    return fs.readdirSync(genreDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
            const data = loadJsonFile(path.join(genreDir, f));
            return data ? { id: data.id || path.basename(f, '.json'), label: data.label || f } : null;
        })
        .filter(Boolean);
}

module.exports = {
    getFoundation, getFoundationContent, buildFoundationFromData,
    getConstraintPresets, getConstraintPresetsAsArray,
    getGenreRules, getAllGenreRules, getReviewRulesForGenre,
    getFoundationAdditionsForGenre, getDetectorsForGenre,
    getInterceptorsForGenre, getMaterialTemplatesForGenre,
    getConstraintPresetsForGenre, getDedupRulesForGenre,
    getNewContentValidationForGenre, getHierarchyRules,
    getAgentTemplates, listAvailableGenres
};
