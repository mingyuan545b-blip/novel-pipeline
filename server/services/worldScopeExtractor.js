/**
 * worldScopeExtractor — 世界域归属LLM提取器
 *
 * 从章节内容中提取：
 * 1. 世界属性（武力体系/文化/科技/规则/危险等级）
 * 2. 势力信息（每个世界的势力格局）
 * 3. 角色穿越事件（主世界↔副本）
 * 4. 实体归属信息（哪个角色/装备/NPC属于哪个世界）
 * 5. 跨世界串台检测（副本A的NPC出现在副本B）
 */
const llm = require('./llm');
const logger = require('../shared/logger');

const SYSTEM_PROMPT = `你是一个小说世界域分析器。你的任务是分析章节内容，提取世界属性、势力格局、角色归属和穿越事件。

关键概念：
- 主世界：角色日常生活的世界
- 小世界/副本：角色穿越进入的特殊世界（如副本、秘境、异空间）
- 每个世界有独特的武力体系、文化、科技水平、势力格局
- 武力体系可多选：cultivation(修炼)/immortal(修仙)/tech(科技)/magic(魔法)/ancient-ritual(古老祭祀)/martial(武道)/psionic(异能)/faith(信仰)
- 世界类型：main(主世界)/sub(小世界)/pocket(口袋世界)/mirror(镜像世界)/secret(秘境)/dream(梦境)
- 科技水平：none(无)/low(低)/med(中)/high(高)/future(未来)
- 危险等级：safe(安全)/low(低危)/med(中危)/high(高危)/lethal(致命)
- 势力状态：active(活跃)/declining(衰退)/destroyed(覆灭)/hidden(隐世)/emerging(新兴)

输出JSON格式：
{
  "worldInfos": [
    {
      "worldId": "世界ID(主世界用main-world，副本用dungeon-序号)",
      "worldName": "世界名称",
      "worldType": "main|sub|pocket|mirror|secret|dream",
      "powerSystem": ["cultivation", "tech"],
      "culture": "文化特征描述",
      "techLevel": "none|low|med|high|future",
      "rules": "世界规则/物理法则描述",
      "dangerLevel": "safe|low|med|high|lethal",
      "entryMethod": "进入方式描述",
      "description": "世界简介"
    }
  ],
  "factions": [
    {
      "worldId": "所属世界ID",
      "name": "势力名称",
      "type": "cultivation|immortal|tech|magic|ancient-ritual|martial|psionic|faith",
      "status": "active|declining|destroyed|hidden|emerging",
      "leader": "首领姓名(可空)",
      "description": "势力简介"
    }
  ],
  "transitions": [
    { "character": "角色名", "from": "来源世界", "to": "目标世界", "chapterNumber": N }
  ],
  "entities": [
    { "name": "实体名", "entityType": "character|npc|equipment|pet|servant", "worldId": "世界ID", "worldName": "世界名", "isVisitor": false }
  ],
  "crossWorldViolations": [
    { "entity": "实体名", "homeWorld": "归属世界", "appearedIn": "出现世界", "description": "描述" }
  ],
  "crossWorldItems": [
    {
      "entityName": "物品/功法/法宝名称",
      "entityType": "equipment|technique|cultivation-method|power-system|treasure",
      "characterName": "持有者角色名",
      "originWorldId": "来源世界ID(主世界=main-world, 副本=dungeon-xxx)",
      "originWorldName": "来源世界名称",
      "originChapter": N,
      "originMethod": "defeated|gifted|picked|quest-reward|crafted|inherited|purchased|found",
      "originNote": "获取场景简述",
      "transitionFrom": "如果本章该物品从原世界被带往另一世界，填写来源世界ID",
      "transitionTo": "目标世界ID(通常是main-world)",
      "transitionNote": "跨世界原因(如：主角完成副本带回主世界)",
      "transitionChapter": N
    }
  ]
}

规则：
1. worldInfos：提取章节中出现的所有世界的属性，包括主世界和副本
2. factions：提取章节中明确提及的势力，必须绑定到具体世界
3. powerSystem可多选，如某世界同时有修炼和科技
4. isVisitor=true表示该实体是穿越者（不属于当前世界但合法出现）
5. 只有明确出现在当前章节的实体才提取
6. 跨世界串台：非穿越者出现在非归属世界=违规
7. crossWorldItems：仅提取"非主世界原生且被角色带出"的物品/功法/法宝/修炼法/武力体系。
   - 必须有明确的获取动作(击败/拾取/赠送/任务奖励等)
   - 必须记录来源世界(originWorldId)和获取章节(originChapter)
   - 若本章发生跨世界转移(如主角离副本回主世界)，填transitionFrom/transitionTo
   - 主世界原生物品不提取
8. 只输出JSON，不要其他内容`;

const EXTRACT_PROMPTS = {
    basic: `分析以下章节内容，提取出场实体的世界归属和世界属性。只提取worldInfos、factions和entities，忽略transitions和crossWorldViolations。`,
    full: `分析以下章节内容，提取世界属性、势力格局、出场实体的世界归属、穿越事件和跨世界串台违规。`
};

function parseWorldScopeResponse(text) {
    const empty = { worldInfos: [], factions: [], transitions: [], entities: [], crossWorldViolations: [], crossWorldItems: [] };
    if (!text || text.trim().length === 0) return empty;
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return empty;
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            worldInfos: Array.isArray(parsed.worldInfos) ? parsed.worldInfos : [],
            factions: Array.isArray(parsed.factions) ? parsed.factions : [],
            transitions: Array.isArray(parsed.transitions) ? parsed.transitions : [],
            entities: Array.isArray(parsed.entities) ? parsed.entities : [],
            crossWorldViolations: Array.isArray(parsed.crossWorldViolations) ? parsed.crossWorldViolations : [],
            crossWorldItems: Array.isArray(parsed.crossWorldItems) ? parsed.crossWorldItems : []
        };
    } catch (err) {
        logger.warn('worldScopeExtractor', `Failed to parse response: ${err.message}`);
        return empty;
    }
}

async function extractWorldScopeFromChapter(projectId, chapterNumber, chapterContent, level) {
    if (!chapterContent || chapterContent.length < 100) {
        return { worldInfos: [], factions: [], transitions: [], entities: [], crossWorldViolations: [], crossWorldItems: [] };
    }

    const prompt = EXTRACT_PROMPTS[level] || EXTRACT_PROMPTS.basic;
    const truncated = chapterContent.substring(0, 8000);

    try {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `${prompt}\n\n第${chapterNumber}章内容：\n${truncated}` }
        ];
        const result = await llm.chat(messages, {
            maxTokens: 2048,
            temperature: 0.3,
            enableThinking: false
        });
        const text = result?.choices?.[0]?.message?.content || result?.content || result?.response || '';
        logger.info('worldScope', `LLM response for ch${chapterNumber}: length=${text.length}`);
        return parseWorldScopeResponse(text);
    } catch (err) {
        logger.warn('worldScopeExtractor', `LLM extraction failed for ch${chapterNumber}: ${err.message}`);
        return { worldInfos: [], factions: [], transitions: [], entities: [], crossWorldViolations: [], crossWorldItems: [] };
    }
}

module.exports = { extractWorldScopeFromChapter };
