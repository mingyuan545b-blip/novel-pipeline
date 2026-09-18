const store = require('../../../store');
const { getVolumeOrder } = require('../volumeHelpers');
const logger = require('../../../shared/logger');
const { MATERIAL_LIFECYCLE_POLICY } = require('../../../config/materialLifecyclePolicy');

const MATERIAL_LIFECYCLE = {
    permanent: new Set(['worldview', 'power-system', 'sub-plane', 'craft', 'writing-technique']),
    semiPermanent: new Set(['foreshadowing', 'relationship', 'growth-history']),
    ephemeral: new Set(['mechanism', 'location', 'catchphrase', 'famous-scene', 'index', 'other', 'narrative-bridge'])
};

function getMaterialLifecycle(m) {
    if (MATERIAL_LIFECYCLE.permanent.has(m.type)) return 'permanent';
    if (MATERIAL_LIFECYCLE.ephemeral.has(m.type)) return 'ephemeral';
    if (!m.parentPlane || m.parentPlane === '主世界') return 'permanent';
    if (m.type === 'character') return 'semiPermanent';
    if (m.type === 'faction') return 'semiPermanent';
    if (m.type === 'equipment' && m.name && m.name.includes('主角')) return 'semiPermanent';
    if (MATERIAL_LIFECYCLE.semiPermanent.has(m.type)) return 'semiPermanent';
    return 'ephemeral';
}

async function getCurrentVolumeSubplaneId(projectId, chapterNum) {
    try {
        const volOrder = await getVolumeOrder(projectId);
        const entry = volOrder.volumeOrder.find(v => {
            const match = v.chapters.match(/Ch(\d+)-(\d+)/);
            return match && chapterNum >= parseInt(match[1]) && chapterNum <= parseInt(match[2]);
        });
        return entry ? entry.subplaneId : null;
    } catch (e) {
        logger.warn('materialLifecycle', '读取volume-order失败:', { errorMessage: e.message });
        return null;
    }
}

/** 是否受保护（不归档）：锁定/主角定位/关键配角/最近N章出现过 —— 语义判定，禁止用名字字符串判断 */
function isProtectedMaterial(mat, chapterNum) {
    const cfg = MATERIAL_LIFECYCLE_POLICY;
    if (mat.isLocked || mat.isMainCharacter === true) return true;
    if (mat.roleLevel && cfg.protectedRoleLevels.includes(mat.roleLevel)) return true;
    const lastSeen = mat.lastAppearChapter;
    if (typeof lastSeen === 'number' && chapterNum - lastSeen <= cfg.recencyWindowChapters) return true;
    return false;
}

function archiveMaterials(materialsToArchive, chapterNum, reason) {
    for (const mat of materialsToArchive) {
        if (isProtectedMaterial(mat, chapterNum)) {
            logger.warn('materialLifecycle', `素材归档保护: "${mat.name}"（roleLevel=${mat.roleLevel || '-'} lastAppear=${mat.lastAppearChapter ?? '-'}）跳过归档`);
            continue;
        }
        store.setItem('materials', mat.id, {
            ...mat,
            archived: true,
            archivedReason: reason,
            archivedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
}

function cleanChapterMaterials(allMaterials, projectId, chapterNum) {
    const chapterMaterials = allMaterials.filter(m => m.projectId === projectId && m.sourceChapter === chapterNum && !m.archived);
    if (chapterMaterials.length > 0) {
        logger.info('materialLifecycle', `Deleting ${chapterMaterials.length} old materials from chapter ${chapterNum} before re-creating`);
        archiveMaterials(
            chapterMaterials,
            chapterNum,
            `章节${chapterNum}返修后素材重建（旧规则约束不一致）`
        );
    }
}

function getActiveMaterials(allMaterials, projectId, chapterNum, lockedSubplaneIds, lockedFactionIds) {
    return allMaterials.filter(m => {
        if (m.projectId !== projectId || m.archived || m.sourceChapter === chapterNum) return false;
        if (m.isLocked) return false;
        if (m.parentPlane && lockedSubplaneIds.includes(m.parentPlane)) return false;
        if (m.parentFaction && lockedFactionIds.includes(m.parentFaction)) return false;
        return true;
    });
}

function getMaterialSummary(activeMaterials, maxLines = 60, maxLength = 8000) {
    const lines = activeMaterials.map(m => {
        const ver = m.version || 1;
        const src = m.sourceChapter ? `[Ch${m.sourceChapter}]` : '[项目级]';
        return `[${m.type}]${src}${m.name}(v${ver}):${(m.currentContent || '').substring(0, 120)}`;
    });
    let summary = lines.join('\n');
    if (summary.length > maxLength) {
        summary = lines.slice(0, maxLines).join('\n') + `\n...还有${lines.length - maxLines}个素材未显示`;
    }
    return { summary, totalCount: lines.length };
}

function getArchiveHints(activeMaterials, chapterNum, currentVolumeSubplaneId) {
    const hints = [];
    const foreshadowings = activeMaterials.filter(m => m.type === 'foreshadowing');
    const characters = activeMaterials.filter(m => m.type === 'character');
    const equipments = activeMaterials.filter(m => m.type === 'equipment');

    if (foreshadowings.length > 0) {
        const details = foreshadowings.map(f => {
            const content = f.currentContent || f.initialContent || '';
            const isRecycled = content.includes('已回收') || content.includes('已揭示');
            return `  - ${f.name}: ${isRecycled ? '✅已回收' : '⏳未回收'}`;
        }).join('\n');
        hints.push(`\n【伏笔追踪${foreshadowings.length}个 - 必须逐个检查】\n${details}`);
        hints.push(`\n⚠️每个未回收伏笔必须在foreshadowTracking中报告状态（必须是数组，如[{"name":"伏笔名","status":"未回收","detail":"详情"}]）！`);
    }
    if (characters.length > 5) {
        hints.push(`\n【角色素材${characters.length}个】角色较多，检查是否有死亡/永久离场的角色`);
    }
    if (equipments.length > 3) {
        hints.push(`\n【装备素材${equipments.length}个】${equipments.map(e => e.name).join('、')} — 检查是否有被替代/不再使用的装备`);
    }
    return hints.join('');
}

function getLockedEntities(allMaterials, projectId) {
    const lockedSubplaneIds = allMaterials
        .filter(m => m.projectId === projectId && m.type === 'sub-plane' && m.isLocked)
        .map(m => m.id);

    const lockedFactionIds = allMaterials
        .filter(m => m.projectId === projectId && m.type === 'faction' && lockedSubplaneIds.includes(m.parentPlane))
        .map(m => m.id);

    return { lockedSubplaneIds, lockedFactionIds };
}

function getDynamicMaxMaterials(chapterNum, options = {}) {
    const min = options.minMaterials || 50;
    const max = options.maxMaterials || 120;
    const multiplier = options.multiplier || 4;
    const base = options.base || 20;
    return Math.min(max, Math.max(min, chapterNum * multiplier + base));
}

module.exports = {
    getMaterialLifecycle,
    isProtectedMaterial,
    getCurrentVolumeSubplaneId,
    cleanChapterMaterials,
    getActiveMaterials,
    getMaterialSummary,
    getArchiveHints,
    getLockedEntities,
    getDynamicMaxMaterials,
    MATERIAL_LIFECYCLE
};
