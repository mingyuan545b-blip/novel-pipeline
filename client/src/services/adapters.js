const FIELD_ALIASES = {
    appearCount: ['appearCount', 'appearanceCount', 'chapterCount'],
    competence: ['competence', 'ability', 'power'],
    masterId: ['masterId', 'ownerId'],
    ownerId: ['ownerId', 'masterId'],
    petClass: ['petClass', 'grade', 'tier'],
    briefDesc: ['briefDesc', 'summaryDesc', 'description'],
    entityKey: ['entityKey', 'id'],
    name: ['name', 'entityName', 'characterName', 'petName', 'servantName', 'defName'],
    roleLevel: ['roleLevel', 'role'],
    servantType: ['servantType', 'type'],
    description: ['description', 'currentContent', 'initialContent'],
    specialty: ['specialty', 'specialties'],
};

function resolveField(obj, canonicalName) {
    const aliases = FIELD_ALIASES[canonicalName];
    if (!aliases) return obj[canonicalName];
    for (const alias of aliases) {
        if (obj[alias] !== undefined && obj[alias] !== null) return obj[alias];
    }
    return undefined;
}

function safeString(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
        return value.label || value.name || value.id || value.title || String(value.id || '');
    }
    return String(value);
}

function safeArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try { const p = JSON.parse(value); return Array.isArray(p) ? p : [value]; } catch { return [value]; }
    }
    if (value && typeof value === 'object') return [value];
    return [];
}

function adaptEntity(entity, materialsMap) {
    if (!entity) return entity;
    const adaptedName = resolveField(entity, 'name');
    let description = resolveField(entity, 'description');
    if (!description && materialsMap && entity.id && materialsMap[entity.id]) {
        description = materialsMap[entity.id].currentContent || materialsMap[entity.id].initialContent || '';
    }
    const worldScope = entity.profile?.worldScope || entity._adapted?.worldScope;
    const worldScopePrimary = worldScope?.primary || null;
    const primaryAppearance = worldScope?.appearances?.find(a => a.worldId === worldScopePrimary);
    const worldScopeName = primaryAppearance?.worldName || worldScopePrimary;
    const worldScopeColor = primaryAppearance?.worldColor || null;
    const worldScopeIsVisitor = primaryAppearance?.status === 'visitor' || false;

    return {
        ...entity,
        _adapted: {
            name: adaptedName,
            appearCount: resolveField(entity, 'appearCount'),
            entityKey: resolveField(entity, 'entityKey'),
            briefDesc: resolveField(entity, 'briefDesc'),
            roleLevel: resolveField(entity, 'roleLevel'),
            lifecycleState: entity.lifecycleState || 'active',
            description,
            worldScopePrimary,
            worldScopeName,
            worldScopeColor,
            worldScopeIsVisitor,
            // 人设特征
            position: entity.position || '',
            factionName: entity.factionName || '',
            personality: entity.personality || '',
            speakingTone: entity.speakingTone || '',
            signatureDetail: entity.signatureDetail || '',
            craftStyle: entity.craftStyle || '',
            // 人物魅力系统4维度（参考蛊真人方源设计）
            charisma: entity.charisma || '',
            philosophy: entity.philosophy || '',
            quoteLibrary: Array.isArray(entity.quoteLibrary) ? entity.quoteLibrary : [],
            entranceDesign: entity.entranceDesign || '',
            // 行为约束（统一标准源）
            behaviorRules: entity.behaviorRules || '',
            // 题材状态
            genreState: entity.genreState || {},
            genreId: entity.genreId || '',
            // 角色档案
            profile: entity.profile || {},
            sourceContent: entity.sourceContent || '',
            // 时间
            createdAt: entity.createdAt || '',
            updatedAt: entity.updatedAt || '',
        }
    };
}

function adaptServant(sv) {
    if (!sv) return sv;
    return {
        ...sv,
        _adapted: {
            name: resolveField(sv, 'name'),
            competence: resolveField(sv, 'competence'),
            masterId: resolveField(sv, 'masterId'),
            briefDesc: resolveField(sv, 'briefDesc'),
            servantType: resolveField(sv, 'servantType'),
        }
    };
}

function adaptPet(pet) {
    if (!pet) return pet;
    return {
        ...pet,
        _adapted: {
            name: resolveField(pet, 'name'),
            petClass: resolveField(pet, 'petClass'),
            briefDesc: resolveField(pet, 'briefDesc'),
            ownerId: resolveField(pet, 'ownerId'),
            abilities: safeArray(pet.abilities || pet.abilitiesJson),
        }
    };
}

function adaptRelation(rel, nameToIdMap) {
    if (!rel) return rel;
    let toId = rel.toCharacterId;
    if (nameToIdMap && toId && nameToIdMap[toId] && nameToIdMap[toId] !== toId) {
        toId = nameToIdMap[toId];
    }
    return {
        ...rel,
        _adapted: {
            toCharacterId: toId,
        }
    };
}

function buildNameToIdMap(characters, materials) {
    const map = {};
    if (characters) {
        characters.forEach(c => {
            const name = c.name || c.entityName || c.characterName;
            if (name && c.id) map[name] = c.id;
        });
    }
    if (materials) {
        materials.forEach(m => {
            if (m.name && m.id) map[m.name] = m.id;
        });
    }
    return map;
}

function adaptGenre(genre) {
    if (!genre) return '未知';
    if (typeof genre === 'string') return genre;
    return genre.label || genre.name || genre.id || '未知';
}

function adaptList(items, adapter, ...adapterArgs) {
    if (!Array.isArray(items)) return [];
    return adapter ? items.map(item => adapter(item, ...adapterArgs)) : items;
}

export { resolveField, safeString, safeArray, adaptEntity, adaptServant, adaptPet, adaptRelation, buildNameToIdMap, adaptGenre, adaptList };
