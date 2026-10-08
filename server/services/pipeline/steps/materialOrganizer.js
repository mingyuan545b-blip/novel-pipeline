const logger = require('../../../shared/logger');
const { warnOnEmptyOrganizingPlan, warnOnDepthGaps } = require('./materialOrganizerGuards');
const store = require('../../../store');
const stateKVIndex = require('../../stateKVIndex');
const { getCharacterStateSchema } = require('../../../config/characterStateSchemas');
const { resolveGenreFromProject } = require('../../genreConfig');
const { resolve } = require('../../../config/promptFragments');
const { getDataContext } = require('../../dataContext');
const { getOrganizerFieldHints } = require('../../../config/characterFieldSpec');

function buildOrganizerPrompt(chapter, kvSummary, project, stateSummary, genre) {
    // 陷阱#86修复：此前只传{styleProfile}给resolveGenreFromProject，丢失subGenre/branchKey
    // 导致genre解析失败返回null，IS_DEPTH_PROFILE=false，配角深度指令不生效
    // 修复：由handleMaterialOrganizer传入已resolve的genre对象，避免重复解析+数据丢失
    const resolvedGenre = genre || resolveGenreFromProject(project);
    const vars = resolve(resolvedGenre);
    const genreLabel = resolvedGenre?.label || resolvedGenre?.name || project?.genre || '未指定';

    const supportingRule = vars.SUPPORTING_ORGANIZER_DIMENSIONS
        ? `5. ${vars.SUPPORTING_ORGANIZER_DIMENSIONS}`
        : '5. 🔷配角只记录关键状态变化（战力等级变化、阵营变化、与主角关系变化），细枝末节忽略';

    const protagonistHints = getOrganizerFieldHints('protagonist');
    const supportingHints = getOrganizerFieldHints('supporting');
    const npcHints = getOrganizerFieldHints('npc');

    return `你是素材整理归类师。请仔细阅读以下定稿正文，分析其中涉及的素材变化。

【项目题材】${genreLabel || genre || '未指定'}

${stateSummary ? `【当前角色状态】\n${stateSummary}\n` : ''}

${kvSummary ? `【素材库热点索引】\n${kvSummary}\n` : ''}

【定稿正文】（第${chapter.chapterNumber}章）
${(chapter.content || '').substring(0, 20000)}

---

请输出一个 JSON 格式的整理计划（organizingPlan），包含以下内容：

{
    "characters": [
        {
            "name": "角色名",
            "roleLevel": "protagonist|supporting|npc",
            "appeared": true,
            "actions": ["战斗", "对话", "修炼"],
            "stateChanges": {
                "hp": {"from": 100, "to": 80, "reason": "战斗中受伤"},
                "position": {"from": "弟子", "to": "执事", "reason": "晋升"}
            },
            "newMaterials": [
                {"type": "equipment", "name": "青锋剑", "action": "acquired", "description": "..."}
            ],
            "relationshipChanges": [
                {"with": "张三", "from": "陌生", "to": "信任", "reason": "共同经历战斗", "isSecret": false},
                {"with": "李四", "from": "陌生", "to": "暗盟", "reason": "秘密结盟对抗反派", "isSecret": true, "knownBy": ["王五"]}
            ],
            "bindChanges": [
                {"action": "acquire", "itemName": "牛符咒", "bindType": "equipment", "permanence": "semi-permanent", "description": "获得牛符咒"},
                {"action": "lose", "itemName": "木剑", "reason": "lost"},
                {"action": "changePermanence", "itemName": "鼠符咒", "newPermanence": "permanent"}
            ],
            // 主角字段要求：
            ${protagonistHints.map(h => h).join(',\n            ')}
        }
    ],
    "newMaterials": [
        {"type": "character", "name": "李四", "roleLevel": "supporting", "description": "新出现角色，...", "archetype": "..."}
    ],
    "archiveCandidates": [
        {"name": "王五", "reason": "已死亡", "action": "deprecate"}
    ],
    "foreshadowProgress": [
        {"name": "伏笔1", "status": "推进中", "detail": "本章揭示了..."}
    ],
    "worldviewChanges": [
        {"name": "修仙境界", "type": "expansion", "detail": "新增大乘期"}
    ],
    "knowledgeChanges": [
        {"factId": "秘密关系:主角-李四", "entityName": "主角", "confidence": "certain", "sourceHow": "witnessed", "notes": "主角亲自参与秘密结盟"},
        {"factId": "秘密关系:主角-李四", "entityName": "王五", "confidence": "certain", "sourceHow": "told", "notes": "被告知了秘密结盟"},
        {"factId": "宝藏位置", "entityName": "反派", "confidence": "suspect", "sourceHow": "inferred", "notes": "反派通过线索推测出宝藏位置"}
    ]
}

整理原则：
1. 只整理，不写入数据库
2. 每个状态变化必须有明确原因
3. 优先更新已有素材，避免新建
4. ⭐主角的状态必须详细记录（HP/MP/装备/位置/心理等所有变化）
${supportingRule}
6. 👤NPC只记录身份/阵营/生死变化，其他忽略
7. 角色出场时必须按角色等级填写字段：
    ⭐主角(protagonist)：${protagonistHints.join('、')}
    🔷配角(supporting)：${supportingHints.join('、')}
    👤NPC：${npcHints.join('、')}
8. 如果角色状态未变化，不要写 stateChanges
9. 只在明确出现新内容时才创建 newMaterials
10. 世界观变化只记录"新发现/新设定"，不重复已有设定
11. 新建角色时必须设置roleLevel字段：主角"protagonist"、重要配角"supporting"、其他"npc"
12. bindChanges记录装备/功法/宠物的归属变化：
    - acquire: 获得新物品，必须指定permanence（temporary=临时持有可掠夺/semi-permanent=认主可掠夺/permanent=认主不可掠夺）
    - lose: 失去物品（lost=丢失/consumed=消耗/plundered=被掠夺）
    - changePermanence: 归属持久度变化（如临时→认主、认主→不可掠夺），permanence只能升级不能降级除非被强制剥夺
13. knowledgeChanges记录限知认知变化——谁知道了什么、怎么知道的、确信程度：
    - factId: 事实标识（如"秘密关系:角色A-角色B"、"宝藏位置"、"真实身份:角色A"）
    - entityName: 知道此事实的角色名
    - confidence: certain(确信)/suspect(怀疑)/misinformed(误信)/unknown(未知)
    - sourceHow: witnessed(亲眼)/told(听说)/inferred(推理)/discovered(发现)
    - 只记录本章新产生或变化的认知，不重复已有
    - ⚠️配角首次出场时必须记录其"人设基础事实"为certain：配角自己的身份/能力/阵营/所属势力规则是其立身之本，必须为certain，不能是suspect/unknown
    - ⚠️禁止限知偏向：主角和配角的certain事实数量比例不能超过3:1，配角不能是信息盲人
14. relationshipChanges中isSecret=true的关系会自动同步到限知系统，但knowledgeChanges可以记录更细粒度的认知变化（如推理、误信等）
14b. ⚠️强制要求：本章只要有≥2名已知角色发生互动（对话/冲突/结盟/并肩），relationshipChanges **不得为空**；
    每条必须写全 with（对象角色名）/from/to（关系起点与变化后）/reason（本章依据）/isSecret；
    关系没有变化时也要用 from==to 记录当前关系（用于长篇关系网冷启动）。
14c. 关系必须基于本章正文事实，禁止编造未出场的角色名。
15. 🔷配角出场时必须评估：本章是否体现了配角的标志性细节/独立立场/命运弧光推进？如果是，记录到personalityNote中
16. ⚠️工具人化禁令：配角stateChanges必须是主动行为（自主决策/主动战斗/主动拒绝），不能全是被动行为（被救/被修复/被告知）。如果本章配角只有被动行为，在personalityNote中标注"⚠️工具人化风险"`;
}

async function handleMaterialOrganizer(params) {
    const { projectId, chapter, materials, agentContext, context, runAgent } = params;
    const ctx = await getDataContext(projectId);
    const project = await ctx.getProject();
    const genre = resolveGenreFromProject(project);
    const genreId = genre?.id || null;
    const schema = getCharacterStateSchema(genreId);

    const chapterNum = chapter.chapterNumber;
    await stateKVIndex.setCurrentChapter(projectId, chapterNum);

    const kvSummary = await stateKVIndex.generateBriefSummary(projectId, chapterNum, genreId);
    const stateSummary = await stateKVIndex.generateDetailedSummary(projectId, chapterNum, genreId);

    agentContext.content = buildOrganizerPrompt(chapter, kvSummary, project, stateSummary, genre);

    const result = await runAgent('material-organizer', agentContext);

    let organizingPlan = null;
    try {
        organizingPlan = parseOrganizerOutput(result.response || '');
    } catch (e) {
        logger.warn('materialOrganizer', `material-organizer JSON parse failed for ch${chapterNum}:`, e.message);
    }

    // 陷阱#90防护：检测空organizingPlan，防止连锁下游问题
    // 不阻断pipeline（某些章节可能确实无角色变化），但记录warning便于排查
    warnOnEmptyOrganizingPlan(organizingPlan, chapterNum);
    warnOnDepthGaps(organizingPlan, chapterNum);   // T6：深度缺口必须可见（回填能兜，但不能静默）

    return {
        step: 'material-organizer',
        passed: true,
        organizingPlan,
        response: result.response
    };
}

function parseOrganizerOutput(text) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in organizer output');

    try {
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        const cleaned = jsonMatch[0]
            .replace(/\/\/.*$/gm, '')
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']');
        return JSON.parse(cleaned);
    }
}

module.exports = { handleMaterialOrganizer, buildOrganizerPrompt, parseOrganizerOutput };
