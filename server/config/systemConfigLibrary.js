/**
 * systemConfigLibrary — 藏经阁（技法库）相关配置
 *
 * 从 systemConfigDefs.js 拆出：该文件为配置聚合入口，加入藏经阁配置后超过200行硬上限
 * （见 scripts/audit-hardcode.js 的 file-too-long 检查）。
 * 文件位置：server/config/systemConfigLibrary.js
 */

const LIBRARY_EXTRACT = {
    // 单次送入LLM的文本长度（按章节边界切块后的目标值）
    CHUNK_CHARS: 12000,
    // 每个维度送LLM的采样窗口数（全书中等距取窗口，含首尾块）。窗口越多覆盖越全，成本线性上升
    WINDOWS_PER_DIMENSION: 3,
    // 单次提取最多处理的文本块数（成本上限保护）
    MAX_CHUNKS: 12,
    // 单次提取最多覆盖的技法维度数
    MAX_DIMENSIONS: 10,
    // 低于此长度视为无效输入
    MIN_TEXT_CHARS: 2000,
    // 每个维度期望产出的技法条数上限（写进提示词）
    TECHNIQUES_PER_DIM: 4,
    // 提取接口允许的最大正文字符数（整本书级别）。
    // 注意：inputSanitizer 默认把请求体字符串截断到100000，长文本接口必须走此上限，
    //       否则正文被静默截断（见 docs/sop/00-陷阱清单.md #115）
    MAX_TEXT_CHARS: 3000000,
    // 单次LLM调用超时（提取是大输入长输出场景）
    REQUEST_TIMEOUT_MS: 600000,
};

module.exports = { LIBRARY_EXTRACT };
