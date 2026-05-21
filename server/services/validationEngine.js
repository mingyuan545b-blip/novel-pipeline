const fs = require('fs');
const path = require('path');

const LIBRARY_DIR = path.join(__dirname, '..', 'data', 'library');

const PLATFORM_RULES = {
    fanqie: {
        name: '番茄小说',
        minWords: 800,
        maxWords: 3500,
        dialogueRatioMax: 0.4,
        bannedPatterns: [/第[零一二三四五六七八九十百千万\d]+章.*第[零一二三四五六七八九十百千万\d]+章/],
        requiredElements: ['chapter_title', 'content_body']
    },
    qimao: {
        name: '七猫小说',
        minWords: 1000,
        maxWords: 50000,
        dialogueRatioMax: 0.5,
        bannedPatterns: [],
        requiredElements: ['chapter_title', 'content_body']
    },
    'tomato-short': {
        name: '番茄短篇',
        minWords: 1850,
        maxWords: 2150,
        dialogueRatioMax: 0.28,
        bannedPatterns: [/第[零一二三四五六七八九十百千万\d]+章/],
        readerTriggers: [7, 14],
        requiredElements: ['chapter_title', 'content_body', 'reader_trigger']
    }
};

class ValidationEngine {
    constructor() {
        this._indexCache = null;
        this._metaCache = null;
    }

    _loadIndex() {
        if (this._indexCache) return this._indexCache;
        const idxPath = path.join(LIBRARY_DIR, 'index.json');
        if (!fs.existsSync(idxPath)) return { entries: [], total_entries: 0 };
        this._indexCache = JSON.parse(fs.readFileSync(idxPath, 'utf-8').replace(/^\uFEFF/, ''));
        return this._indexCache;
    }

    _loadMeta(techId) {
        const metaPath = path.join(LIBRARY_DIR, 'metadata', `${techId}.json`);
        if (!fs.existsSync(metaPath)) return { id: techId, success_rate: 50, attempts: 0, auto_disabled: false };
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8').replace(/^\uFEFF/, ''));
    }

    _saveMeta(techId, meta) {
        const metaDir = path.join(LIBRARY_DIR, 'metadata');
        if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
        fs.writeFileSync(path.join(metaDir, `${techId}.json`), JSON.stringify(meta, null, 2), 'utf-8');
    }

    validateCharacter(characterData) {
        const errors = [];
        const warnings = [];

        if (!characterData.name) errors.push('人物缺少name字段');
        if (!characterData.currentContent && !characterData.initialContent) errors.push('人物缺少内容');

        const content = characterData.currentContent || characterData.initialContent || '';
        if (!/核心欲望|内心渴望|最想|终极目标|最大愿望/.test(content)) warnings.push('缺少核心欲望');
        if (!/内在矛盾|内心冲突|两难|矛盾|挣扎|纠结/.test(content)) warnings.push('缺少内在矛盾');
        if (!/行为模式|行事风格|习惯|性格特点|行为特征|处事方式/.test(content)) warnings.push('缺少行为模式');

        return { valid: errors.length === 0, errors, warnings };
    }

    validateTechnique(techId, mode) {
        const index = this._loadIndex();
        const entry = index.entries.find(e => e.id === techId);
        if (!entry) return { valid: false, error: `技法 ${techId} 不存在于索引中` };

        const meta = this._loadMeta(techId);
        if (meta.auto_disabled) return { valid: false, error: `技法 ${techId} 已被自动禁用（成功率过低）` };

        if (mode && !entry.modes.includes(mode)) {
            return { valid: false, error: `技法 ${techId} 不适用于模式 ${mode}（适用: ${entry.modes.join(',')}）` };
        }

        return { valid: true, entry, meta };
    }

    validatePlatformCompliance(content, platform) {
        const rules = PLATFORM_RULES[platform];
        if (!rules) return { valid: true, errors: [], warnings: [] };

        const errors = [];
        const warnings = [];
        const wordCount = (content || '').replace(/\s/g, '').length;

        if (wordCount < rules.minWords) errors.push(`字数不足: ${wordCount} < ${rules.minWords}`);
        if (wordCount > rules.maxWords) errors.push(`字数超标: ${wordCount} > ${rules.maxWords}`);

        const dialogueCount = (content.match(/["「"''].+?["」"'']/g) || []).length;
        const dialogueRatio = wordCount > 0 ? dialogueCount * 10 / wordCount : 0;
        if (dialogueRatio > rules.dialogueRatioMax) warnings.push(`对话占比过高: ${(dialogueRatio * 100).toFixed(1)}% > ${(rules.dialogueRatioMax * 100).toFixed(0)}%`);

        for (const pattern of rules.bannedPatterns) {
            if (pattern.test(content)) errors.push(`包含禁止模式: ${pattern.source}`);
        }

        if (platform === 'tomato-short' && rules.readerTriggers) {
            const hasTrigger = /爽点|高潮|反转|悬念|钩子/.test(content);
            if (!hasTrigger) warnings.push('番茄短篇建议包含读者触发点');
        }

        return { valid: errors.length === 0, errors, warnings, wordCount, dialogueRatio };
    }

    recordTechniqueResult(techId, success) {
        const meta = this._loadMeta(techId);
        meta.attempts = (meta.attempts || 0) + 1;
        if (success) {
            meta.success_rate = Math.round(((meta.success_rate || 50) * (meta.attempts - 1) + 100) / meta.attempts);
        } else {
            meta.success_rate = Math.round(((meta.success_rate || 50) * (meta.attempts - 1) + 0) / meta.attempts);
        }
        if (meta.attempts >= 5 && meta.success_rate < 20) {
            meta.auto_disabled = true;
        }
        this._saveMeta(techId, meta);
        return meta;
    }

    getEnabledTechniques(mode, injectionPoint) {
        const index = this._loadIndex();
        return index.entries.filter(e => {
            if (mode && !e.modes.includes(mode)) return false;
            if (injectionPoint && e.injection_point !== injectionPoint) return false;
            const meta = this._loadMeta(e.id);
            return !meta.auto_disabled;
        });
    }

    getValidationReport(projectId, mode, platform) {
        const index = this._loadIndex();
        const enabled = this.getEnabledTechniques(mode);
        const disabled = index.entries.filter(e => {
            const meta = this._loadMeta(e.id);
            return meta.auto_disabled;
        });
        return {
            totalTechniques: index.total_entries,
            enabledForMode: enabled.length,
            disabledCount: disabled.length,
            platform: platform ? PLATFORM_RULES[platform]?.name || platform : 'N/A',
            mode: mode || 'N/A'
        };
    }
}

module.exports = { ValidationEngine, PLATFORM_RULES };
