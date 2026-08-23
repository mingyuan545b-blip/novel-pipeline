const { getGenreStateKeys } = require('../../../config/genreEntitySchemas');

const INTENSITY_MAP = { '轻度': 'light', '中度': 'medium', '重度': 'heavy', 'light': 'light', 'medium': 'medium', 'heavy': 'heavy' };

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

function extractFieldFromContent(content, label) {
    if (!content || typeof content !== 'string') return '';
    const match = content.match(new RegExp(`【${label}】(.+)`));
    return match ? match[1].trim() : '';
}

function extractRoleLevelFromContent(content, protagonistName) {
    if (!content || typeof content !== 'string') return '';
    const tagMatch = content.match(/【角色等级】\s*(.+)/);
    if (tagMatch) {
        const val = tagMatch[1].trim();
        if (/主角|protagonist/i.test(val)) return 'protagonist';
        if (/重要|核心|supporting/i.test(val)) return 'supporting';
        if (/配角|次要/i.test(val)) return 'supporting';
        if (/龙套|路人|背景|npc/i.test(val)) return 'npc';
        return val.toLowerCase();
    }
    if (protagonistName && content.includes(protagonistName)) return 'protagonist';
    return '';
}

function extractGenreStateFromContent(content, genreId) {
    if (!content || typeof content !== 'string') return {};
    const keys = getGenreStateKeys(genreId);
    const state = {};
    for (const [key, config] of Object.entries(keys)) {
        const match = content.match(new RegExp(`【${config.label}】(.+)`));
        if (match) {
            state[key] = config.type === 'number' ? (Number(match[1].trim()) || config.default) : match[1].trim();
        }
    }
    const extraLabels = {
        cultivationStage: ['修炼境界', '境界'], combatPowerLevel: ['战力等级', '战力'],
        jobTitle: ['职位', '职业'], company: ['所属公司', '公司'],
        energy: ['精力'], wealth: ['财富'], mp: ['灵力', '内力', '法力'],
        sanity: ['理智值', '理智'], abilityLevel: ['异能等级'],
        relationshipProgress: ['关系进度'], emotionalState: ['情感状态']
    };
    for (const [key, labels] of Object.entries(extraLabels)) {
        if (state[key] !== undefined) continue;
        for (const label of labels) {
            const match = content.match(new RegExp(`【${label}】(.+)`));
            if (match) { state[key] = match[1].trim(); break; }
        }
    }
    return state;
}

function parseFlavorTag(content, tagPattern) {
    const match = content.match(tagPattern);
    if (!match) return null;
    return { value: match[1].trim(), intensity: INTENSITY_MAP[match[2]] || 'medium' };
}

module.exports = { INTENSITY_MAP, FIELD_TRANSLATIONS, KNOWN_FIELDS, extractFieldFromContent, extractRoleLevelFromContent, extractGenreStateFromContent, parseFlavorTag };
