const store = require('../store');
const logger = require('../shared/logger');
const { EQUIPMENT_LIFECYCLE, EQUIPMENT_TRANSITIONS, TECHNIQUE_LIFECYCLE, TECHNIQUE_TRANSITIONS } = require('./entityCenter/entityLifecycle');

const PERMANENCE_LEVELS = {
    'temporary': { key: 'temporary', label: '临时', description: '在手上/可使用，可被掠夺，非认主', canBePlundered: true, isBound: false },
    'semi-permanent': { key: 'semi-permanent', label: '半永久', description: '认主但可被掠夺，或可使用可被掠夺', canBePlundered: true, isBound: true },
    'permanent': { key: 'permanent', label: '永久', description: '认主不可掠夺，永久绑定', canBePlundered: false, isBound: true }
};

function inferPermanence(content, bindType) {
    if (!content) return 'semi-permanent';
    const permanentSignals = /认主|不可掠夺|不可剥夺|绑定灵魂|灵魂绑定|血契|命格|宿命|不可分离|融入|融合|刻入|铭刻/;
    const temporarySignals = /临时|借用|暂持|持有中|在手上|可掠夺|可夺取|可被夺/;
    if (permanentSignals.test(content)) return 'permanent';
    if (temporarySignals.test(content)) return 'temporary';
    if (bindType === 'technique') return 'permanent';
    if (bindType === 'pet') return 'semi-permanent';
    if (bindType === 'servant') return 'semi-permanent';
    return 'semi-permanent';
}

class CharacterBind {
    async bindItem(projectId, characterId, defId, bindType, options = {}) {
        const id = options.id || `bind-${characterId}-${defId}-${bindType}`;
        const permanence = options.permanence || inferPermanence(options.content || options.personalNotes || '', bindType);
        const entry = {
            id,
            projectId,
            characterId,
            defId,
            bindType,
            bindStatus: options.bindStatus || 'active',
            permanence,
            acquiredChapter: options.acquiredChapter || 0,
            lostChapter: options.lostChapter || null,
            masteryLevel: options.masteryLevel || '初学',
            masteryProgress: options.masteryProgress || 0,
            personalNotes: options.personalNotes || '',
            customName: options.customName || '',
            slotPosition: options.slotPosition || '',
            bindOrder: options.bindOrder || 0,
            ...options
        };
        entry.id = id;
        entry.projectId = projectId;
        entry.characterId = characterId;
        entry.defId = defId;
        entry.bindType = bindType;
        entry.permanence = permanence;
        await store.setItem('character-binds', id, entry);
        return entry;
    }

    async unbindItem(bindId, reason = 'lost') {
        const bind = await store.getItem('character-binds', bindId);
        if (!bind) return null;
        bind.bindStatus = reason;
        bind.lostChapter = bind.lostChapter || 0;
        await store.setItem('character-binds', bindId, bind);
        return bind;
    }

    async updatePermanence(bindId, newPermanence) {
        if (!PERMANENCE_LEVELS[newPermanence]) {
            throw new Error(`Invalid permanence: ${newPermanence}. Must be one of: ${Object.keys(PERMANENCE_LEVELS).join(', ')}`);
        }
        const bind = await store.getItem('character-binds', bindId);
        if (!bind) return null;
        bind.permanence = newPermanence;
        await store.setItem('character-binds', bindId, bind);
        return bind;
    }

    async transitionPermanence(bindId, direction) {
        const bind = await store.getItem('character-binds', bindId);
        if (!bind) return null;
        const order = ['temporary', 'semi-permanent', 'permanent'];
        const currentIdx = order.indexOf(bind.permanence);
        if (currentIdx === -1) return null;
        if (direction === 'upgrade' && currentIdx < order.length - 1) {
            bind.permanence = order[currentIdx + 1];
        } else if (direction === 'downgrade' && currentIdx > 0) {
            bind.permanence = order[currentIdx - 1];
        }
        await store.setItem('character-binds', bindId, bind);
        return bind;
    }

    async getBindsForCharacter(characterId, options = {}) {
        const allBinds = await store.queryItems('character-binds', { characterId, ...options });
        return allBinds.filter(b => b.characterId === characterId);
    }

    async getBindersOfDefinition(defId) {
        return await store.queryItems('character-binds', { defId });
    }

    async updateMastery(bindId, level, progress) {
        const bind = await store.getItem('character-binds', bindId);
        if (!bind) return null;
        bind.masteryLevel = level || bind.masteryLevel;
        bind.masteryProgress = progress !== undefined ? progress : bind.masteryProgress;
        await store.setItem('character-binds', bindId, bind);
        return bind;
    }

    /** 装备/功法生命周期状态变迁 */
    async transitionBindStatus(bindId, toStatus, reason = '') {
        const bind = await store.getItem('character-binds', bindId);
        if (!bind) return null;
        const fromStatus = bind.bindStatus;
        const transitions = bind.bindType === 'technique' ? TECHNIQUE_TRANSITIONS : EQUIPMENT_TRANSITIONS;
        const allowed = transitions[fromStatus];
        if (!allowed || !allowed.includes(toStatus)) {
            logger.warn('characterBind', `Invalid bind transition: ${fromStatus}→${toStatus} for ${bind.bindType}`);
            return null;
        }
        bind.bindStatus = toStatus;
        if (['lost', 'destroyed', 'broken'].includes(toStatus)) {
            bind.lostChapter = bind.lostChapter || 0;
        }
        if (!bind.data) bind.data = {};
        if (!bind.data.statusHistory) bind.data.statusHistory = [];
        bind.data.statusHistory.push({ from: fromStatus, to: toStatus, reason, timestamp: new Date().toISOString() });
        await store.setItem('character-binds', bindId, bind);
        logger.info('characterBind', `Bind ${bindId}: ${fromStatus}→${toStatus} (${reason})`);
        return bind;
    }
}

const characterBind = new CharacterBind();
module.exports = { characterBind, PERMANENCE_LEVELS, inferPermanence };
