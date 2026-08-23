// 素材深度校验阈值（禁止硬编码业务值的例外：阈值必须显式定义供调优）
// 独立成模块，避免 materialDepthChecker 与其提取文件之间的循环依赖
const DEPTH_THRESHOLDS = {
    PROTAGONIST_MIN_INNER_VOICE: 1,
    PROTAGONIST_MIN_AUTONOMOUS: 0,
    SUPPORTING_MIN_DEPTH_SUM: 1,
    MIN_FACTS_PER_CHAPTER: 1,
    MIN_ACCESS_PER_CHAPTER: 1,
    MIN_QUESTS_FOR_PROJECT: 1
};

module.exports = { DEPTH_THRESHOLDS };
