/**
 * Pipeline契约错误码定义
 * 格式: [步骤前缀]-[序号]
 * 每个错误码对应唯一问题，可直接定位根因
 */
const PIPELINE_ERROR_CODES = {
    // ── Writer步骤 W-xxx ──
    'W-001': { step: 'writer', severity: 'CRITICAL', message: '素材数量为0，writer无法获取角色名/职业设定',
        cause: 'materialIndex.getMaterialsForScene返回空且store.queryItems也为空', fix: '检查素材是否已生成：GET /api/materials?projectId={pid}' },
    'W-002': { step: 'writer', severity: 'CRITICAL', message: '角色类素材为0，nameLock无法锁定角色名',
        cause: '素材中无type=character的条目', fix: '检查entity-registry是否有角色实体：GET /api/entity-registry?projectId={pid}' },
    'W-003': { step: 'writer', severity: 'HIGH', message: '记忆上下文加载失败',
        cause: 'memory.assembleContext抛出异常', fix: '检查memory系统：memoryLayerBuilder的setLayerFn参数是否正确传递' },
    'W-004': { step: 'writer', severity: 'HIGH', message: '项目配置缺失genre信息',
        cause: 'detectGenre返回null，styleProfile可能为空或无法匹配', fix: '检查project.styleProfile是否有genre字段，确认genreConfig.js的GENRE_REGISTRY能匹配' },
    'W-005': { step: 'writer', severity: 'MEDIUM', message: 'config.validation缺失dialogueRatioMax',
        cause: 'resolveConfig返回的validation中没有dialogueRatioMax', fix: '检查题材插件的pipelineConfig.validation.dialogueRatioMax是否定义' },
    'W-006': { step: 'writer', severity: 'HIGH', message: '章节缺少outline，writer无法按大纲写作',
        cause: 'chapter.outline为空或过短', fix: '检查大纲生成步骤是否成功写入outline' },

    // ── Review步骤 R-xxx ──
    'R-001': { step: 'review', severity: 'CRITICAL', message: '审核时章节content为空或过短',
        cause: 'chapter.content为空或<100字', fix: '检查writer步骤是否成功写入content' },
    'R-002': { step: 'review', severity: 'HIGH', message: '审核时素材数据为空，无法校验角色名一致性',
        cause: 'review步骤获取的materials为空', fix: '同W-001' },
    'R-003': { step: 'review', severity: 'MEDIUM', message: '初审缺少genre信息，无法执行题材特定审核规则',
        cause: 'detectGenre返回null', fix: '检查project.styleProfile' },
    'R-004': { step: 'review', severity: 'HIGH', message: '复审/定稿时缺少初审结果',
        cause: 'chapter.firstReviewOutput为空', fix: '检查first-review步骤是否成功执行' },

    // ── Reviser步骤 RV-xxx ──
    'RV-001': { step: 'reviser', severity: 'HIGH', message: '修改员缺少审核反馈',
        cause: 'chapter.firstReviewOutput和secondReviewOutput都为空', fix: '检查review步骤是否成功执行' },

    // ── Final-Editor步骤 FE-xxx ──
    'FE-001': { step: 'final-editor', severity: 'MEDIUM', message: '定稿时缺少复审结果',
        cause: 'chapter.secondReviewOutput为空', fix: '检查second-review步骤是否成功执行' },

    // ── Reader步骤 RD-xxx ──
    'RD-001': { step: 'reader', severity: 'CRITICAL', message: '阅读者无可读章节',
        cause: 'chapter.content为空', fix: '检查writer步骤是否成功写入content' },

    // ── Material步骤 M-xxx ──
    'M-001': { step: 'material', severity: 'HIGH', message: '素材管理步骤素材为空',
        cause: 'material-manager/organizer/registrar获取的materials为空', fix: '检查素材生成是否完成' },
    'M-002': { step: 'material', severity: 'HIGH', message: '素材注册时store查询失败',
        cause: 'store.queryItems或store.setItem抛出异常', fix: '检查store连接和权限' },

    // ── Memory步骤 MEM-xxx ──
    'MEM-001': { step: 'memory', severity: 'CRITICAL', message: 'assembleContext的setLayerFn不是函数',
        cause: 'buildFn.buildL0等函数调用时未传入setLayerFn参数', fix: '检查memoryContext.js和memoryLifecycle.js中buildFn调用是否传入setLayerFn' },
    'MEM-002': { step: 'memory', severity: 'HIGH', message: '记忆层构建失败',
        cause: 'buildL0-L4中某层构建抛出异常', fix: '检查对应层的store读取逻辑' },

    // ── Config步骤 CFG-xxx ──
    'CFG-001': { step: 'config', severity: 'CRITICAL', message: 'resolveConfig返回null',
        cause: 'detectGenre无法匹配项目的styleProfile', fix: '检查project.styleProfile.genre是否在genreConfig.js的GENRE_REGISTRY中有对应条目' },
    'CFG-002': { step: 'config', severity: 'HIGH', message: '题材特定配置缺失',
        cause: 'contentMetrics.TOMATO_SUBGENRE_CONFIGS缺少对应题材', fix: '在contentMetrics.js中添加对应题材的配置' },

    // ── 通用 GEN-xxx ──
    'GEN-001': { step: 'general', severity: 'CRITICAL', message: '章节不存在',
        cause: 'store.getItem("chapters", chapterId)返回null', fix: '检查chapters表是否有对应记录' },
    'GEN-002': { step: 'general', severity: 'CRITICAL', message: '项目不存在',
        cause: 'store.getItem("projects", projectId)返回null', fix: '检查projects表是否有对应记录' },

    // ── 输出契约 WO-xxx (Writer Output) ──
    'WO-001': { step: 'writer', severity: 'CRITICAL', message: 'writer输出必须包含正文content',
        cause: 'writer返回的content为空或<100字', fix: '检查writer agent是否返回了有效正文，可能是LLM用全部token做推理' },
    'WO-002': { step: 'writer', severity: 'HIGH', message: 'writer输出了审核报告格式而非正文',
        cause: 'writer返回的content以"初审结果"或"审核概要"开头', fix: '检查writer prompt是否被错误注入了审核指令' },
    'WO-003': { step: 'writer', severity: 'HIGH', message: 'writer输出未包含任何素材中的角色名',
        cause: 'content中未出现素材库character类型素材的name', fix: '检查素材是否正确传入writer，以及nameLock是否生效' },
    'WO-004': { step: 'writer', severity: 'CRITICAL', message: 'writer输出字数低于rejectMin',
        cause: 'content字数低于配置的rejectMin', fix: '检查writer prompt中的字数要求，或增加rejectMin配置' },

    // ── 输出契约 RO-xxx (Review Output) ──
    'RO-001': { step: 'review', severity: 'HIGH', message: 'review输出缺少可解析的JSON(passed字段)',
        cause: 'review返回的文本中不包含"passed"关键字', fix: '检查review agent是否按格式输出，可能需要fallback到Markdown分析' },
    'RO-002': { step: 'review', severity: 'MEDIUM', message: 'review输出中角色名与素材库不一致',
        cause: 'review的issues中提到了素材库中不存在的角色名或设定', fix: '检查review是否幻觉了角色设定（如"纹身师"而非"钟表修复师"）' },
    'RO-003': { step: 'review', severity: 'HIGH', message: '复审输出缺少可解析的JSON(passed字段)',
        cause: 'second-review返回的文本中不包含"passed"关键字', fix: '同RO-001' },

    // ── 输出契约 FEO-xxx (Final Editor Output) ──
    'FEO-001': { step: 'final-editor', severity: 'CRITICAL', message: '定稿输出缺少approved字段',
        cause: 'final-editor返回的文本中不包含"approved"关键字', fix: '检查final-editor agent是否按格式输出' },

    // ── 输出契约 RVO-xxx (Reviser Output) ──
    'RVO-001': { step: 'reviser', severity: 'HIGH', message: '修改后content长度低于原文50%',
        cause: 'reviser返回的正文长度骤降，可能丢失了内容', fix: '检查reviser prompt是否导致截断，或回退到原文' },
    'RVO-002': { step: 'reviser', severity: 'HIGH', message: '修改后content未包含素材中的角色名',
        cause: 'reviser修改后正文丢失了角色名', fix: '检查reviser是否保留了角色名，或回退到原文' },

    // ── 输出契约 PO-xxx (Polisher Output) ──
    'PO-001': { step: 'polisher', severity: 'HIGH', message: '润色输出长度低于输入80%',
        cause: 'polisher大幅缩减了正文', fix: '检查polisher prompt是否导致截断' },

    // ── 输出契约 RDO-xxx (Reader Output) ──
    'RDO-001': { step: 'reader', severity: 'MEDIUM', message: '阅读者输出缺少hardIssues字段',
        cause: 'reader返回的JSON中不包含hardIssues', fix: '检查reader agent是否按格式输出' },

    // ── 输出契约 MO-xxx (Material Output) ──
    'MO-001': { step: 'material', severity: 'MEDIUM', message: '素材管理步骤未产生任何操作',
        cause: 'material-manager/organizer/registrar未产生任何更新操作', fix: '检查素材管理agent是否正确解析了章节内容' },

    // ── 预检 PF-xxx (Preflight) ──
    'PF-OG-001': { step: 'outline-generator', severity: 'CRITICAL', message: '预检: 项目信息必须存在',
        cause: 'outline-generator步骤无法获取项目数据', fix: '检查projects表是否有对应记录' },
    'PF-OG-002': { step: 'outline-generator', severity: 'HIGH', message: '预检: 题材信息必须可解析',
        cause: '项目genre无法解析为题材插件', fix: '检查project.styleProfile.genre是否正确' },
    'PF-WR-001': { step: 'writer', severity: 'CRITICAL', message: '预检: 章节大纲必须存在',
        cause: 'writer步骤无法获取章节大纲', fix: '检查大纲生成步骤是否成功写入outline' },
    'PF-WR-002': { step: 'writer', severity: 'HIGH', message: '预检: 素材列表必须可获取',
        cause: 'writer步骤无法获取素材列表', fix: '检查素材生成步骤是否完成' },
    'PF-WR-003': { step: 'writer', severity: 'CRITICAL', message: '预检: 项目信息必须存在',
        cause: 'writer步骤无法获取项目数据', fix: '检查projects表是否有对应记录' },
    'PF-FR-001': { step: 'first-review', severity: 'CRITICAL', message: '预检: 章节正文必须存在',
        cause: 'first-review步骤无法获取章节正文', fix: '检查writer步骤是否成功写入content' },
    'PF-FR-002': { step: 'first-review', severity: 'HIGH', message: '预检: 项目信息必须存在',
        cause: 'first-review步骤无法获取项目数据', fix: '检查projects表是否有对应记录' },
    'PF-FA-001': { step: 'fast-review', severity: 'CRITICAL', message: '预检: 章节正文必须存在',
        cause: 'fast-review步骤无法获取章节正文', fix: '检查writer步骤是否成功写入content' },
    'PF-FA-002': { step: 'fast-review', severity: 'HIGH', message: '预检: 项目信息必须存在',
        cause: 'fast-review步骤无法获取项目数据', fix: '检查projects表是否有对应记录' },
    'PF-SR-001': { step: 'second-review', severity: 'CRITICAL', message: '预检: 章节正文必须存在',
        cause: 'second-review步骤无法获取章节正文', fix: '检查writer/reviser步骤是否成功写入content' },
    'PF-SR-002': { step: 'second-review', severity: 'HIGH', message: '预检: 初审结果必须存在',
        cause: 'second-review步骤无法获取firstReviewOutput', fix: '检查first-review步骤是否成功执行' },
    'PF-FE-001': { step: 'final-editor', severity: 'CRITICAL', message: '预检: 章节正文必须存在',
        cause: 'final-editor步骤无法获取章节正文', fix: '检查writer/reviser步骤是否成功写入content' },
    'PF-FE-002': { step: 'final-editor', severity: 'CRITICAL', message: '预检: 初审结果必须存在',
        cause: 'final-editor步骤无法获取firstReviewOutput', fix: '检查first-review步骤是否成功执行' },
    'PF-PO-001': { step: 'polisher', severity: 'CRITICAL', message: '预检: 章节正文必须存在',
        cause: 'polisher步骤无法获取章节正文', fix: '检查前序步骤是否成功写入content' },
    'PF-MM-001': { step: 'material-manager', severity: 'HIGH', message: '预检: 素材列表必须可获取',
        cause: 'material-manager步骤无法获取素材列表', fix: '检查素材生成步骤是否完成' },
    'PF-MM-002': { step: 'material-manager', severity: 'CRITICAL', message: '预检: 章节信息必须存在',
        cause: 'material-manager步骤无法获取章节数据', fix: '检查chapters表是否有对应记录' },
    'PF-CC-001': { step: 'consistency-constraint', severity: 'CRITICAL', message: '预检: 项目信息必须存在',
        cause: 'consistency-constraint步骤无法获取项目数据', fix: '检查projects表是否有对应记录' },

    // ── 污染检测 P-xxx (Pollution) ──
    'P-001': { step: 'general', severity: 'HIGH', message: '正文中出现素材库外的角色名',
        cause: 'writer/reviser自创了素材库中不存在的角色', fix: '检查writer prompt的nameLock是否生效，或添加缺失角色到素材库' },
    'P-002': { step: 'material', severity: 'MEDIUM', message: '素材库中存在重复素材',
        cause: '同名或内容高度相似的素材被重复创建', fix: '检查material-registrar的去重逻辑，或手动合并重复素材' },
    'P-003': { step: 'review', severity: 'MEDIUM', message: '审核输出中存在设定偏移',
        cause: 'review幻觉了素材中不存在的角色设定', fix: '检查review prompt是否注入了正确的角色素材信息' },
};

/**
 * 根据错误码创建PipelineContractError
 */
class PipelineContractError extends Error {
    constructor(code, context = {}) {
        const def = PIPELINE_ERROR_CODES[code];
        if (!def) throw new Error(`Unknown pipeline error code: ${code}`);
        const detail = context.detail ? ` | ${context.detail}` : '';
        super(`[${code}] ${def.message}${detail} → 修复: ${def.fix}`);
        this.code = code;
        this.severity = def.severity;
        this.step = def.step;
        this.cause = def.cause;
        this.fixGuide = def.fix;
        this.context = context;
    }
}

/**
 * 获取错误码定义
 */
function getErrorDef(code) {
    return PIPELINE_ERROR_CODES[code] || null;
}

/**
 * 列出某步骤的所有错误码
 */
function getErrorsByStep(step) {
    return Object.entries(PIPELINE_ERROR_CODES)
        .filter(([, def]) => def.step === step)
        .map(([code, def]) => ({ code, ...def }));
}

module.exports = { PIPELINE_ERROR_CODES, PipelineContractError, getErrorDef, getErrorsByStep };
