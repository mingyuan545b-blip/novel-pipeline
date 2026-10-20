const { getVolumeOrder } = require('../volumeHelpers');
const logger = require('../../../shared/logger');

const MATERIAL_TYPE_RULES = `【素材类型选择规则——严格遵守】
- 含"结构+功能+触发"的装置/机制 → type: "mechanism"（不是foreshadowing！）
- 含"身份+性格+动机"的人物 → type: "character"
- 含"边界+规则+违反后果"的世界观 → type: "worldview"
- 含"预期回收窗口+关联角色"的伏笔悬念 → type: "foreshadowing"
- 含"装备/道具/工具"的物品 → type: "equipment"
- 含"关系+互动+信任变化"的人际 → type: "relationship"
- 含"写作手法/叙事技巧"的方法论 → type: "writing-technique"

【绝对禁止】
- ❌ 不要把装置/机制标记为foreshadowing！铁皮瓦片导流层、柳枝风道等是mechanism
- ❌ 不要把归档记录/archiveLog作为素材创建！归档记录只写入archiveLog字段
- ❌ 不要把伏笔状态追踪表作为素材创建！状态更新用update action
- ❌ 不要创建名为"已回收"/"Ch43-Archive-001"之类的素材！这些是归档记录不是素材
- 不要用details字段！必须用content字段，且content必须是纯文本字符串，不要用JSON对象
- 不要用data字段！必须用content字段
- 不要用info字段！必须用content字段`;

const OUTPUT_FORMAT_RULES = `【输出JSON格式规范——严格遵守】
每个update条目必须包含以下字段：
{
  "type": "素材类型(character/worldview/foreshadowing/equipment等)",
  "name": "素材名称",
  "action": "create或update或retire或deprecate或recycle",
  "content": "纯文本字符串，用【标签】值 格式组织内容，不要用JSON对象！",
  "reason": "操作原因",
  "parentFaction": "势力素材ID(character必填)",
  "parentPlane": "位面素材ID(小世界素材必填)"
}

⚠️ content字段规范：
- 必须是字符串类型，不要用对象/字典
- 格式示例："【所属位面】主世界\\n【身份】外门弟子\\n【核心欲望】存活"
- 不要写成 {"所属位面":"主世界","身份":"外门弟子"} 这种JSON对象
- 不要用details字段，只用content字段

【素材膨胀控制——严格执行】
- 每章最多创建2个新素材，优先更新已有素材而非新建
- 已回收伏笔必须标记action:recycle，不要留在素材库
- 本章未出场的角色不要创建新素材，只在已有素材中更新状态
- 一次性道具/信息用完即标记action:retire
- 超过5章未更新的非核心素材应标记action:deprecate`;

const CREATION_STANDARDS = `【素材创作标准（新建素材必须满足）】
- 人物(character): 必须包含 核心欲望 + 内在矛盾 + 行为模式
- 世界观(worldview): 必须包含 边界条件 + 违反后果
- 战力体系(power-system): 必须包含 升级条件 + 代价/限制
- 伏笔(foreshadowing): 必须包含 预期回收窗口 + 关联角色
不满足标准的素材将在日志中标记为校验未通过。`;

const CATCHPHRASE_RULES = `【金句/热梗提取规则】
从正文中提取以下内容作为catchphrase类型素材：
- 角色口头禅/标志性台词
- 有传播力的金句（读者会记住的那种）
- 创造性的委婉暗语（如"卸载QQ=绝育"）
- 跨界混搭名场面（如"林黛玉大战孙悟空"）
提取格式: type=catchphrase, name=金句内容, content=出处场景+角色+上下文`;

async function getVolumeGuidance(projectId, chapterNum, protagonistName) {
    try {
        const volumeOrder = await getVolumeOrder(projectId);
        const currentVolume = volumeOrder.volumeOrder.find(v => {
            const match = v.chapters.match(/Ch(\d+)-(\d+)/);
            if (match) return chapterNum >= parseInt(match[1]) && chapterNum <= parseInt(match[2]);
            return false;
        });
        if (!currentVolume) return '';

        return `\n\n【⚠️ 当前章节位面归属——强制执行】
第${chapterNum}章属于 第${currentVolume.volume}卷 (${currentVolume.chapters})，小世界: ${currentVolume.subplaneName} (ID: ${currentVolume.subplaneId})

归属规则：
- 本章出现的所有角色/装备/机制/地点/势力，如果属于小世界"${currentVolume.subplaneName}"，必须设置 parentPlane: "${currentVolume.subplaneId}"
- 主角·${protagonistName}属于主世界，parentPlane留空！主角随身携带的装备也属于主世界，parentPlane留空
- 主角当前在小世界活动，设置 currentPlaneId: "${currentVolume.subplaneId}"
- 小世界角色必须同时设置 parentFaction 为该位面下的势力ID
- 小世界装备/道具必须设置 parentPlane，可设parentFaction为该位面下对应势力
- 伏笔(foreshadowing)和世界观(worldview)根据内容判断归属`;
    } catch (e) {
        logger.warn('materialPrompt', '读取volume-order失败:', { errorMessage: e.message });
        return '';
    }
}

function getFlavorRules(projectId, protagonistName) {
    const dialectRegistry = require('../../dialectRegistry');
    const speechStyleRegistry = require('../../speechStyleRegistry');

    const availableDialects = dialectRegistry.getAllRegions();
    const availableStyles = speechStyleRegistry.getAllStyles();

    if (availableDialects.length === 0 && availableStyles.length === 0) return '';

    const dialectList = availableDialects.map(d => `${d.region}(${d.label})`).join('、');
    const styleList = availableStyles.map(s => `${s.id}(${s.label})`).join('、');

    let content = `
【角色说话风味标注规则——必须遵守】
每个角色素材有两条独立的说话风味轴，可分别标注也可叠加：

【轴1：方言（你从哪来）】
可用方言: ${dialectList}
强度: light(轻度)/medium(中度)/heavy(重度)
标注方式: "【方言】河南 | 中度" 或 "【方言】东北 | 轻度"

【轴2：说话风格（你是谁）】
可用风格: ${styleList}
强度: light(轻度)/medium(中度)/heavy(重度)
标注方式: "【风格】abstract | 中度" 或 "【风格】euphemism | 轻度"

组合示例:
- "【方言】东北 | 中度" + "【风格】abstract | 轻度" = 东北味抽象话
- "【方言】上海 | 中度" + "【风格】euphemism | 中度" = 嗲糯委婉话
- "【风格】chinglish | 中度" = 纯中式英语（无方言叠加）

判定规则:
- 主角默认与项目设定一致（当前项目主角${protagonistName}）
- NPC根据出身地标注方言，根据性格标注风格
- 同一小世界的角色可能来自不同地区，不要一刀切
- 方言和风格服务于角色辨识度，同一场景中不同风味的角色更容易区分`;

    try {
        const namingStyleRegistry = require('../../namingStyleRegistry');
        const allNamingStyles = namingStyleRegistry.list();
        if (allNamingStyles.length > 0) {
            const namingList = allNamingStyles.map(s => `${s.id}(${s.label}·${s.tag})`).join('、');
            content += `

【轴3：命名风格（你怎么取名）】
可用命名风格: ${namingList}
强度: light(轻度)/medium(中度)/heavy(重度)
标注方式: "【命名】poetic-imagery | 中度" 或 "【命名】jianghu-epithet | 重度"

规则:
- 命名风格决定角色名字的取法，不是说话方式
- 项目级命名风格由题材自动推断，角色级可覆盖
- 有命名风格的角色，新出场NPC名字必须符合该风格`;
        }
    } catch (_) { logger.warn('materialPrompt', _.message || _); }  // DEGRADE: 影响=素材提示词构建 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)

    return content;
}

async function buildMaterialManagerPrompt(params) {
    const { chapter, materialSummary, archiveHints, styleProfile, context } = params;
    const chapterNum = chapter.chapterNumber;
    const protagonistName = styleProfile?.protagonistName || '主角';

    const corePrompt = `请阅读定稿正文并更新素材库。

请执行以下操作：
1. 新建/更新的素材（updates）
2. 归档检查（必须逐项检查归档清单）：
   - 是否有角色在本章死亡或永久离场？→ deprecate
   - 是否有伏笔在本章完成回收？→ recycle
   - 是否有装备/道具/技能被替代或不再使用？→ retire
   - 是否有组织解散或地点毁灭？→ deprecate
   - 是否有一次性信息已使用完毕？→ recycle
3. 将归档结果写入archiveLog（不能为空，必须是字符串数组，如["记录1","记录2"]）

${MATERIAL_TYPE_RULES}

${OUTPUT_FORMAT_RULES}`;

    const creationStandardsSection = `\n\n${CREATION_STANDARDS}`;
    const volumeGuidance = await getVolumeGuidance(chapter.projectId, chapterNum, protagonistName);
    const flavorRules = getFlavorRules(chapter.projectId, protagonistName);
    const catchphraseSection = CATCHPHRASE_RULES;
    const materialGuidance = context.materialGuidance ? `\n\n【定稿人素材更新指引】\n${context.materialGuidance}` : '';

    return `${corePrompt}${creationStandardsSection}${volumeGuidance}${flavorRules}\n\n${catchphraseSection}${materialGuidance}`;
}

module.exports = {
    buildMaterialManagerPrompt,
    getVolumeGuidance,
    getFlavorRules,
    MATERIAL_TYPE_RULES,
    OUTPUT_FORMAT_RULES,
    CREATION_STANDARDS,
    CATCHPHRASE_RULES
};
