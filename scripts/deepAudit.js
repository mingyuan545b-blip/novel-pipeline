'use strict';

/**
 * deepAudit.js — 生产问题深度审计（五维度）主入口
 *
 * 五维度审计：
 *   D1: 数据链断裂（项目→章节→材料→审核→实体→PG）
 *   D2: 字段一致性（targetChapters/styleProfile/chapterIntents/wordConfig）
 *   D3: agent约束完整性+冲突重叠
 *   D4: PG数据库（表结构/extractor/索引/字段映射）
 *   D5: 前端UI显示（字段读取/数据源）
 *
 * 审计逻辑拆分到 scripts/audit/ 目录下5个模块，本文件仅作入口和汇总
 * 不修改任何代码，只读取和报告问题。
 */

const { auditDataChain } = require('./audit/auditD1DataChain');
const { auditFieldConsistency } = require('./audit/auditD2FieldConsistency');
const { auditAgentConstraints } = require('./audit/auditD3AgentConstraints');
const { auditPgDatabase } = require('./audit/auditD4PgDatabase');
const { auditFrontendUI } = require('./audit/auditD5FrontendUI');
const { getSummary } = require('./audit/auditUtils');

function main() {
    console.log('========================================');
    console.log('生产问题深度审计（五维度）');
    console.log('========================================');

    auditDataChain();
    auditFieldConsistency();
    auditAgentConstraints();
    auditPgDatabase();
    auditFrontendUI();

    const { criticalCount, warnCount, issues } = getSummary();

    console.log('\n========================================');
    console.log('审计汇总');
    console.log('========================================');
    console.log(`总计: ${issues.length}个问题, ${criticalCount}个严重, ${warnCount}个警告`);

    if (criticalCount > 0) {
        console.log('\n❌ 严重问题（必须修复）:');
        for (const issue of issues.filter(i => i.severity === 'CRITICAL')) {
            console.log(`  [${issue.code}] ${issue.msg}`);
        }
    }

    if (warnCount > 0) {
        console.log('\n⚠️  警告（建议修复）:');
        for (const issue of issues.filter(i => i.severity === 'WARN')) {
            console.log(`  [${issue.code}] ${issue.msg}`);
        }
    }

    process.exit(criticalCount > 0 ? 1 : 0);
}

main();
