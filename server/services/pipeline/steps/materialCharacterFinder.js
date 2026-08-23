/**
 * materialCharacterFinder.js — 角色素材查找（自 materialCharacterProcessor.js 提取，行为不变）
 * 注：陷阱#79的entityCenter fallback待生产端修复后移除（见陷阱清单原则1已知违反项）
 */

function findCharacterMaterial(projectId, materials, name) {
    const exact = materials.find(m =>
        m.projectId === projectId &&
        m.type === 'character' &&
        !m.archived &&
        m.name === name
    );
    if (exact) return exact;

    if (name) {
        const normalizedName = name.toLowerCase().replace(/[\s\-_··]/g, '');
        return materials.find(m => {
            if (m.projectId !== projectId || m.type !== 'character' || m.archived) return false;
            const mName = (m.name || '').toLowerCase().replace(/[\s\-_··]/g, '');
            return mName === normalizedName || mName.includes(normalizedName) || normalizedName.includes(mName);
        });
    }
    return null;
}

module.exports = { findCharacterMaterial };
