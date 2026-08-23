const store = require('../../store');
const { _recomputePromptTexts } = require('./formatters');
const { getVisibilityFilter, CHARACTER_LIFECYCLE, migrateIsActive } = require('./entityLifecycle');

/** Writer可见的生命周期状态 */
const WRITER_VISIBLE_STATES = Object.entries(CHARACTER_LIFECYCLE)
    .filter(([, v]) => v.visibleToWriter)
    .map(([k]) => k);

/** Reviewer可见的生命周期状态 */
const REVIEWER_VISIBLE_STATES = Object.entries(CHARACTER_LIFECYCLE)
    .filter(([, v]) => v.visibleToReviewer)
    .map(([k]) => k);

async function getForIntentPlanner(projectId, getEntitiesFn) {
    const entities = await getEntitiesFn(projectId, { entityType: 'character', lifecycleStates: WRITER_VISIBLE_STATES });
    return entities.map(e => ({
        entityId: e.id, characterId: e.id, roleLevel: e.roleLevel,
        name: e.name, text: e.briefText || '', briefText: e.briefText || '', tokens: e.briefTokens || 0,
        lifecycleState: e.lifecycleState || 'active',
    }));
}

async function getForWriter(projectId, chapterNumber, tokenBudget, getEntitiesFn) {
    const effectiveBudget = tokenBudget || 3000;
    const entities = await getEntitiesFn(projectId, { entityType: 'character', lifecycleStates: WRITER_VISIBLE_STATES });
    const result = [];
    let budgetUsed = 0;

    for (const e of entities) {
        const state = e.lifecycleState || 'active';
        let text = '';
        let tokens = 0;

        if (e.roleLevel === 'protagonist') {
            text = e.summaryText || e.briefText || '';
            tokens = e.summaryTokens || e.briefTokens || 0;
        } else if (e.roleLevel === 'supporting') {
            if (budgetUsed + (e.summaryTokens || 0) <= effectiveBudget) {
                text = e.summaryText || e.briefText || '';
                tokens = e.summaryTokens || e.briefTokens || 0;
            } else {
                text = e.briefText || '';
                tokens = e.briefTokens || 0;
            }
        } else {
            text = e.briefText || '';
            tokens = e.briefTokens || 0;
        }

        // 受伤/昏迷角色标注状态提醒writer
        if (state === 'injured') text = `[状态:受伤] ${text}`;
        if (state === 'comatose') text = `[状态:昏迷-无法行动] ${text}`;
        if (state === 'missing') text = `[状态:失踪-不在场] ${text}`;

        if (budgetUsed + tokens <= effectiveBudget) {
            result.push({
                entityId: e.id, characterId: e.id, roleLevel: e.roleLevel,
                name: e.name, text, summaryText: text, tokens,
                lifecycleState: state,
                refNames: e.profile?.refNames || e.refNames || null,
                stateJson: buildStateJson(e), bindsJson: e.bindsSummary || []
            });
            budgetUsed += tokens;
        }
    }

    return result;
}

async function getForReviewer(projectId, chapterNumber, getEntitiesFn) {
    const entities = await getEntitiesFn(projectId, { entityType: 'character', lifecycleStates: REVIEWER_VISIBLE_STATES });
    return entities.filter(e => e.roleLevel === 'protagonist' || e.roleLevel === 'supporting').map(e => ({
        entityId: e.id, characterId: e.id, roleLevel: e.roleLevel,
        name: e.name, text: e.detailText || e.summaryText || '',
        summaryText: e.detailText || e.summaryText || '',
        tokens: e.detailTokens || e.summaryTokens || 0,
        genreState: e.genreState, stateJson: buildStateJson(e), changedFields: [],
        lifecycleState: e.lifecycleState || 'active',
    }));
}

function buildStateJson(entity) {
    const state = { name: entity.name, roleLevel: entity.roleLevel };
    if (entity.lifecycleState && entity.lifecycleState !== 'active') state.lifecycleState = entity.lifecycleState;
    if (entity.position) state.position = entity.position;
    if (entity.factionName) state.factionName = entity.factionName;
    if (entity.personality) state.personality = entity.personality;
    if (entity.speakingTone) state.speakingTone = entity.speakingTone;
    // 人物魅力系统短字段注入stateJson（金句库较长，只走detailText避免token膨胀）
    if (entity.charisma) state.charisma = entity.charisma;
    if (entity.philosophy) state.philosophy = entity.philosophy;
    if (entity.hp !== undefined) state.hp = entity.hp;
    if (entity.combatPower) state.combatPower = entity.combatPower;
    if (entity.profile?.gender) state.gender = entity.profile.gender;
    if (entity.profile?.appearance) state.appearance = entity.profile.appearance;
    if (entity.profile?.background) state.background = entity.profile.background;
    if (entity.genreState && typeof entity.genreState === 'object') Object.assign(state, entity.genreState);
    return state;
}

module.exports = { getForIntentPlanner, getForWriter, getForReviewer, buildStateJson };
