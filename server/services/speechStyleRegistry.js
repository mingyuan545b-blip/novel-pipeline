const fs = require('fs');
const path = require('path');

const STYLES_DIR = path.join(__dirname, '..', '..', 'data', 'speech-styles');

let _cache = null;
let _watcher = null;
let _watchDebounce = null;

function startWatcher() {
    if (_watcher) return;
    if (!fs.existsSync(STYLES_DIR)) return;
    try {
        _watcher = fs.watch(STYLES_DIR, { persistent: false }, (eventType, filename) => {
            if (!filename || !filename.endsWith('.json')) return;
            if (_watchDebounce) clearTimeout(_watchDebounce);
            _watchDebounce = setTimeout(() => {
                console.log(`[SpeechStyleRegistry] File change detected (${filename}), reloading...`);
                _cache = null;
            }, 500);
        });
        _watcher.on('error', () => {});
    } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
}

function loadAll() {
    if (_cache) return _cache;
    startWatcher();
    _cache = {};
    if (!fs.existsSync(STYLES_DIR)) return _cache;
    try {
        const files = fs.readdirSync(STYLES_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(STYLES_DIR, file), 'utf-8'));
                if (data.id) {
                    _cache[data.id] = data;
                }
            } catch (e) {
                console.warn(`[SpeechStyleRegistry] 加载风格文件失败: ${file}`, e.message);
            }
        }
        console.log(`[SpeechStyleRegistry] 已加载 ${Object.keys(_cache).length} 个说话风格: ${Object.keys(_cache).join(', ')}`);
    } catch (e) {
        console.warn('[SpeechStyleRegistry] 风格目录不存在或无法读取:', e.message);
    }
    return _cache;
}

function getStyle(styleId) {
    const all = loadAll();
    return all[styleId] || null;
}

function getAllStyles() {
    const all = loadAll();
    return Object.keys(all).map(id => ({
        id,
        label: all[id].label,
        description: all[id].description
    }));
}

function getStylePromptForCharacter(charName, styleId, intensity) {
    const style = getStyle(styleId);
    if (!style) return '';

    const level = intensity || 'medium';
    const features = style.features || {};

    const parts = [];
    parts.push(`${charName}(${style.label}·${level === 'light' ? '轻度' : level === 'heavy' ? '重度' : '中度'})`);

    if (features.metaphorMap && Object.keys(features.metaphorMap).length) {
        const metaphorStr = Object.entries(features.metaphorMap).slice(0, 6).map(([k, v]) => `${k}→${v}`).join('、');
        parts.push(`隐喻映射: ${metaphorStr}`);
    }
    if (features.slangMap && Object.keys(features.slangMap).length) {
        const slangStr = Object.entries(features.slangMap).slice(0, 6).map(([k, v]) => `${k}→${v}`).join('、');
        parts.push(`黑话: ${slangStr}`);
    }
    if (features.vocabulary && Object.keys(features.vocabulary).length) {
        const vocabStr = Object.entries(features.vocabulary).slice(0, 6).map(([k, v]) => `${k}→${v}`).join('、');
        parts.push(`核心词: ${vocabStr}`);
    }
    if (features.catchphrases?.length) {
        parts.push(`口头禅: ${features.catchphrases.slice(0, 6).join('、')}`);
    }
    if (features.signaturePhrases?.length) {
        parts.push(`标志语: ${features.signaturePhrases.slice(0, 4).join('、')}`);
    }
    if (features.punExamples?.length) {
        parts.push(`谐音示例: ${features.punExamples.slice(0, 4).join('；')}`);
    }
    if (features.patterns?.length) {
        parts.push(`句式: ${features.patterns.slice(0, 3).join('；')}`);
    }
    if (style.examples?.[level]) {
        parts.push(`示例: "${style.examples[level]}"`);
    }

    return parts.join(' | ');
}

function buildStylePromptBlock(characters) {
    if (!characters || !characters.length) return '';

    const styleChars = characters.filter(c => c.speechStyle);
    if (!styleChars.length) return '';

    const lines = [];
    lines.push('【角色说话风格规则——必须遵守】');

    for (const char of styleChars) {
        const prompt = getStylePromptForCharacter(char.name, char.speechStyle, char.speechStyleIntensity);
        if (prompt) lines.push(`- ${prompt}`);
    }

    lines.push('');
    lines.push('【说话风格使用铁律】');
    lines.push('1. 说话风格服务于角色辨识度，不是炫技——每3-5句对话出现1次风格特征即可');
    lines.push('2. 风格表达必须上下文可推断含义——不熟悉该风格的读者也能理解');
    lines.push('3. 高紧张/关键转折场景收敛风格强度，别让风格干扰叙事节奏');
    lines.push('4. 叙述者（旁白）不用说话风格，只有角色对话用');
    lines.push('5. 方言是底色（轻），风格是人格（重）——有风格的角色方言自动降为轻度');
    lines.push('6. 风格是角色的灵魂标签，一个角色最多一种风格，不要叠加多种风格');

    return lines.join('\n');
}

function buildStyleReviewBlock(characters) {
    if (!characters || !characters.length) return '';

    const styleChars = characters.filter(c => c.speechStyle);
    if (!styleChars.length) return '';

    const lines = [];
    lines.push('【说话风格一致性审核】');
    for (const char of styleChars) {
        const style = getStyle(char.speechStyle);
        if (style) {
            lines.push(`- ${char.name}应带${style.label}风格，检查其对话是否使用了风格特征`);
        }
    }
    lines.push('注意：风格使用应自然适度，不是每句对话都要体现风格特征');

    return lines.join('\n');
}

function buildCombinedPromptBlock(characters) {
    const dialectRegistry = require('./dialectRegistry');

    const dialectOnlyChars = characters.filter(c => c.dialectRegion && !c.speechStyle);
    const styleChars = characters.filter(c => c.speechStyle);
    const bothChars = characters.filter(c => c.dialectRegion && c.speechStyle);

    const parts = [];

    if (dialectOnlyChars.length > 0) {
        const dialectBlock = dialectRegistry.buildDialectPromptBlock(dialectOnlyChars);
        if (dialectBlock) parts.push(dialectBlock);
    }

    if (styleChars.length > 0) {
        const styleBlock = buildStylePromptBlock(styleChars);
        if (styleBlock) parts.push(styleBlock);
    }

    if (bothChars.length > 0) {
        parts.push('【方言×风格组合规则——防止混乱】');
        parts.push('以下角色同时有方言和风格，必须遵守降级规则：');
        for (const char of bothChars) {
            const dialect = dialectRegistry.getDialect(char.dialectRegion);
            const style = getStyle(char.speechStyle);
            if (dialect && style) {
                parts.push(`- ${char.name}：${dialect.label}(降为轻度底色) + ${style.label}(主风格)`);
                parts.push(`  写法：风格是主味，方言是若隐若现的底色。读者先记住"${style.label}"，再隐约感到"${dialect.label}"口音`);
            }
        }
        parts.push('');
        parts.push('核心原则：方言是底色（轻），风格是人格（重）。有风格的角色，方言只留1-2个标志性词（如"咩""嘛""中"），不要完整方言化。');
    }

    return parts.join('\n\n');
}

function buildCombinedReviewBlock(characters) {
    const dialectRegistry = require('./dialectRegistry');
    const dialectBlock = dialectRegistry.buildDialectReviewBlock(characters);
    const styleBlock = buildStyleReviewBlock(characters);

    const parts = [];
    if (dialectBlock) parts.push(dialectBlock);
    if (styleBlock) parts.push(styleBlock);

    return parts.join('\n\n');
}

function reload() {
    _cache = null;
    loadAll();
}

module.exports = {
    loadAll,
    getStyle,
    getAllStyles,
    getStylePromptForCharacter,
    buildStylePromptBlock,
    buildStyleReviewBlock,
    buildCombinedPromptBlock,
    buildCombinedReviewBlock,
    reload
};
