const { getDataContext } = require('../dataContext');
const { resolveGenreFromProject } = require('../genreConfig');

const RELATIONSHIP_STAGES = {
    // 题材专属关系阶段表（仅保留通过质量门禁的题材）
    // 删除tomato-sweet后无题材专属阶段表，统一走DEFAULT_STAGES
};

const DEFAULT_STAGES = {
    1:  { stage: '初识', label: '相遇', allow: '初次见面/建立关系起点', forbid: '表白/求婚/关系确立', sugarType: '相遇时的心动瞬间' },
    5:  { stage: '心动', label: '心动', allow: '暧昧互动/含蓄表达', forbid: '直接表白/求婚', sugarType: '心动的微妙瞬间' },
    10: { stage: '确立', label: '关系确立', allow: '关系推进/甜蜜互动', forbid: '求婚(太早)', sugarType: '关系推进的甜蜜' },
    15: { stage: '深化', label: '关系深化', allow: '深度信任/共同成长', forbid: '无脑分手', sugarType: '深化中的温暖' },
    20: { stage: '圆满', label: '圆满', allow: '求婚/关系圆满', forbid: '悲剧结尾', sugarType: '圆满的甜蜜' }
};

function getStageForChapter(genreId, chapterNumber) {
    const stages = RELATIONSHIP_STAGES[genreId] || DEFAULT_STAGES;
    const sortedKeys = Object.keys(stages).map(Number).sort((a, b) => a - b);

    let matched = null;
    for (const key of sortedKeys) {
        if (chapterNumber >= key) {
            matched = stages[key];
        } else {
            break;
        }
    }
    return matched;
}

function buildStageGuardText(genreId, chapterNumber, genreLabel) {
    const stageInfo = getStageForChapter(genreId, chapterNumber);
    if (!stageInfo) return '';

    const nextMilestoneHint = _getNextMilestoneHint(genreId, chapterNumber);

    return `\n\n【⚠️ 关系阶段守卫 - 违反即退回 - 优先级高于风格规则】
当前第${chapterNumber}章，关系阶段：${stageInfo.stage}（${stageInfo.label}）
✅ 本章允许的互动：${stageInfo.allow}
❌ 本章禁止的互动：${stageInfo.forbid}
🍬 本章糖点类型：${stageInfo.sugarType}
${nextMilestoneHint}
【铁律】大纲定义"写什么"，风格规则定义"怎么写"。当风格规则（如"每章糖点""甜蜜为主"）与关系阶段冲突时，以关系阶段为准。糖点必须符合当前关系阶段，不得越级。`;
}

function _getNextMilestoneHint(genreId, chapterNumber) {
    const stages = RELATIONSHIP_STAGES[genreId] || DEFAULT_STAGES;
    const sortedKeys = Object.keys(stages).map(Number).sort((a, b) => a - b);
    const nextKey = sortedKeys.find(k => k > chapterNumber);
    if (nextKey) {
        const nextStage = stages[nextKey];
        return `📋 下一里程碑：第${nextKey}章「${nextStage.label}」（${nextStage.stage}），本章需为下一阶段做好铺垫，但不得提前进入。`;
    }
    return '';
}

async function buildRelationshipStageGuard(projectId, chapterNumber) {
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    if (!project) return '';

    const genre = resolveGenreFromProject(project);
    const genreId = genre ? genre.id : (project.subGenre || project.subgenre || project.genre);
    if (!genreId) return '';

    const genreLabel = project.genre || genreId;
    return buildStageGuardText(genreId, chapterNumber, genreLabel);
}

module.exports = {
    RELATIONSHIP_STAGES,
    DEFAULT_STAGES,
    getStageForChapter,
    buildStageGuardText,
    buildRelationshipStageGuard
};
