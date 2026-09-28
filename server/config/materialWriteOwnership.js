'use strict';

/**
 * materialWriteOwnership — 素材写入权硬边界（P1-4c）
 *
 * 背景（用户诉求"避免前面出现的重复定义归属"）：
 *   素材（materials）是全书唯一真相，一旦多个环节都能写，就会出现"同一概念两处定义、
 *   后续章节各写各的"——断档失忆的根因之一。因此把写入权收口到 material-manager 链，
 *   每条素材都留"最后写入者 + 最后写入章"，出问题能第一时间定位到人和章节。
 *
 * 边界（静态审计见 scripts/verifyMaterialAssemblyEntry.js）：
 *   - 读取：任何 agent 只能通过 materialStateAssembler（单点装配入口）；
 *   - 写入：只有 material-manager 链（materialCreateAction / materialActions / 补跑）；
 *   - 其它环节需要改素材 → 产出"素材变更建议"，由 material-manager 落库。
 */
const MATERIAL_WRITER_ID = 'material-manager';

/** 该 agent 是否拥有素材写入权 */
function isMaterialWriter(agentType) {
    return agentType === MATERIAL_WRITER_ID;
}

/** 素材写入留痕字段（创建/更新/归档共用，保证口径一致） */
function buildWriteStamp(chapterNumber) {
    return { lastWriter: MATERIAL_WRITER_ID, lastUpdatedChapter: chapterNumber || 0 };
}

module.exports = { MATERIAL_WRITER_ID, isMaterialWriter, buildWriteStamp };
