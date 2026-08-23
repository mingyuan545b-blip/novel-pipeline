const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');
const { normalizeWordConfig } = require('../config/wordConfigNormalizer');

const PROFILE_DIR = path.join(__dirname, '../../data/genre-profiles');

let profiles = new Map();

function load() {
    profiles.clear();
    if (!fs.existsSync(PROFILE_DIR)) return 0;
    const files = fs.readdirSync(PROFILE_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(PROFILE_DIR, file), 'utf8'));
            profiles.set(data.id, data);
        } catch(_) { logger.warn('genreProfileRegistry', _.message || _); }
    }
    return profiles.size;
}

function list() { return Array.from(profiles.values()); }

function get(genreId) { return profiles.get(genreId) || null; }

function resolve(genreId) {
    const profile = get(genreId);
    if (profile) return profile;

    const genreStr = (genreId || '').toLowerCase();
    const aliases = {
        '玄幻修仙': '玄幻', '修仙': '玄幻', '修真': '玄幻', '仙侠': '玄幻',
        '都市玄幻': '都市异能', '都市': '都市异能', '异能': '都市异能',
        '科幻未来': '科幻', '未来': '科幻', '末世': '科幻',
        '武侠江湖': '武侠', '江湖': '武侠', '高武': '武侠',
        '灵异悬疑': '灵异', '悬疑': '灵异', '恐怖': '灵异', '规则怪谈': '灵异', '推理': '灵异',
        '网游虚拟': '网游', '游戏': '网游', '虚拟': '网游', '无限流': '网游', '系统': '网游', '副本': '网游',
        '历史穿越': '历史', '穿越': '历史', '权谋': '历史',
        '奇幻冒险': '奇幻', '冒险': '奇幻', '魔法': '奇幻',
        '都市商战': '商战', '商业': '商战', '职场': '商战',
        '言情古言': '言情', '古言': '言情', '虐恋': '言情',
        '甜宠匠心': '甜宠匠心', '甜宠': '甜宠匠心',
        '复仇': '商战', '逆袭': '商战',
        '符箓': '武侠', '符文': '武侠', '道术': '武侠',
        '番茄悬疑': '灵异', '番茄复仇': '商战', '番茄甜宠': '甜宠匠心',
        '番茄甜宠匠心': '甜宠匠心', '番茄系统': '网游', '番茄符箓': '武侠'
    };
    const resolved = aliases[genreId] || aliases[genreStr];
    return resolved ? get(resolved) : null;
}

function buildFullConfig(genreId, overrides = {}) {
    const profile = resolve(genreId);
    if (!profile) return null;

    const config = {
        genre: genreId,
        genreProfile: profile.id,
        namingStyle: overrides.namingStyle || profile.namingStyle || '',
        namingStyleIntensity: overrides.namingStyleIntensity || profile.namingStyleIntensity || 'medium',
        worldviewTemplate: overrides.worldviewTemplate || profile.worldviewTemplate || '',
        defaultSystemPersona: overrides.systemPersona || profile.defaultSystemPersona || '',
        defaultMode: overrides.mode || profile.defaultMode || 'novel',
        defaultArchetypes: profile.defaultArchetypes || [],
        defaultSpeechStyles: profile.defaultSpeechStyles || [],
        defaultDialects: profile.defaultDialects || [],
        styleHints: {
            pov: overrides.pov || profile.styleHints?.pov || '',
            tone: overrides.tone || profile.styleHints?.tone || '',
            style: overrides.style || profile.styleHints?.style || ''
        },
        wordConfig: normalizeWordConfig(overrides.wordConfig || profile.wordConfig || { minWords: 2200, targetWords: 2800, maxWords: 4000 }),
        constraintOverrides: profile.constraintOverrides || [],
        reviewFocus: profile.reviewFocus || [],
        materialFocus: profile.materialFocus || []
    };

    return config;
}

function buildProjectStyleProfile(genreId, overrides = {}) {
    const config = buildFullConfig(genreId, overrides);
    if (!config) return null;

    return {
        namingStyle: config.namingStyle,
        namingStyleIntensity: config.namingStyleIntensity,
        worldviewTemplate: config.worldviewTemplate,
        systemPersona: config.defaultSystemPersona,
        povRule: config.styleHints.pov ? `叙事视角：${config.styleHints.pov}` : '',
        toneRule: config.styleHints.tone ? `基调：${config.styleHints.tone}` : '',
        reviewFocus: config.reviewFocus.join('；'),
        materialFocus: config.materialFocus.join('、'),
        constraintOverrides: config.constraintOverrides
    };
}

function buildWriterPromptBlock(genreId) {
    const profile = resolve(genreId);
    if (!profile) return '';

    const parts = [];
    parts.push(`【题材适配配置：${profile.label}】`);

    if (profile.reviewFocus?.length) {
        parts.push(`审核重点：${profile.reviewFocus.join('；')}`);
    }
    if (profile.materialFocus?.length) {
        parts.push(`素材重点：${profile.materialFocus.join('、')}`);
    }

    return parts.join('\n');
}

function reload() { return load(); }

load();

module.exports = { list, get, resolve, buildFullConfig, buildProjectStyleProfile, buildWriterPromptBlock, reload };
