/**
 * projectCreateHandler - 项目创建逻辑
 */
const { v4: uuidv4 } = require('uuid');
const { getDefaultsForGenre } = require('../../config/genreDefaults');
const { resolveGenreFromProject } = require('../../services/genreConfig');
const genreProfileRegistry = require('../../services/genreProfileRegistry');
const { normalizeWordConfig } = require('../../config/wordConfigNormalizer');
const { normalizeStyleProfile } = require('../../config/styleProfileNormalizer');
const logger = require('../../shared/logger');

// 防御性常量：字段长度上限，防止超长字符串入库导致JSON膨胀或前端渲染卡顿
const FIELD_LIMITS = {
    NAME_MAX: 200,
    DESCRIPTION_MAX: 2000,
    GENRE_MAX: 50
};

// 系统唯一支持的模式：长篇。所有项目统一走novel模式
const SUPPORTED_MODE = 'novel';

/**
 * 实体中心模块的项目级默认档位（单一源见 config/moduleDefaults.js）。
 * 修复（2026-10-05 勘定压测 P0-A）：模块注册默认值是 'off'，新项目不设置 → 编年史/世界域
 * 提取链永不触发，实体中心的招牌功能（编年史/世界域）默认全 0 条。这里给新项目一个
 * 可用的默认档位（仍可在 UI 切换到 off/minimal/full）。
 */
const { DEFAULT_MODULE_SETTINGS } = require('../../config/moduleDefaults');

// 过滤前端可能传入的"null"/"undefined"字符串（非真实null值）
function sanitizeOptionalString(value) {
    if (!value || value === 'null' || value === 'undefined') return null;
    return String(value).trim() || null;
}

function truncateField(value, maxLen) {
    if (typeof value !== 'string') return value;
    return value.length > maxLen ? value.substring(0, maxLen) : value;
}

function resolveProfileId(genreStr, subGenre) {
    // 1. 直接通过genreProfileRegistry解析
    const direct = genreProfileRegistry.resolve(genreStr) || genreProfileRegistry.resolve(subGenre);
    if (direct) return direct.id;

    // 2. 通过题材插件的genreProfileIds反向解析
    const genrePlugin = resolveGenreFromProject({ subGenre, genre: genreStr, styleProfile: null });
    if (genrePlugin?.genreProfileIds?.length) {
        for (const pid of genrePlugin.genreProfileIds) {
            const profile = genreProfileRegistry.resolve(pid);
            if (profile) return profile.id;
        }
    }
    return null;
}

function buildStyleProfile(req, subGenre, genreStr, branchKey) {
    let styleProfile = req.body.styleProfile || null;
    let genreFullConfig = null;
    if (!styleProfile && (subGenre || genreStr)) {
        const profileId = resolveProfileId(genreStr, subGenre);
        if (profileId) {
            genreFullConfig = genreProfileRegistry.buildFullConfig(profileId, {
                style: req.body.style, tone: req.body.tone, pov: req.body.pov
            });
        }
        // 从题材插件获取完整styleProfile（含povRule/dialogueRule等）
        // 修复陷阱#71遗漏：必须传入branchKey，否则分支styleProfileOverrides不生效，
        // 导致review agent仍用旧约束词（老前辈等已清理元素）
        const genrePlugin = resolveGenreFromProject({ subGenre, genre: genreStr, styleProfile: null, branchKey });
        const pluginSP = genrePlugin?.styleProfile || {};
        if (genreFullConfig) {
            // 陷阱#73修复：key/tone/namingStyle/worldviewTemplate/systemPersona 5个字段
            // 必须优先从分支pluginSP读取，fallback到genreFullConfig（题材profile配置）
            // 否则分支styleProfileOverrides不生效，review agent仍用旧约束词（老前辈/江湖雅称等）
            styleProfile = {
                key: pluginSP.key || genreFullConfig.genreProfile || profileId,
                genre: genreStr,
                genreProfile: genreFullConfig.genreProfile || genreStr,
                style: genreFullConfig.styleHints?.style || '',
                tone: pluginSP.tone || genreFullConfig.styleHints?.tone || '',
                pov: genreFullConfig.styleHints?.pov || '',
                namingStyle: pluginSP.namingStyle || genreFullConfig.namingStyle || '',
                namingStyleIntensity: genreFullConfig.namingStyleIntensity || 'medium',
                worldviewTemplate: pluginSP.worldviewTemplate || genreFullConfig.worldviewTemplate || '',
                systemPersona: pluginSP.systemPersona || genreFullConfig.defaultSystemPersona || '',
                reviewFocus: (genreFullConfig.reviewFocus || []).join('；'),
                materialFocus: (genreFullConfig.materialFocus || []).join('、'),
                constraintOverrides: genreFullConfig.constraintOverrides || [],
                // 从题材插件styleProfile继承的关键约束字段
                povRule: pluginSP.povRule || '',
                dialogueRule: pluginSP.dialogueRule || '',
                behaviorRule: pluginSP.behaviorRule || '',
                toneRule: pluginSP.toneRule || '',
                characterRefRules: pluginSP.characterRefRules || '',
                narrativeDistance: pluginSP.narrativeDistance || '',
                titleRule: pluginSP.titleRule || ''
            };
        }
    }
    return { styleProfile, genreFullConfig };
}

function createProjectData(req) {
    const id = uuidv4();
    const now = new Date().toISOString();
    // Bug#4修复：强制mode=novel，忽略前端传入的任何其他值（爽文/番茄模式已废弃）
    const mode = SUPPORTED_MODE;
    // Bug#3修复：过滤"null"/"undefined"字符串，确保subGenre是真实null值而非字符串
    let subGenre = sanitizeOptionalString(req.body.subGenre);
    // Bug#8修复：防御性长度校验，防止超长字符串入库
    const genreStr = truncateField(sanitizeOptionalString(req.body.genre) || '', FIELD_LIMITS.GENRE_MAX);
    const rawName = (req.body.name || '').toString().trim() || 'Untitled Project';
    const name = truncateField(rawName, FIELD_LIMITS.NAME_MAX);
    const description = truncateField((req.body.description || '').toString(), FIELD_LIMITS.DESCRIPTION_MAX);

    const genrePlugin = resolveGenreFromProject({ subGenre, genre: genreStr, styleProfile: null });
    if (!subGenre && genrePlugin) subGenre = genrePlugin.id;

    // 阶段3：分支机制——从req.body读取branchKey，验证有效性后设置到项目
    // branchKey决定世界观分支（programmatic/layered/metaverse），影响所有agent的约束词和术语体系
    const branchKey = sanitizeOptionalString(req.body.branchKey);
    let validBranchKey = null;
    if (branchKey && genrePlugin?.supportedBranchKeys?.includes(branchKey)) {
        validBranchKey = branchKey;
    } else if (branchKey && !genrePlugin?.supportedBranchKeys?.includes(branchKey)) {
        logger.warn('projectCreate', `branchKey "${branchKey}" not supported by genre "${subGenre}", ignored`);
    }

    const { styleProfile, genreFullConfig } = buildStyleProfile(req, subGenre, genreStr, validBranchKey);

    // Bug#5修复：targetChapters=0是合法值（表示不限章节数），不能用|| falsy判断
    const rawTargetChapters = req.body.targetChapters;
    const targetChapters = (typeof rawTargetChapters === 'number' && rawTargetChapters >= 0)
        ? rawTargetChapters
        : (rawTargetChapters ? Number(rawTargetChapters) || 100 : 100);

    // Schema-First：wordConfig归一化，统一字段名为标准Schema
    // 输入可能是任意变体（前端传入/genreProfileRegistry生成），统一转为{minWords, targetWords, maxWords, rejectMin}
    const rawWordConfig = req.body.wordConfig || genreFullConfig?.wordConfig || null;
    const wordConfig = normalizeWordConfig(rawWordConfig);

    // Schema-First：styleProfile归一化，补齐缺失的约束字段（povRule等7个字段）
    const normalizedStyleProfile = normalizeStyleProfile(styleProfile);

    return {
        id, name, description, genre: genreStr,
        mode, subGenre, season: sanitizeOptionalString(req.body.season),
        parentProjectId: sanitizeOptionalString(req.body.parentProjectId),
        genreProfile: sanitizeOptionalString(req.body.genreProfile),
        branchKey: validBranchKey,
        targetChapters,
        targetWordCount: req.body.targetWordCount || 0,
        currentChapter: 0, status: 'draft',
        styleProfile: normalizedStyleProfile,
        settings: { autoPipeline: false, chapterRounds: 3, ...DEFAULT_MODULE_SETTINGS, ...req.body.settings },
        styleTemplateId: req.body.styleTemplateId || '',
        constraints: req.body.constraints || (getDefaultsForGenre(genrePlugin || null, { mode }).defaultConstraints || []),
        wordConfig,
        chapters: [], chapterIntents: { chapters: {} },
        hookBudget: { hooks: [], lastUpdated: null },
        createdAt: now, updatedAt: now
    };
}

module.exports = { createProjectData, DEFAULT_MODULE_SETTINGS };
