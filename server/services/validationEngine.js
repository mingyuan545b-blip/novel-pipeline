/**
 * validationEngine — 平台合规校验 + 技法可用性校验
 *
 * 2026-09-21：技法数据源由JSON文件改为 techIndex（PG表 library_techniques 的内存视图），
 *   统计元数据写回走 libraryStore.updateMeta（PG）。原来直接读写 data/library/*.json 的
 *   三处缓存逻辑已删除（那会导致与PG不一致）。
 * 文件位置：server/services/validationEngine.js
 */
const techIndex = require('./techIndex');
const libraryStore = require('./libraryStore');
const logger = require('../shared/logger');

const AUTO_DISABLE_MIN_ATTEMPTS = 5;
const AUTO_DISABLE_RATE = 20;

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
    }
};

class ValidationEngine {
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

    /** 技法是否可用于当前模式（数据源：techIndex 内存视图） */
    validateTechnique(techId, mode) {
        const leaf = techIndex.getTechnique(techId);
        if (!leaf) return { valid: false, error: `技法 ${techId} 不存在` };
        if (leaf.auto_disabled) return { valid: false, error: `技法 ${techId} 已被自动禁用（成功率过低）` };
        const modes = leaf.applicable_modes || [];
        if (mode && !modes.includes(mode)) {
            return { valid: false, error: `技法 ${techId} 不适用于模式 ${mode}（适用: ${modes.join(',')}）` };
        }
        return { valid: true, entry: leaf, meta: { success_rate: leaf.success_rate, attempts: leaf.attempts, auto_disabled: leaf.auto_disabled } };
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

        // tomato-short platform rules removed - all projects use novel mode

        return { valid: errors.length === 0, errors, warnings, wordCount, dialogueRatio };
    }

    /** 记录技法使用结果并回写PG（成功率滑动平均；连续低效自动禁用） */
    async recordTechniqueResult(techId, success) {
        const leaf = techIndex.getTechnique(techId);
        if (!leaf) { logger.warn('validationEngine', `recordTechniqueResult: 技法不存在 ${techId}`); return null; }
        const attempts = (leaf.attempts || 0) + 1;
        const prevRate = leaf.success_rate ?? 50;
        const meta = {
            attempts,
            success_rate: Math.round((prevRate * (attempts - 1) + (success ? 100 : 0)) / attempts),
        };
        meta.auto_disabled = attempts >= AUTO_DISABLE_MIN_ATTEMPTS && meta.success_rate < AUTO_DISABLE_RATE;
        const saved = await libraryStore.updateMeta(techId, meta);
        if (saved) await techIndex.reload();
        return meta;
    }

    /**
     * 批量记录技法使用结果（审核步骤后一次回写，仅 reload 一次）。
     *
     * A4 修复（docs/worklog/2026-10-17-假成果审查-问题统计.md F4）：
     * recordTechniqueResult 此前全仓 0 调用点 → 224 技法中 209 条 attempts=0、"自动禁用"名存实亡。
     * 由 pipeline 审核反馈路径（techniqueContextHelpers.recordReviewFeedback）调用本方法回写真实结果。
     * @param {string[]} techIds
     * @param {boolean} success
     * @returns {Promise<number>} 实际更新条数
     */
    async recordTechniqueResults(techIds, success) {
        if (!Array.isArray(techIds) || techIds.length === 0) return 0;
        let updated = 0;
        for (const techId of techIds) {
            const leaf = techIndex.getTechnique(techId);
            if (!leaf) continue;
            const attempts = (leaf.attempts || 0) + 1;
            const prevRate = leaf.success_rate ?? 50;
            const meta = {
                attempts,
                success_rate: Math.round((prevRate * (attempts - 1) + (success ? 100 : 0)) / attempts),
            };
            meta.auto_disabled = attempts >= AUTO_DISABLE_MIN_ATTEMPTS && meta.success_rate < AUTO_DISABLE_RATE;
            const saved = await libraryStore.updateMeta(techId, meta);
            if (saved) updated++;
        }
        if (updated > 0) await techIndex.reload();
        return updated;
    }

    getEnabledTechniques(mode, injectionPoint) {
        return techIndex.getAll().filter(t => {
            if (mode && !(t.applicable_modes || []).includes(mode)) return false;
            if (injectionPoint && t.injection_point !== injectionPoint) return false;
            return !t.auto_disabled;
        });
    }

    getValidationReport(projectId, mode, platform) {
        const all = techIndex.getAll();
        return {
            totalTechniques: all.length,
            enabledForMode: this.getEnabledTechniques(mode).length,
            disabledCount: all.filter(t => t.auto_disabled).length,
            platform: platform ? PLATFORM_RULES[platform]?.name || platform : 'N/A',
            mode: mode || 'N/A'
        };
    }
}

module.exports = { ValidationEngine, PLATFORM_RULES };
