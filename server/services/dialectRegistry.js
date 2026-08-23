const logger = require('../shared/logger');
const fs = require('fs');
const path = require('path');

const DIALECTS_DIR = path.join(__dirname, '..', '..', 'data', 'dialects');

let _cache = null;
let _watcher = null;
let _watchDebounce = null;

function startWatcher() {
    if (_watcher) return;
    if (!fs.existsSync(DIALECTS_DIR)) return;
    try {
        _watcher = fs.watch(DIALECTS_DIR, { persistent: false }, (eventType, filename) => {
            if (!filename || !filename.endsWith('.json')) return;
            if (_watchDebounce) clearTimeout(_watchDebounce);
            _watchDebounce = setTimeout(() => {
                logger.info('dialectRegistry', `[DialectRegistry] File change detected (${filename}), reloading...`);
                invalidateCache();
            }, 500);
        });
        _watcher.on('error', () => {});
    } catch(_) { logger.warn('dialectRegistry', _.message || _); }
}

function loadAll() {
    if (_cache) return _cache;
    startWatcher();
    _cache = {};
    if (!fs.existsSync(DIALECTS_DIR)) return _cache;
    try {
        const files = fs.readdirSync(DIALECTS_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(DIALECTS_DIR, file), 'utf-8'));
                if (data.region) {
                    _cache[data.region] = data;
                }
            } catch (e) {
                logger.warn('dialectRegistry', `[DialectRegistry] 加载方言文件失败: ${file}`, e.message);
            }
        }
        logger.info('dialectRegistry', `[DialectRegistry] 已加载 ${Object.keys(_cache).length} 个方言: ${Object.keys(_cache).join(', ')}`);
    } catch (e) {
        logger.warn('dialectRegistry', '[DialectRegistry] 方言目录不存在或无法读取:', e.message);
    }
    return _cache;
}

function getDialect(region) {
    const all = loadAll();
    return all[region] || null;
}

function getAllRegions() {
    const all = loadAll();
    return Object.keys(all).map(region => ({
        region,
        label: all[region].label,
        description: all[region].description
    }));
}

function getDialectPromptForCharacter(charName, dialectRegion, intensity) {
    const dialect = getDialect(dialectRegion);
    if (!dialect) return '';

    const level = intensity || 'medium';
    const intensityDesc = dialect.intensity?.[level] || dialect.intensity?.medium || '';
    const features = dialect.features || {};

    const parts = [];
    parts.push(`${charName}(${dialect.label}·${level === 'light' ? '轻度' : level === 'heavy' ? '重度' : '中度'})`);

    if (features.sentenceFinal?.length) {
        parts.push(`句尾语气词: ${features.sentenceFinal.slice(0, 5).join('、')}`);
    }
    if (features.pronouns && Object.keys(features.pronouns).length) {
        const pronounStr = Object.entries(features.pronouns).map(([k, v]) => `${k}→${v}`).join('、');
        parts.push(`代词: ${pronounStr}`);
    }
    if (features.vocabulary && Object.keys(features.vocabulary).length) {
        const vocabStr = Object.entries(features.vocabulary).slice(0, 8).map(([k, v]) => `${k}→${v}`).join('、');
        parts.push(`核心词: ${vocabStr}`);
    }
    if (features.grammarPatterns?.length) {
        parts.push(`句式: ${features.grammarPatterns.slice(0, 3).join('；')}`);
    }
    if (dialect.examples?.[level]) {
        parts.push(`示例: "${dialect.examples[level]}"`);
    }

    return parts.join(' | ');
}

function buildDialectPromptBlock(characters) {
    if (!characters || !characters.length) return '';

    const dialectChars = characters.filter(c => c.dialectRegion);
    if (!dialectChars.length) return '';

    const lines = [];
    lines.push('【角色方言规则——必须遵守】');

    for (const char of dialectChars) {
        const prompt = getDialectPromptForCharacter(char.name, char.dialectRegion, char.dialectIntensity);
        if (prompt) lines.push(`- ${prompt}`);
    }

    lines.push('');
    lines.push('【方言使用铁律】');
    lines.push('1. 方言服务于角色辨识度，不是炫技——每3-5句对话出现1次方言特征即可');
    lines.push('2. 方言词必须上下文可推断含义——非该方言区读者也能理解');
    lines.push('3. 高紧张/关键转折场景降级方言强度，别让方言干扰叙事节奏');
    lines.push('4. 叙述者（旁白）不用方言，只有角色对话用方言');
    lines.push('5. 不同方言区的角色对话时，各自保持自己的方言特色');

    return lines.join('\n');
}

function buildDialectReviewBlock(characters) {
    if (!characters || !characters.length) return '';

    const dialectChars = characters.filter(c => c.dialectRegion);
    if (!dialectChars.length) return '';

    const lines = [];
    lines.push('【方言一致性审核】');
    for (const char of dialectChars) {
        const dialect = getDialect(char.dialectRegion);
        if (dialect) {
            lines.push(`- ${char.name}应带${dialect.label}特色，检查其对话是否使用了方言特征词`);
        }
    }
    lines.push('注意：方言使用应自然适度，不是每句对话都要带方言词');

    return lines.join('\n');
}

function reload() {
    _cache = null;
    loadAll();
}

let _identifierCharsRegex = null;

function getIdentifierCharsRegex() {
    if (_identifierCharsRegex) return _identifierCharsRegex;
    const all = loadAll();
    const phrases = new Set();
    for (const dialect of Object.values(all)) {
        const features = dialect.features || {};
        if (features.sentenceFinal) {
            for (const phrase of features.sentenceFinal) {
                if (phrase && /[\u4e00-\u9fff]/.test(phrase)) phrases.add(phrase);
            }
        }
        if (features.pronouns) {
            for (const val of Object.values(features.pronouns)) {
                if (val && /[\u4e00-\u9fff]/.test(val)) phrases.add(val);
            }
        }
        if (features.vocabulary) {
            for (const val of Object.values(features.vocabulary)) {
                if (val && /[\u4e00-\u9fff]/.test(val)) phrases.add(val);
            }
        }
    }
    if (phrases.size === 0) {
        _identifierCharsRegex = /(?!.)/;
        return _identifierCharsRegex;
    }
    const sorted = [...phrases].sort((a, b) => b.length - a.length);
    _identifierCharsRegex = new RegExp(`(${sorted.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
    return _identifierCharsRegex;
}

function invalidateCache() {
    _cache = null;
    _identifierCharsRegex = null;
}

module.exports = {
    loadAll,
    getDialect,
    getAllRegions,
    getDialectPromptForCharacter,
    buildDialectPromptBlock,
    buildDialectReviewBlock,
    getIdentifierCharsRegex,
    invalidateCache,
    reload
};
