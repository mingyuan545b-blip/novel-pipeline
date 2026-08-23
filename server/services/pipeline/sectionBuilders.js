/**
 * sectionBuilders.js — 素材段构建函数集合（非角色类）
 * 所有将调度器返回的素材格式化为prompt文本段的构建函数
 * 被 materialInjector.js 的 SECTION_BUILDERS 注册表和 Agent 直接使用
 *
 * 角色相关构建函数见 characterSectionBuilders.js
 *
 * 设计原则：
 * 1. 每个函数接收 (items, options) 签名，返回字符串
 * 2. 空素材返回空字符串
 * 3. 差异通过 options 传递（如 foreshadowFilter='all'）
 */
'use strict';

const characterBuilders = require('./characterSectionBuilders');

// ============ 核心设定类 ============

function buildWorldviewSection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【⚠️ 核心设定 - 必须严格遵守，违反即退回】\n';
    for (const m of items) {
        section += `--- ${m.name} ---\n${m.content || ''}\n\n`;
    }
    return section;
}

function buildPowerSystemSection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【力量体系】\n';
    for (const m of items) {
        section += `▸ ${m.name}: ${m.content || ''}\n`;
    }
    return section;
}

function buildSubPlaneSection(items, options = {}) {
    if (!items || items.length === 0) return '';
    const { isInSubplane = false, currentSubplaneId = null, allMaterials = {} } = options;
    let section = '';

    const relevant = isInSubplane
        ? items.filter(sp => sp.parentPlane === currentSubplaneId || (sp.name && options.chapterScene?.includes(sp.name)))
        : items.filter(sp => !sp.parentPlane || sp.parentPlane === currentSubplaneId);

    if (isInSubplane && relevant.length > 0) {
        section = '\n\n【当前小世界 - 本章场景】\n';
        for (const sp of relevant) {
            section += `▸ ${sp.name}: ${sp.content || ''}\n`;
            const factions = (allMaterials.faction || []).filter(f => f.parentPlane === sp.name);
            for (const fac of factions) {
                section += `  └ ${fac.name}: ${fac.content || ''}\n`;
            }
            const mechanisms = (allMaterials.mechanism || []).filter(m => m.parentPlane === sp.name);
            for (const mech of mechanisms) {
                section += `  └ 规则·${mech.name}: ${mech.content || ''}\n`;
            }
            const equipInPlane = (allMaterials.equipment || []).filter(e => e.parentPlane === sp.name);
            if (equipInPlane.length > 0) {
                section += `  └ 可获取道具: ${equipInPlane.map(e => e.name).join('、')}\n`;
            }
        }
    } else if (relevant.length > 0) {
        section = '\n\n【当前卷小世界概要 - 仅参考，本章在主世界】\n';
        for (const sp of relevant) {
            section += `▸ ${sp.name}: ${sp.content || ''}\n`;
        }
    }
    return section;
}

function buildFactionSection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【势力阵营】\n';
    for (const f of items) {
        section += `▸ ${f.name}: ${f.content || ''}\n`;
    }
    return section;
}

function buildEquipmentSection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【本章相关装备/道具】\n';
    for (const e of items) {
        section += `${e.name}: ${e.content || ''}\n`;
    }
    return section;
}

function buildLocationSection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【本章相关地点】\n';
    for (const l of items) {
        section += `${l.name}: ${l.content || ''}\n`;
    }
    return section;
}

// ============ 伏笔与场景类 ============

function buildForeshadowSection(items, options = {}) {
    if (!items || items.length === 0) return '';

    // 审核员全量模式：显示所有伏笔及其真实状态（finalEditor/review用）
    // 使用archived字段判断状态（结构化字段，取代字符串匹配）
    // 修复旧bug：原reviewShared.js所有伏笔都硬编码"状态：未回收"
    // 修复Phase 3引新bug：原用content字符串匹配判断状态，现改用archived字段
    if (options.foreshadowFilter === 'all') {
        let section = '\n\n【素材库·伏笔状态（审核依据——检查正文是否与伏笔设定一致）】\n';
        for (const f of items) {
            const status = f.archived ? '已回收' : '未回收';
            section += `- "${f.name}"（状态：${status}）\n`;
        }
        section += '如果本章正文涉及以上伏笔的回收/推进，确认正文与伏笔设定一致即可。';
        return section;
    }

    // 默认模式：只显示未回收的伏笔（执笔用）
    // 使用archived字段过滤（结构化判断，取代字符串匹配）
    const pending = items.filter(m => !m.archived);
    if (pending.length === 0) return '';
    let section = '\n\n【未回收伏笔提醒 - 优先推进】\n';
    for (const fm of pending) {
        section += `▸ ${fm.name}: ${fm.content || ''}\n`;
    }
    return section;
}

function buildCatchphraseSection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【经典台词参考 - 优先使用已有台词】\n';
    for (const c of items) {
        section += `${c.name}: ${c.content || ''}\n`;
    }
    return section;
}

function buildFamousSceneSection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【关键名场面参考】\n';
    for (const s of items) {
        section += `${s.name}: ${s.content || ''}\n`;
    }
    return section;
}

function buildTechniqueSection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【写作技法参考】\n';
    for (const t of items) {
        section += `▸ ${t.name}: ${t.content || ''}\n`;
    }
    return section;
}

function buildInstitutionSection(items) {
    if (!items || items.length === 0) return '';
    let section = '\n\n【组织机构】\n';
    for (const i of items) {
        section += `▸ ${i.name}: ${i.content || ''}\n`;
    }
    return section;
}

module.exports = {
    buildWorldviewSection,
    buildPowerSystemSection,
    buildSubPlaneSection,
    buildFactionSection,
    buildEquipmentSection,
    buildLocationSection,
    buildForeshadowSection,
    buildCatchphraseSection,
    buildFamousSceneSection,
    buildTechniqueSection,
    buildInstitutionSection,
    // 角色相关函数从characterSectionBuilders.js透传
    buildCharacterCombatSection: characterBuilders.buildCharacterCombatSection,
    buildGrowthHistorySection: characterBuilders.buildGrowthHistorySection,
    buildRelationshipSection: characterBuilders.buildRelationshipSection,
    buildCharacterSection: characterBuilders.buildCharacterSection,
    buildCharacterBriefSection: characterBuilders.buildCharacterBriefSection,
    buildCharacterReaderSection: characterBuilders.buildCharacterReaderSection,
    buildCharacterReviewSection: characterBuilders.buildCharacterReviewSection,
    buildKnowledgeAccessSection: characterBuilders.buildKnowledgeAccessSection,
};
