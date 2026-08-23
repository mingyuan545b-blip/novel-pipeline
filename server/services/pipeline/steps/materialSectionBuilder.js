/**
 * @deprecated 此模块已废弃，所有构建函数已迁移到 materialInjector.js
 * 生产代码应使用 materialInjector 的 injectMaterials / buildCharacterSection / buildCharacterBriefSection
 * 保留此文件仅为兼容性，新增代码禁止引用此模块
 *
 * 迁移映射：
 * - buildCharacterSection        → materialInjector.buildCharacterSection
 * - buildCharacterBriefSection   → materialInjector.buildCharacterBriefSection
 * - buildRelationshipSection     → materialInjector.SECTION_BUILDERS['relationship']
 * - buildWorldviewSection        → materialInjector.SECTION_BUILDERS['worldview']
 * - buildForeshadowSection       → materialInjector.SECTION_BUILDERS['foreshadowing']（支持 foreshadowFilter='all'）
 * - buildFamousSceneSection      → materialInjector.SECTION_BUILDERS['famous-scene']
 * - buildCatchphraseSection      → materialInjector.SECTION_BUILDERS['catchphrase']
 * - buildTechniqueSection        → materialInjector.SECTION_BUILDERS['writing-technique']
 *
 * @see server/services/pipeline/materialInjector.js
 */
/**
 * materialSectionBuilder.js — 素材段构建辅助函数（已废弃）
 * 将scheduleMaterials返回的数据格式化为prompt可用的文本段
 */
function buildCharacterSection(scheduledChars) {
    if (!scheduledChars || scheduledChars.length === 0) return '';
    const charLines = scheduledChars.map(cs => {
        const role = cs.roleLevel === 'protagonist' ? '主角' : (cs.roleLevel === 'supporting' ? '配角' : 'NPC');
        let line = `- "${cs.name}"(${role})`;
        if (cs.content) line += `: ${cs.content.substring(0, 200)}`;
        return line;
    });
    return `\n\n【角色设定（修改时必须遵守）】\n${charLines.join('\n')}`;
}

function buildRelationshipSection(scheduledRelationships) {
    if (!scheduledRelationships || scheduledRelationships.length === 0) return '';
    const relLines = scheduledRelationships.map(r => `- ${r.name}: ${(r.content || '').substring(0, 150)}`);
    return `\n\n【角色关系（修改时必须遵守）】\n${relLines.join('\n')}`;
}

function buildWorldviewSection(scheduledWorldview) {
    if (!scheduledWorldview || scheduledWorldview.length === 0) return '';
    return `\n\n【世界观设定（修改时必须遵守）】\n${scheduledWorldview.map(w => `- ${w.name}: ${(w.content || '').substring(0, 200)}`).join('\n')}`;
}

function buildForeshadowSection(scheduledForeshadowing) {
    if (!scheduledForeshadowing || scheduledForeshadowing.length === 0) return '';
    return `\n\n【伏笔状态（修改时注意保持一致）】\n${scheduledForeshadowing.map(f => `- "${f.name}"（状态：未回收）`).join('\n')}`;
}

function buildFamousSceneSection(scheduledFamousScene) {
    if (!scheduledFamousScene || scheduledFamousScene.length === 0) return '';
    return `\n\n【名场面参考（修改时保持风格一致）】\n${scheduledFamousScene.map(s => `- ${s.name}: ${(s.content || '').substring(0, 100)}`).join('\n')}`;
}

function buildCatchphraseSection(scheduledCatchphrase) {
    if (!scheduledCatchphrase || scheduledCatchphrase.length === 0) return '';
    return `\n\n【经典台词（优先使用已有台词）】\n${scheduledCatchphrase.map(c => `- ${c.name}: ${(c.content || '').substring(0, 100)}`).join('\n')}`;
}

function buildTechniqueSection(scheduledTechnique) {
    if (!scheduledTechnique || scheduledTechnique.length === 0) return '';
    return `\n\n【写作技法提示】\n${scheduledTechnique.map(t => `- ${(t.content || '').substring(0, 100)}`).join('\n')}`;
}

/** 构建审核用角色简表（只有名字和角色级别） */
function buildCharacterBriefSection(scheduledChars, label) {
    if (!scheduledChars || scheduledChars.length === 0) return '';
    const charLines = scheduledChars.map(cs => {
        const role = cs.roleLevel === 'protagonist' ? '主角' : (cs.roleLevel === 'supporting' ? '配角' : 'NPC');
        return `- "${cs.name}"(${role})`;
    });
    return `\n\n【角色状态（${label}依据）】\n${charLines.join('\n')}`;
}

module.exports = {
    buildCharacterSection,
    buildRelationshipSection,
    buildWorldviewSection,
    buildForeshadowSection,
    buildFamousSceneSection,
    buildCatchphraseSection,
    buildTechniqueSection,
    buildCharacterBriefSection,
};
