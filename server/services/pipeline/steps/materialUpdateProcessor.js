const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const store = require('../../../store');
const { getVolumeOrder } = require('../volumeHelpers');
const { getMetrics } = require('../../metricsCollector');
const { validateMaterial } = require('../../materialValidator');
const { validateNewMaterial } = require('../../genreConfig');
const { resolveParentPlane, resolveParentFaction } = require('../../materialIntegrity');

const INTENSITY_MAP = { '轻度': 'light', '中度': 'medium', '重度': 'heavy', 'light': 'light', 'medium': 'medium', 'heavy': 'heavy' };

function parseFlavorTag(content, tagPattern) {
    const match = content.match(tagPattern);
    if (!match) return null;
    return { value: match[1].trim(), intensity: INTENSITY_MAP[match[2]] || 'medium' };
}

const FIELD_TRANSLATIONS = {
    identity: '身份', coreDesire: '核心欲望', internalConflict: '内在矛盾',
    behaviorPattern: '行为模式', relationToProtagonist: '与主角关系',
    acquisition: '获取方式', limitation: '限制', cost: '代价',
    structure: '结构', trigger: '触发条件', status: '当前状态',
    window: '预期回收窗口', character: '关联角色', clue: '线索',
    updateNote: '更新说明', observation: '观察记录', attitude: '态度',
    physicalState: '身体状态', combatTactic: '战斗战术', currentGoal: '当前目标',
    expectedRecoveryWindow: '预期回收窗口', relatedCharacters: '关联角色',
    currentStatus: '当前状态', notes: '备注', currentState: '当前状态',
    name: '名称', function: '功能', associatedCharacter: '关联角色',
    recoveryDetail: '回收详情', abilityUpdate: '能力更新',
    behaviorPatternUpdate: '行为模式更新'
};

const KNOWN_FIELDS = new Set(['type', 'name', 'action', 'content', 'reason', 'parentFaction', 'parentPlane', 'id', 'linkedNames', 'tags', 'version', 'description', 'fields']);

function ensureOutputDir(projectId, subDir) {
    const outputBase = path.join(process.cwd(), 'output', projectId);
    const dir = path.join(outputBase, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function normalizeReferences(update, projectId, materials) {
    if (update.parentPlane) {
        const planeResult = resolveParentPlane(update.parentPlane, projectId);
        if (planeResult.resolved && planeResult.method !== 'direct-id') {
            console.log(`[PIPELINE] update.parentPlane引用标准化: "${update.parentPlane}" → "${planeResult.resolved}"(${planeResult.name})`);
            update.parentPlane = planeResult.resolved;
        } else if (planeResult.method === 'unresolved') {
            console.warn(`[PIPELINE] update.parentPlane引用无法解析: "${update.parentPlane}"，清空`);
            update.parentPlane = null;
        }
    }
    if (update.parentFaction) {
        const factionResult = resolveParentFaction(update.parentFaction, projectId);
        if (factionResult.resolved && factionResult.method !== 'direct-id') {
            console.log(`[PIPELINE] update.parentFaction引用标准化: "${update.parentFaction}" → "${factionResult.resolved}"(${factionResult.name})`);
            update.parentFaction = factionResult.resolved;
        } else if (factionResult.method === 'unresolved') {
            console.warn(`[PIPELINE] update.parentFaction引用无法解析: "${update.parentFaction}"，清空`);
            update.parentFaction = null;
        }
    }
}

function findExistingMaterial(update, projectId, materials) {
    let existing = materials.find(m =>
        m.projectId === projectId &&
        !m.archived &&
        m.type === update.type &&
        m.name === update.name
    );

    if (!existing) {
        existing = materials.find(m =>
            m.projectId === projectId &&
            m.type === update.type &&
            m.name === update.name
        );
        if (existing && existing.archived) existing = null;
    }

    if (!existing && update.id) {
        existing = materials.find(m => m.id === update.id || m.id.endsWith(update.id));
    }

    if (!existing && update.name) {
        const updateNameLower = update.name.toLowerCase().replace(/[\s\-_·]/g, '');
        existing = materials.find(m => {
            if (m.projectId !== projectId || m.archived || m.type !== update.type) return false;
            const mNameLower = m.name.toLowerCase().replace(/[\s\-_·]/g, '');
            return mNameLower.includes(updateNameLower) || updateNameLower.includes(mNameLower);
        });
    }

    if (!existing && update.name) {
        const updateNameLower = update.name.toLowerCase().replace(/[\s\-_·]/g, '');
        existing = materials.find(m => {
            if (m.projectId !== projectId || m.archived) return false;
            const mNameLower = m.name.toLowerCase().replace(/[\s\-_·]/g, '');
            if (updateNameLower.length >= 2 && mNameLower.includes(updateNameLower)) {
                console.log(`[PIPELINE] 素材跨类型模糊匹配: "${update.name}"(${update.type}) -> "${m.name}"(${m.type})`);
                return true;
            }
            return false;
        });
    }

    return existing;
}

function determineAction(update, existing) {
    if (!update.action) {
        update.action = existing ? 'update' : 'create';
    } else if (update.action === 'create' && existing) {
        console.log(`[PIPELINE] 素材去重: "${update.name}"(${update.type})已存在(id=${existing.id})，强制create→update`);
        update.action = 'update';
    }
    return update.action;
}

function injectPlaneForCreate(update, chapter, projectId, styleProfile, materials) {
    if (update.action !== 'create' || update.parentPlane) return;

    try {
        const chNum = chapter.chapterNumber || 1;
        const volumeOrder = getVolumeOrder(projectId);
        const currentVolume = volumeOrder.volumeOrder.find(v => {
            const match = v.chapters.match(/Ch(\d+)-(\d+)/);
            if (match) return chNum >= parseInt(match[1]) && chNum <= parseInt(match[2]);
            return false;
        });

        if (currentVolume && !['worldview', 'power-system', 'craft', 'index'].includes(update.type)) {
            const protagonistName = styleProfile?.protagonistName || '';
            const isMainWorldChar = update.name && (update.name.includes('主角') || (protagonistName && update.name.includes(protagonistName)));
            const isMainWorldEquip = update.type === 'equipment' && existing && !existing.parentPlane;

            if (!isMainWorldChar && !isMainWorldEquip) {
                update.parentPlane = currentVolume.subplaneId;
                console.log(`[PIPELINE] 素材归属自动注入: "${update.name}" -> parentPlane=${currentVolume.subplaneId} (${currentVolume.subplaneName})`);
            } else if (isMainWorldChar && currentVolume.subplaneId) {
                update.currentPlaneId = currentVolume.subplaneId;
                console.log(`[PIPELINE] 主角穿越标记: "${update.name}" parentPlane=null, currentPlaneId=${currentVolume.subplaneId} (${currentVolume.subplaneName})`);
            }
        }
    } catch (_) { console.warn('[SILENT-CATCH]', _.message || _); }
}

function injectFactionForCharacter(update, projectId, materials) {
    if (update.action !== 'create' || !update.parentPlane || update.parentFaction || update.type !== 'character') return;

    const planeFactions = materials.filter(m => m.type === 'faction' && m.parentPlane === update.parentPlane && !m.archived);
    if (planeFactions.length > 0) {
        update.parentFaction = planeFactions[0].id;
        console.log(`[PIPELINE] 素材势力自动注入: "${update.name}" -> parentFaction=${planeFactions[0].name}(${planeFactions[0].id})`);
    }
}

function normalizeContent(update) {
    if (!update.content && update.description) {
        update.content = typeof update.description === 'string' ? update.description : Object.entries(update.description).map(([k, v]) => `【${FIELD_TRANSLATIONS[k] || k}】${v}`).join('\n');
        delete update.description;
    }

    if (!update.content && update.fields) {
        if (typeof update.fields === 'object') {
            if (!update.name && update.fields.name) update.name = update.fields.name;
            const parts = [];
            for (const [k, v] of Object.entries(update.fields)) {
                if (k === 'name') continue;
                const label = FIELD_TRANSLATIONS[k] || k;
                parts.push(`【${label}】${v}`);
            }
            update.content = parts.join('\n');
        } else if (typeof update.fields === 'string') {
            update.content = update.fields;
        }
        delete update.fields;
    }

    if (!update.name && update.content) {
        const nameMatch = update.content.match(/【名称】(.+)/);
        if (nameMatch) update.name = nameMatch[1].trim();
    }

    if (!update.content) {
        const contentParts = [];
        for (const [key, val] of Object.entries(update)) {
            if (KNOWN_FIELDS.has(key)) continue;
            if (val == null) continue;
            const label = FIELD_TRANSLATIONS[key] || key;
            if (typeof val === 'string') {
                contentParts.push(`【${label}】${val}`);
            } else if (typeof val === 'object') {
                for (const [k, v] of Object.entries(val)) {
                    const innerLabel = FIELD_TRANSLATIONS[k] || k;
                    contentParts.push(`【${innerLabel}】${v}`);
                }
            }
        }
        if (contentParts.length > 0) {
            update.content = contentParts.join('\n');
        }
    }

    if (update.content && typeof update.content === 'object') {
        update.content = Object.entries(update.content)
            .map(([k, v]) => `【${k}】${v}`)
            .join('\n');
    }
}

function findExistingForArchive(update, projectId, materials) {
    if (!update.name) return null;

    const updateNameLower = update.name.toLowerCase().replace(/[\s\-_]/g, '');
    return materials.find(m => {
        if (m.projectId !== projectId || m.archived) return false;
        const mNameLower = m.name.toLowerCase().replace(/[\s\-_]/g, '');
        return mNameLower.includes(updateNameLower) || updateNameLower.includes(mNameLower) || (updateNameLower.length >= 2 && mNameLower.length >= 2 && (mNameLower.startsWith(updateNameLower.substring(0, Math.min(4, updateNameLower.length))) || updateNameLower.startsWith(mNameLower.substring(0, Math.min(4, mNameLower.length)))));
    });
}

function handleArchiveAction(update, existing, chapter, projectId) {
    if (existing.name && (existing.name.includes('主角') || existing.isLocked)) {
        console.warn(`[PIPELINE] 素材归档拦截: "${existing.name}" 是主角/锁定素材，不允许归档，改为update`);
        update.action = 'update';
        if (!update.content) update.content = existing.currentContent || existing.initialContent || '';
        return;
    }

    const archiveDir = ensureOutputDir(projectId, 'archived');
    const archiveRecord = {
        id: existing.id,
        type: existing.type,
        name: existing.name,
        action: update.action,
        reason: update.reason,
        originalContent: (existing.currentContent || '').substring(0, 500),
        archivedAt: new Date().toISOString(),
        archivedFrom: `Chapter ${chapter.chapterNumber}`
    };
    const archiveFile = path.join(archiveDir, `archive-${Date.now()}-${existing.name.replace(/[\\/:*?"<>|]/g, '_')}.json`);
    fs.writeFileSync(archiveFile, JSON.stringify(archiveRecord, null, 2), 'utf-8');

    store.setItem('materials', existing.id, {
        ...existing,
        status: update.action,
        archived: true,
        archivedReason: update.reason,
        archivedAt: new Date().toISOString(),
        currentContent: update.content || existing.currentContent,
        changeLog: [...(existing.changeLog || []), {
            from: existing.currentContent?.substring(0, 100) || '',
            to: `[${update.action}] ${update.reason}`,
            reason: update.reason,
            chapterNumber: chapter.chapterNumber,
            timestamp: new Date().toISOString()
        }]
    });
    console.log(`[PIPELINE] Material archived: ${existing.name} -> ${update.action} (${update.reason})`);
}

function handleUpdateAction(update, existing, chapter, projectId, styleProfile) {
    if (!update.content || (typeof update.content === 'string' && update.content.trim().length < 10)) {
        console.warn(`[PIPELINE] 素材更新拦截: "${update.name}" content为空或过短(${(update.content||'').length}字)，跳过更新防止覆盖已有内容`);
        return false;
    }

    const existingChangeLog = existing.changeLog || [];
    let linkedIds = existing.linkedMaterialIds || [];
    if (update.linkedNames && update.linkedNames.length > 0) {
        const linkedMats = update.linkedNames.map(n => materials.find(m => m.projectId === projectId && !m.archived && m.name.includes(n))).filter(Boolean);
        linkedIds = [...new Set([...linkedIds, ...linkedMats.map(m => m.id)])];
    }

    const protagonistName = styleProfile?.protagonistName || '';
    const isProtagonist = protagonistName && existing.name && existing.name.includes(protagonistName);

    const updateData = {
        ...existing,
        currentContent: update.content,
        changeReason: update.reason,
        linkedMaterialIds: linkedIds,
        sourceChapter: chapter.chapterNumber,
        changeLog: [...existingChangeLog, {
            from: existing.currentContent || '',
            to: update.content || '',
            reason: update.reason || 'Material manager update',
            chapterNumber: chapter.chapterNumber,
            timestamp: new Date().toISOString()
        }],
        version: (existing.version || 1) + 1,
        updatedAt: new Date().toISOString()
    };

    if (isProtagonist) {
        try {
            const chNum = chapter.chapterNumber || 1;
            const volumeOrder = getVolumeOrder(projectId);
            const currentVolume = volumeOrder.volumeOrder.find(v => {
                const match = v.chapters.match(/Ch(\d+)-(\d+)/);
                if (match) return chNum >= parseInt(match[1]) && chNum <= parseInt(match[2]);
                return false;
            });
            if (currentVolume) {
                updateData.currentPlaneId = currentVolume.subplaneId;
                updateData.parentPlane = null;
            } else {
                updateData.currentPlaneId = null;
            }
        } catch (_) { console.warn('[SILENT-CATCH]', _.message || _); }
    }

    if (update.currentPlaneId !== undefined) updateData.currentPlaneId = update.currentPlaneId;

    applyFlavorTags(update, updateData, existing.type);

    store.setItem('materials', existing.id, updateData);
    return true;
}

function applyFlavorTags(update, updateData, type) {
    if (type !== 'character') return;

    if (update.dialectRegion) updateData.dialectRegion = update.dialectRegion;
    if (update.dialectIntensity) updateData.dialectIntensity = update.dialectIntensity;
    if (!update.dialectRegion && update.content) {
        const parsed = parseFlavorTag(update.content, /【方言】\s*([^|｜\]]+?)\s*[|｜]\s*(轻度|中度|重度|light|medium|heavy)/);
        if (parsed) {
            updateData.dialectRegion = parsed.value;
            updateData.dialectIntensity = parsed.intensity;
        }
    }

    if (update.speechStyle) updateData.speechStyle = update.speechStyle;
    if (update.speechStyleIntensity) updateData.speechStyleIntensity = update.speechStyleIntensity;
    if (!update.speechStyle && update.content) {
        const parsed = parseFlavorTag(update.content, /【风格】\s*([^|｜\]]+?)\s*[|｜]\s*(轻度|中度|重度|light|medium|heavy)/);
        if (parsed) {
            updateData.speechStyle = parsed.value;
            updateData.speechStyleIntensity = parsed.intensity;
        }
    }

    if (update.namingStyle) updateData.namingStyle = update.namingStyle;
    if (update.namingStyleIntensity) updateData.namingStyleIntensity = update.namingStyleIntensity;
    if (!update.namingStyle && update.content) {
        const parsed = parseFlavorTag(update.content, /【命名】\s*([^|｜\]]+?)\s*[|｜]\s*(轻度|中度|重度|light|medium|heavy)/);
        if (parsed) {
            updateData.namingStyle = parsed.value;
            updateData.namingStyleIntensity = parsed.intensity;
        }
    }

    if (update.archetype) updateData.archetype = update.archetype;
    if (!update.archetype && update.content) {
        const archMatch = update.content.match(/【人设】\s*([^|｜\]]+?)(?:\s*[|｜]\s*(轻度|中度|重度|light|medium|heavy))?/);
        if (archMatch) {
            updateData.archetype = archMatch[1].trim();
        }
    }
}

function handleCreateAction(update, chapter, projectId, styleProfile, materials) {
    if (!update.content || (typeof update.content === 'string' && update.content.trim().length < 10)) {
        console.warn(`[PIPELINE] 素材创建拦截: "${update.name}" content为空或过短(${(update.content||'').length}字)，跳过创建`);
        return null;
    }

    let materialType = update.type || 'foreshadowing';
    const validation = validateMaterial({ type: materialType, currentContent: update.content, name: update.name });
    if (!validation.valid && validation.suggestedType) {
        console.log(`[PIPELINE] Material type correction: "${update.name}" ${materialType} → ${validation.suggestedType}`);
        materialType = validation.suggestedType;
    } else if (validation.typeMismatch && validation.suggestedType) {
        console.log(`[PIPELINE] Material type mismatch warning: "${update.name}" marked as ${materialType} but content suggests ${validation.suggestedType}, auto-correcting`);
        materialType = validation.suggestedType;
    }
    if (!validation.valid && !validation.suggestedType) {
        console.log(`[PIPELINE] Material validation warning: ${update.name} (${materialType}) - ${validation.message}`);
    }

    const genreValidation = validateNewMaterial({ type: materialType, name: update.name, currentContent: update.content, initialContent: update.content }, styleProfile, materials);
    if (genreValidation.errors.length > 0) {
        console.warn(`[PIPELINE] 素材校验拦截: "${update.name}" 命名违规 - ${genreValidation.errors.join('; ')}`);
        return null;
    }

    let resolvedParentPlane = update.parentPlane || null;
    let resolvedParentFaction = update.parentFaction || null;

    if (resolvedParentPlane) {
        const planeResult = resolveParentPlane(resolvedParentPlane, projectId);
        if (planeResult.resolved) {
            if (planeResult.method !== 'direct-id') {
                console.log(`[PIPELINE] parentPlane引用标准化: "${resolvedParentPlane}" → ID "${planeResult.resolved}"(${planeResult.name})`);
            }
            resolvedParentPlane = planeResult.resolved;
        } else if (planeResult.method === 'unresolved') {
            console.warn(`[PIPELINE] parentPlane引用无法解析: "${resolvedParentPlane}"，清空归入主世界`);
            resolvedParentPlane = null;
        }
    }

    if (resolvedParentFaction) {
        const factionResult = resolveParentFaction(resolvedParentFaction, projectId);
        if (factionResult.resolved) {
            if (factionResult.method !== 'direct-id') {
                console.log(`[PIPELINE] parentFaction引用标准化: "${resolvedParentFaction}" → ID "${factionResult.resolved}"(${factionResult.name})`);
            }
            resolvedParentFaction = factionResult.resolved;
        } else if (factionResult.method === 'unresolved') {
            console.warn(`[PIPELINE] parentFaction引用无法解析: "${resolvedParentFaction}"，将尝试自动归入`);
            resolvedParentFaction = null;
        }
    }

    if (['faction', 'character', 'institution'].includes(materialType) && !resolvedParentPlane && !resolvedParentFaction) {
        const contentText = (update.content || '').toLowerCase();
        const nameText = (update.name || '').toLowerCase();
        const allProjectMats = materials.filter(m => m.projectId === projectId && !m.archived);
        const subPlanes = allProjectMats.filter(m => m.type === 'sub-plane' && !m.isLocked);
        const factions = allProjectMats.filter(m => m.type === 'faction');
        for (const sp of subPlanes) {
            if (contentText.includes(sp.name.toLowerCase()) || nameText.includes(sp.name.toLowerCase())) {
                resolvedParentPlane = sp.id;
                break;
            }
        }
        if (materialType === 'character' && !resolvedParentFaction) {
            for (const fac of factions) {
                if (contentText.includes(fac.name.toLowerCase()) || nameText.includes(fac.name.toLowerCase())) {
                    resolvedParentFaction = fac.id;
                    if (!resolvedParentPlane && fac.parentPlane) resolvedParentPlane = fac.parentPlane;
                    break;
                }
            }
        }
    }

    if (materialType === 'character' && !resolvedParentFaction) {
        const allProjectFactions = materials.filter(m => m.projectId === projectId && !m.archived && m.type === 'faction');
        if (allProjectFactions.length > 0) {
            const mainWorldFaction = allProjectFactions.find(f => !f.parentPlane);
            resolvedParentFaction = mainWorldFaction ? mainWorldFaction.id : allProjectFactions[0].id;
            console.warn(`[PIPELINE] 素材层级自动修正: 人物"${update.name}"缺少parentFaction，自动归入"${mainWorldFaction ? mainWorldFaction.name : allProjectFactions[0].name}"`);
            if (!resolvedParentPlane && mainWorldFaction?.parentPlane) resolvedParentPlane = mainWorldFaction.parentPlane;
        }
    }

    const newMatId = uuidv4();
    let linkedIds = [];
    if (update.linkedNames && update.linkedNames.length > 0) {
        const linkedMats = update.linkedNames.map(n => materials.find(m => m.projectId === projectId && !m.archived && m.name.includes(n))).filter(Boolean);
        linkedIds = linkedMats.map(m => m.id);
    }

    let dialectRegion = update.dialectRegion || null;
    let dialectIntensity = update.dialectIntensity || null;
    if (materialType === 'character' && !dialectRegion && update.content) {
        const parsed = parseFlavorTag(update.content, /【方言】\s*([^|｜\]]+?)\s*[|｜]\s*(轻度|中度|重度|light|medium|heavy)/);
        if (parsed) {
            dialectRegion = parsed.value;
            dialectIntensity = parsed.intensity;
        }
    }

    let speechStyle = update.speechStyle || null;
    let speechStyleIntensity = update.speechStyleIntensity || null;
    if (materialType === 'character' && !speechStyle && update.content) {
        const parsed = parseFlavorTag(update.content, /【风格】\s*([^|｜\]]+?)\s*[|｜]\s*(轻度|中度|重度|light|medium|heavy)/);
        if (parsed) {
            speechStyle = parsed.value;
            speechStyleIntensity = parsed.intensity;
        }
    }

    let namingStyle = update.namingStyle || null;
    let namingStyleIntensity = update.namingStyleIntensity || null;
    if (materialType === 'character' && !namingStyle && update.content) {
        const parsed = parseFlavorTag(update.content, /【命名】\s*([^|｜\]]+?)\s*[|｜]\s*(轻度|中度|重度|light|medium|heavy)/);
        if (parsed) {
            namingStyle = parsed.value;
            namingStyleIntensity = parsed.intensity;
        }
    }

    let archetype = update.archetype || null;
    if (materialType === 'character' && !archetype && update.content) {
        const archMatch = update.content.match(/【人设】\s*([^|｜\]]+?)(?:\s*[|｜]\s*(轻度|中度|重度|light|medium|heavy))?/);
        if (archMatch) {
            archetype = archMatch[1].trim();
        }
    }

    const newMaterial = {
        id: newMatId,
        projectId,
        type: materialType,
        name: update.name,
        description: update.reason || '',
        initialContent: update.content,
        currentContent: update.content,
        tags: [],
        isLocked: false,
        parentPlane: resolvedParentPlane,
        parentFaction: resolvedParentFaction,
        currentPlaneId: update.currentPlaneId || null,
        dialectRegion,
        dialectIntensity,
        speechStyle,
        speechStyleIntensity,
        namingStyle,
        namingStyleIntensity,
        archetype,
        version: 1,
        sourceChapter: chapter.chapterNumber,
        linkedMaterialIds: linkedIds,
        changeLog: [{
            from: '',
            to: update.content,
            reason: update.reason || 'Created from pipeline',
            chapterNumber: chapter.chapterNumber,
            timestamp: new Date().toISOString()
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    store.setItem('materials', newMatId, newMaterial);
    return { id: newMatId, type: materialType };
}

function createTimelineEntry(update, chapter, projectId, newMatId) {
    if (!['character', 'famous-scene', 'foreshadowing', 'power-system'].includes(update.type)) return;

    const eventTypeMap = { 'character': 'character', 'famous-scene': 'plot', 'foreshadowing': 'foreshadow', 'power-system': 'world' };
    const existingTimelines = store.listItems('timelines').filter(t => t.projectId === projectId);
    const relatedQuests = store.listItems('quests').filter(q => q.projectId === projectId && (q.chapterIds || []).includes(chapter.id));
    const tlId2 = uuidv4();

    store.setItem('timelines', tlId2, {
        id: tlId2,
        projectId,
        title: update.name,
        description: (update.content || '').substring(0, 300),
        eventType: eventTypeMap[update.type] || 'plot',
        storyOrder: existingTimelines.length,
        sortOrder: existingTimelines.length,
        storyTime: `第${chapter.chapterNumber}章`,
        chapterIds: [chapter.id],
        questIds: relatedQuests.map(q => q.id),
        materialIds: [newMatId],
        characterIds: update.type === 'character' ? [newMatId] : [],
        location: '',
        importance: update.type === 'famous-scene' ? 'high' : 'normal',
        isKeyEvent: update.type === 'famous-scene',
        notes: update.reason || '',
        tags: ['auto-generated', `material-${update.type}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}

async function processUpdates(allUpdates, chapter, projectId, materials, styleProfile) {
    const appliedUpdates = [];
    let createCount = 0;
    const MAX_CREATE_PER_CHAPTER = 3;

    for (const update of allUpdates) {
        try {
            normalizeReferences(update, projectId, materials);

            const existing = findExistingMaterial(update, projectId, materials);
            determineAction(update, existing);

            if (update.action === 'create' && !update.parentPlane) {
                injectPlaneForCreate(update, chapter, projectId, styleProfile, materials);
            }
            if (update.action === 'create' && update.parentPlane && !update.parentFaction && update.type === 'character') {
                injectFactionForCharacter(update, projectId, materials);
            }
            if (update.action === 'create') {
                createCount++;
                if (createCount > MAX_CREATE_PER_CHAPTER) {
                    console.warn(`[PIPELINE] 素材创建硬限制: 每章最多${MAX_CREATE_PER_CHAPTER}个新素材，跳过"${update.name}"`);
                    continue;
                }
            }

            normalizeContent(update);

            const archiveExisting = findExistingForArchive(update, projectId, materials);
            if (['retire', 'deprecate', 'recycle'].includes(update.action)) {
                if (archiveExisting) {
                    handleArchiveAction(update, archiveExisting, chapter, projectId);
                    appliedUpdates.push({ action: update.action, type: archiveExisting.type, name: archiveExisting.name, reason: update.reason });
                    try { getMetrics(projectId).recordMaterialAdded(chapter.chapterNumber, archiveExisting.type, archiveExisting.name, update.action); } catch (_) { console.warn('[SILENT-CATCH]', _.message || _); }
                }
                continue;
            }

            if (existing && update.action === 'update') {
                const success = handleUpdateAction(update, existing, chapter, projectId, styleProfile);
                if (success) {
                    appliedUpdates.push({ action: 'update', type: existing.type, name: existing.name, reason: update.reason });
                    try { getMetrics(projectId).recordMaterialAdded(chapter.chapterNumber, existing.type, existing.name, 'update'); } catch (_) { console.warn('[SILENT-CATCH]', _.message || _); }
                }
                continue;
            }

            if (update.action === 'create' || !existing) {
                const result = handleCreateAction(update, chapter, projectId, styleProfile, materials);
                if (result) {
                    appliedUpdates.push({ action: 'create', type: result.type, name: update.name, reason: update.reason });
                    try { getMetrics(projectId).recordMaterialAdded(chapter.chapterNumber, update.type, update.name, 'create'); } catch (_) { console.warn('[SILENT-CATCH]', _.message || _); }
                    createTimelineEntry(update, chapter, projectId, result.id);
                }
            }
        } catch (updateErr) {
            console.warn(`[PIPELINE] 素材更新处理失败: "${update.name || 'unknown'}" - ${updateErr.message}`, updateErr.stack?.split('\n').slice(0, 3).join(' | '));
        }
    }

    return appliedUpdates;
}

module.exports = {
    processUpdates,
    normalizeContent,
    findExistingMaterial,
    handleCreateAction,
    handleUpdateAction,
    handleArchiveAction,
    FIELD_TRANSLATIONS
};
