/**
 * materialInjector.js — 统一素材注入层
 * 将调度器返回的素材统一格式化注入到Agent的user prompt
 * 消除7个Agent文件中重复的素材拼装逻辑，确保所有Agent使用统一的素材格式
 *
 * 设计原则：
 * 1. 所有Agent通过此模块注入素材，不再自己拼装
 * 2. 素材格式统一：所有素材都包含name/type/content/roleLevel/position等字段
 * 3. 预算控制：按素材类型分配预算，防止token爆炸
 * 4. 可扩展：新增素材类型只需在 sectionBuilders.js 添加buildXxxSection函数并注册
 *
 * 构建函数实现见 sectionBuilders.js
 */
'use strict';

const logger = require('../../shared/logger');
const builders = require('./sectionBuilders');
const { getMaterialDifferences } = require('./agentDeclarations');

/** 素材段构建器注册表：type → buildSection函数
 *  注意：character段不在此注册，因为character段的处理方式因Agent而异：
 *  - writer: writerCharacterFormatter.buildCharacterSection（含限知）
 *  - reviser: buildCharacterSection（简化版，name+role+content）
 *  - finalEditor/polisher: buildCharacterBriefSection（简表版，只有name+role）
 *  - reader: buildCharacterReaderSection（极简版，name:content）
 *  character段由Agent单独调用对应函数处理（通过buildCharacterByFormat统一分发）
 */
const SECTION_BUILDERS = {
    'worldview':          builders.buildWorldviewSection,
    'power-system':       builders.buildPowerSystemSection,
    'sub-plane':          builders.buildSubPlaneSection,
    'faction':            builders.buildFactionSection,
    'equipment':          builders.buildEquipmentSection,
    'location':           builders.buildLocationSection,
    'foreshadowing':      builders.buildForeshadowSection,
    'catchphrase':        builders.buildCatchphraseSection,
    'famous-scene':       builders.buildFamousSceneSection,
    'writing-technique':  builders.buildTechniqueSection,
    'institution':        builders.buildInstitutionSection,
    'character-combat':   builders.buildCharacterCombatSection,
    'growth-history':     builders.buildGrowthHistorySection,
    'relationship':       builders.buildRelationshipSection,
    // 注意：knowledge-access不注册，由审核员Agent单独调用buildKnowledgeAccessSection
    // 原因：knowledge-access是审核员专属，不应被其他Agent自动注入
};

/** 角色段格式分发器：根据声明的characterFormat选择对应构建函数
 *  @param {Array} scheduledChars - 调度器返回的角色素材
 *  @param {string} agentType - Agent类型（用于查询声明）
 *  @param {string} label - simple格式的标题依据标签
 *  @returns {string} 角色段文本，'none'格式返回空字符串
 */
function buildCharacterByFormat(scheduledChars, agentType, label) {
    const { characterFormat } = getMaterialDifferences(agentType);
    switch (characterFormat) {
        case 'full':
            // full格式由writer专用formatter处理，不通过此函数
            return '';
        case 'brief':
            return builders.buildCharacterSection(scheduledChars);
        case 'simple':
            return builders.buildCharacterBriefSection(scheduledChars, label);
        case 'reader':
            return builders.buildCharacterReaderSection(scheduledChars);
        case 'review':
            return builders.buildCharacterReviewSection(scheduledChars);
        case 'none':
        default:
            return '';
    }
}

/**
 * 主入口：将调度器返回的素材注入到agentContext.content
 * @param {Object} scheduled - scheduleMaterials返回的结果
 * @param {Object} agentContext - Agent上下文，会被修改content字段
 * @param {Object} options - 注入选项
 * @param {string} options.agentType - Agent类型（用于查询声明的差异配置）
 * @param {number} options.totalBudget - 总预算（字符数）
 * @param {string} options.foreshadowFilter - 伏笔过滤模式覆盖（'all'|'active'|'none'），不传则从声明读取
 * @param {boolean} options.isInSubplane - 是否在小世界场景
 * @param {string} options.currentSubplaneId - 当前小世界ID
 * @param {string} options.chapterScene - 当前章节场景
 * @returns {Object} 注入统计 { sectionsInjected, budgetUsed }
 */
function injectMaterials(scheduled, agentContext, options = {}) {
    const { agentType = 'unknown', totalBudget = 8000 } = options;
    const materials = scheduled?.materials || {};

    // 从声明读取差异配置（foreshadowFilter优先用options覆盖，其次用声明）
    const { foreshadowFilter: declaredFilter, materialSections } = getMaterialDifferences(agentType);
    const foreshadowFilter = options.foreshadowFilter || declaredFilter;

    let budgetUsed = 0;
    let sectionsInjected = 0;
    let injectedText = '';

    const appendSection = (text) => {
        if (!text) return false;
        if (budgetUsed + text.length > totalBudget) {
            const remaining = totalBudget - budgetUsed;
            if (remaining > 100) {
                injectedText += text.substring(0, remaining) + '\n[素材注入已达预算上限]\n';
                budgetUsed = totalBudget;
            }
            return false;
        }
        injectedText += text;
        budgetUsed += text.length;
        return true;
    };

    // materialSections=false时只注入character段（由Agent单独调用），不注入其余素材段
    if (!materialSections) {
        return { sectionsInjected: 0, budgetUsed: 0 };
    }

    // 按声明顺序注入（worldview优先，character/knowledge-access由Agent单独处理）
    for (const [type, items] of Object.entries(materials)) {
        if (type === 'character' || type === 'knowledge-access') continue;
        if (!items || items.length === 0) continue;

        // foreshadowFilter='none'时跳过伏笔段
        if (type === 'foreshadowing' && foreshadowFilter === 'none') continue;

        const builder = SECTION_BUILDERS[type];
        if (!builder) {
            logger.warn('materialInjector', `No section builder for material type: ${type}`);
            continue;
        }

        // sub-plane需要allMaterials来构建嵌套关系；foreshadowing需要foreshadowFilter
        const sectionOpts = type === 'sub-plane'
            ? { ...options, allMaterials: materials }
            : type === 'foreshadowing'
                ? { ...options, foreshadowFilter }
                : options;
        const section = builder(items, sectionOpts);
        if (section && appendSection(section)) sectionsInjected++;
    }

    if (injectedText) {
        agentContext.content = (agentContext.content || '') + injectedText;
    }

    return { sectionsInjected, budgetUsed };
}

module.exports = {
    injectMaterials,
    SECTION_BUILDERS,
    buildCharacterByFormat,
    buildCharacterSection: builders.buildCharacterSection,
    buildCharacterBriefSection: builders.buildCharacterBriefSection,
    buildCharacterReaderSection: builders.buildCharacterReaderSection,
    buildCharacterReviewSection: builders.buildCharacterReviewSection,
    buildKnowledgeAccessSection: builders.buildKnowledgeAccessSection,
};
