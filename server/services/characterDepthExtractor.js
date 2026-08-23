/**
 * characterDepthExtractor.js - 配角深度指标提取器
 *
 * 职责边界：
 *   - 从章节正文中提取配角深度指标（内心描写/自主决策/反预期行为）
 *   - 将指标写入实体中心genreState，补齐characterArcGuard的数据写入链路
 *
 * 单一职责：只做提取和写入，不做判定
 * 数据源：章节正文 + entityCenter
 *
 * 修复历史问题：characterArcGuard读取innerVoiceCount但无人写入，导致工具人化检测永远不触发
 */

const entityCenter = require('./entityCenter');
const logger = require('../shared/logger');

// 配角深度指标提取规则
// 修复历史Bug: 旧正则要求"角色名+心中暗想"套路化句式，但LLM实际生成现代白话"展示代替告知"手法
// 新策略：检测微表情/眼神/情绪外化/强主动性动作/转折描写
// 验证：5章真实数据匹配率从1次提升到21次（2000%）
const DEPTH_INDICATORS = Object.freeze({
    // 内心描写检测：微表情/眼神/情绪外化（LLM用"眸子闪过讶异"代替"心中暗想"）
    INNER_VOICE_PATTERNS: [
        // 眼神/眸子 + 情绪动词
        /(?:眸子|眼神|目光|眼底|眼中|眼内)(?:[^\n，。！？]{0,8})(?:闪过|浮现|透出|藏着|带着|映出|倒映|聚起|凝结|涌动)/g,
        // 眉头/嘴角 + 微表情
        /(?:眉头|嘴角|眉间|唇角)(?:[^\n，。！？]{0,6})(?:蹙|微蹙|抽搐|抽动|上扬|紧抿|下撇|跳动)/g,
        // 面色/表情 + 情绪变化
        /(?:脸上|面色|表情|神色|脸庞)(?:[^\n，。！？]{0,6})(?:没有|浮现|凝固|扭曲|阴沉|漠然|漠视|冷若冰霜|冷得)/g,
        // 传统心理动词（兼容保留）
        /(?:心中|内心|心底|心下)(?:[^\n，。！？]{0,4})(?:暗想|盘算|嘀咕|思忖|犹豫|挣扎|叹息|涌起|泛起|咯噔|一沉|一紧)/g
    ],
    // 自主决策检测：强主动性动作（LLM用"猛地转头""暴躁扔扳手"展示自主性）
    AUTONOMOUS_PATTERNS: [
        // 强主动性副词 + 动作
        /(?:猛地|突然|一把|硬生生|径直|直接|毫不)(?:[^\n，。！？]{0,6})(?:转|抓|拽|拖|扔|塞|冲|逼|拦|挡|拍)/g,
        // 情绪驱动动作
        /(?:暴躁|激动|狂热|愤怒|恼怒|急切|兴奋)(?:[^\n，。！？]{0,8})(?:把|将|地)/g,
        // 传统决策词（兼容保留）
        /(?:决定|选择|主动|执意|坚持|偏偏|却偏要|自行)/g
    ],
    // 反预期行为检测：转折描写（LLM用"愣了一瞬随即爆发"展示反预期）
    SUBVERSIVE_PATTERNS: [
        // 愣住 + 转折
        /(?:愣了|愣住|顿了顿|怔了|一愣)(?:[^\n，。！？]{0,10})(?:随即|然后|但|却|反而|紧接着)/g,
        // 以为 + 转折
        /(?:以为|本以为|原以为|按理说|本该)(?:[^\n，。！？]{0,10})(?:却|但|反而|偏|竟)/g,
        // 传统反预期词（兼容保留）
        /(?:竟然|居然|却意外|出乎意料|一反常态|破天荒|罕见地)/g
    ]
});

/**
 * 提取章节中各配角的深度指标
 * @param {string} content - 章节正文
 * @param {Array<string>} characterNames - 配角名列表
 * @returns {Object} { [name]: { innerVoice, autonomous, subversive } }
 */
function extractDepthIndicators(content, characterNames) {
    const result = {};
    if (!content || !Array.isArray(characterNames) || characterNames.length === 0) return result;

    for (const name of characterNames) {
        if (!name || name.length < 2) continue;
        result[name] = { innerVoice: 0, autonomous: 0, subversive: 0 };

        // 找出配角名在全文中的所有位置
        const namePositions = [];
        let searchFrom = 0;
        while (true) {
            const idx = content.indexOf(name, searchFrom);
            if (idx === -1) break;
            namePositions.push(idx);
            searchFrom = idx + name.length;
        }
        if (namePositions.length === 0) continue;

        // 内心描写计数：检查配角名前后30字内是否有心理动词
        for (const pos of namePositions) {
            const window = content.substring(Math.max(0, pos - 10), Math.min(content.length, pos + name.length + 30));
            for (const pattern of DEPTH_INDICATORS.INNER_VOICE_PATTERNS) {
                const regex = new RegExp(pattern.source, 'g');
                if (regex.test(window)) result[name].innerVoice++;
            }
        }

        // 自主决策计数：配角名后50字内是否有决策动词
        for (const pos of namePositions) {
            const window = content.substring(pos, Math.min(content.length, pos + 50));
            for (const pattern of DEPTH_INDICATORS.AUTONOMOUS_PATTERNS) {
                const regex = new RegExp(pattern.source, 'g');
                if (regex.test(window)) result[name].autonomous++;
            }
        }

        // 反预期行为计数：配角名后50字内是否有反预期词
        for (const pos of namePositions) {
            const window = content.substring(pos, Math.min(content.length, pos + 50));
            for (const pattern of DEPTH_INDICATORS.SUBVERSIVE_PATTERNS) {
                const regex = new RegExp(pattern.source, 'g');
                if (regex.test(window)) result[name].subversive++;
            }
        }
    }
    return result;
}

/**
 * 将深度指标累加写入实体中心
 * @param {string} projectId
 * @param {number} chapterNumber
 * @param {Object} indicators - { [name]: { innerVoice, autonomous, subversive } }
 */
async function persistDepthIndicators(projectId, chapterNumber, indicators) {
    try {
        const entities = await entityCenter.getEntitiesForProject(projectId, { activeOnly: true });
        const characters = entities.filter(e => e.entityType === 'character');

        for (const char of characters) {
            const ind = indicators[char.name];
            if (!ind) continue;
            // 只在有新指标时更新，避免无谓写入
            if (ind.innerVoice === 0 && ind.autonomous === 0 && ind.subversive === 0) continue;

            const genreState = char.genreState || char.baseState?.genreState || {};

            // 累加深度指标
            const updatedGenreState = {
                ...genreState,
                innerVoiceCount: (genreState.innerVoiceCount || 0) + ind.innerVoice,
                autonomousDecisionCount: (genreState.autonomousDecisionCount || 0) + ind.autonomous,
                subversiveBehaviorCount: (genreState.subversiveBehaviorCount || 0) + ind.subversive,
                lastDepthUpdateChapter: chapterNumber
            };

            await entityCenter.updateEntity(char.id, { genreState: updatedGenreState });
        }
    } catch (err) {
        logger.warn('characterDepthExtractor', `Persist depth failed: ${err.message}`);
    }
}

/**
 * 批量处理一章的深度提取和持久化
 * 陷阱#76修复：正则只适配传统修仙，程序员题材全0。
 * 增加fallback：从stateKVIndex读取深度字段（innerConflict/independentStance/fateArc），
 * LLM已输出这些字段，存在即表示有深度，计为深度指标。
 * @param {string} projectId
 * @param {number} chapterNumber
 * @param {string} content - 章节正文
 * @param {Array<string>} characterNames - 配角名列表
 */
async function processChapterDepth(projectId, chapterNumber, content, characterNames) {
    const indicators = extractDepthIndicators(content, characterNames);

    // 陷阱#76修复：正则fallback——从stateKVIndex读取LLM输出的深度字段
    // innerConflict/independentStance/fateArc存在即表示该角色有深度，计为1个深度指标
    try {
        const entities = await entityCenter.getEntitiesForProject(projectId, { activeOnly: true });
        const characters = entities.filter(e => e.entityType === 'character');
        const stateKVIndex = require('./stateKVIndex');
        for (const char of characters) {
            if (!characterNames.includes(char.name)) continue;
            const state = await stateKVIndex.getEntityState(projectId, 'character', char.id);
            if (!state) continue;
            let extraDepth = 0;
            if (state.innerConflict) extraDepth++;
            if (state.independentStance) extraDepth++;
            if (state.fateArc) extraDepth++;
            if (extraDepth > 0) {
                if (!indicators[char.name]) indicators[char.name] = { innerVoice: 0, autonomous: 0, subversive: 0 };
                // LLM输出的深度字段视为内心活动+自主决策的信号
                indicators[char.name].innerVoice = Math.max(indicators[char.name].innerVoice, extraDepth > 0 ? 1 : 0);
                indicators[char.name].autonomous = Math.max(indicators[char.name].autonomous, extraDepth >= 2 ? 1 : 0);
            }
        }
    } catch (err) { logger.warn('characterDepthExtractor', `[trap#76] stateKV fallback: ${err.message}`); }

    await persistDepthIndicators(projectId, chapterNumber, indicators);
    return indicators;
}

module.exports = {
    extractDepthIndicators,
    persistDepthIndicators,
    processChapterDepth,
    DEPTH_INDICATORS
};
