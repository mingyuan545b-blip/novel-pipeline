const fs = require('fs');
const path = require('path');
const logger = require('../shared/logger');

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
                logger.info('speechStyle', `File change detected (${filename}), reloading...`);
                _cache = null;
            }, 500);
        });
        _watcher.on('error', () => {});
    } catch(_) { logger.warn('speechStyle', _.message || _); }  // DEGRADE: 影响=fs.watch 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
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
                logger.warn('speechStyle', `加载风格文件失败: ${file}`, { errorMessage: e.message });
            }
        }
        logger.info('speechStyle', `已加载 ${Object.keys(_cache).length} 个说话风格: ${Object.keys(_cache).join(', ')}`);
    } catch (e) {
        logger.warn('speechStyle', '风格目录不存在或无法读取:', { errorMessage: e.message });
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

function reload() {
    _cache = null;
    loadAll();
}

module.exports = {
    loadAll,
    getStyle,
    getAllStyles,
    getStylePromptForCharacter,
    reload
};
