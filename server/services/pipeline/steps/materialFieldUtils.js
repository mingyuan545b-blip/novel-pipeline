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

/**
 * 从素材内容推断角色等级
 * @param {string} content 素材正文
 * @param {string} protagonistName 项目主角名
 * @param {string} characterName 该素材对应的角色名（可选，但强烈建议传）
 *
 * 回归背景（2026-09-21 20章E2E）：原第 39 行是 `content.includes(protagonistName)`，
 * 意味着"描述里提到了主角"就被判定为主角 —— 实测 陈默/顾长风/保管员(第五人) 三个配角
 * 的素材全被标成 protagonist，素材表出现 4 个主角（实体表只有 1 个），
 * 而素材 roleLevel 直接决定上下文注入等级与素材深度要求。
 * 修正为：只有"角色名 == 主角名"才算主角；未传角色名时退化为不判定（交由调用方兜底）。
 */
function extractRoleLevelFromContent(content, protagonistName, characterName) {
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
    // 仅"角色名就是主角名"才判主角（原 content.includes 会把所有提到主角的配角误判为主角）
    if (protagonistName && characterName && String(characterName).trim() === String(protagonistName).trim()) return 'protagonist';
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
