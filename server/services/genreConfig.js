const logger = require('../shared/logger');
const { getRegistry, getMap, reloadGenres, getGenreDir } = require('./genreLoader');
const {
    getGenreDedupRules, getGenreReviewRules, getAllGenreConstraintPresets,
    getAllGenreDedupRules, runGenreFirstReviewIntercept, runGenreSecondReviewIntercept,
    getGenreWriterInjection, getGenreTerminologyResult, getGenreQualityResults,
    getGenrePerspectiveSchema
} = require('./genreDetectorHelpers');
const {
    getEnabledModules, hasModule, canAgentAccessModule, getModulesForAgent
} = require('./genres/genreModuleAssembler');
// 分支机制：支持题材内多世界观分支切换
// branchCache缓存已应用分支的题材对象，避免重复深拷贝
const branchCache = new Map();

function detectGenre(styleProfile) {
    if (!styleProfile) return null;
    const GENRE_REGISTRY = getRegistry();
    const key = (styleProfile?.key || styleProfile?.genreProfile || styleProfile?.genre || styleProfile?._genreId || '').toLowerCase();
    if (key) {
        const exactMatch = GENRE_REGISTRY.find(g => g.id === key);
        if (exactMatch) return exactMatch;
    }
    const label = (styleProfile?.label || styleProfile?.genre || '').toLowerCase();
    if (label) {
        for (const genre of GENRE_REGISTRY) {
            if (genre.genreProfileIds && genre.genreProfileIds.some(id => id === label)) return genre;
        }
        let bestMatch = null;
        let bestMatchLength = 0;
        for (const genre of GENRE_REGISTRY) {
            if (genre.genreProfileIds) {
                for (const id of genre.genreProfileIds) {
                    if (label.includes(id) || id.includes(label)) {
                        if (id.length > bestMatchLength) { bestMatch = genre; bestMatchLength = id.length; }
                    }
                }
            }
        }
        if (bestMatch) return bestMatch;
    }
    for (const genre of GENRE_REGISTRY) {
        if (genre.isMatch(styleProfile)) return genre;
    }
    return null;
}

function getGenreById(genreId) {
    const map = getMap();
    return map[genreId] || getRegistry().find(g => g.id === genreId) || null;
}

function resolveGenreFromProject(project) {
    if (!project) return null;
    const subGenre = project.subGenre || project.subgenre || '';
    let baseGenre = null;
    if (subGenre) {
        baseGenre = getGenreById(subGenre);
    }
    if (!baseGenre && project.styleProfile) {
        baseGenre = detectGenre(project.styleProfile);
    }
    if (!baseGenre && project.genre) {
        baseGenre = getGenreById(project.genre) || detectGenre({ genre: project.genre });
    }
    if (!baseGenre) return null;

    // 分支机制：如果题材支持分支且项目指定了branchKey，返回应用分支后的题材
    // 缓存键：genreId + branchKey，避免重复深拷贝
    const branchKey = project.branchKey || '';
    if (branchKey && baseGenre.branches) {
        const cacheKey = `${baseGenre.id}:${branchKey}`;
        if (branchCache.has(cacheKey)) return branchCache.get(cacheKey);
        try {
            const branched = baseGenre.branches.applyBranch(baseGenre, branchKey);
            branchCache.set(cacheKey, branched);
            return branched;
        } catch (e) {
            logger.warn('genreConfig', `applyBranch failed for ${cacheKey}: ${e.message}`);
            return baseGenre;
        }
    }
    return baseGenre;
}

/**
 * 清理分支缓存（题材重新加载或分支配置变更时调用）
 */
function clearBranchCache() {
    branchCache.clear();
}

function getGenrePlugin(styleProfile) {
    const genre = detectGenre(styleProfile);
    if (!genre) return null;
    try {
        const rulesLoader = require('./rulesLoader');
        const dataRules = rulesLoader.getGenreRules(genre.id);
        if (dataRules) {
            return new Proxy(genre, {
                get(target, prop) {
                    if (prop === 'reviewRules' && dataRules.reviewRules) return dataRules.reviewRules;
                    if (prop === 'foundation' && dataRules.foundation) return { ...target.foundation || {}, ...dataRules.foundation };
                    if (prop === 'constraintPresets' && dataRules.constraintPresets) return { ...target.constraintPresets || {}, ...dataRules.constraintPresets };
                    if (prop === 'dedupRules' && dataRules.dedupRules) return dataRules.dedupRules;
                    if (prop === 'materialTemplates' && dataRules.materialTemplates) return dataRules.materialTemplates;
                    if (prop === 'newContentValidation' && dataRules.newContentValidation) return { ...target.newContentValidation || {}, ...dataRules.newContentValidation };
                    return target[prop];
                }
            });
        }
    } catch(_) { logger.warn('genreConfig', _.message || _); }  // DEGRADE: 影响=题材配置加载 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    return genre;
}

function getGenreRegistry() { return getRegistry(); }
function getRegisteredGenres() { return getRegistry(); }

/**
 * 题材级新素材校验
 * 支持两种调用签名（陷阱#91修复：此前3个文件引用但函数从未定义）：
 *   1. validateNewMaterial(materialType, name, content) — materialCreateAction.js
 *   2. validateNewMaterial(materialObj, styleProfile, materials) — materialMarkdownExtractor.js
 * 返回统一对象 { valid, reason, errors }，兼容两个调用点的期望
 */
function validateNewMaterial(materialOrType, nameOrStyleProfile, contentOrMaterials) {
    const { VALID_MATERIAL_TYPES } = require('../config/materialTypes');

    let type, name, content;
    if (typeof materialOrType === 'string') {
        type = materialOrType;
        name = nameOrStyleProfile;
        content = contentOrMaterials;
    } else {
        type = materialOrType?.type || '';
        name = materialOrType?.name || '';
        content = materialOrType?.currentContent || materialOrType?.initialContent || '';
    }

    const errors = [];
    if (!type) errors.push('素材类型不能为空');
    else if (!VALID_MATERIAL_TYPES.includes(type)) errors.push(`无效素材类型: ${type}`);
    if (!name || !String(name).trim()) errors.push('素材名称不能为空');
    if (!content || !String(content).trim()) errors.push('素材内容不能为空');

    return {
        valid: errors.length === 0,
        reason: errors[0] || '',
        errors
    };
}

module.exports = {
    GENRE_REGISTRY: getRegistry(),
    genreMap: getMap(),
    detectGenre, getGenreById, resolveGenreFromProject,
    getGenrePlugin, getGenreRegistry, getRegisteredGenres, reloadGenres,
    getGenreDedupRules, getGenreReviewRules, getAllGenreConstraintPresets,
    getAllGenreDedupRules, runGenreFirstReviewIntercept, runGenreSecondReviewIntercept,
    getGenreWriterInjection, getGenreTerminologyResult, getGenreQualityResults,
    getGenrePerspectiveSchema,
    getEnabledModules, hasModule, canAgentAccessModule, getModulesForAgent,
    clearBranchCache,
    validateNewMaterial
};
