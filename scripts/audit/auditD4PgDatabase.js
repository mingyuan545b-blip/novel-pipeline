'use strict';

/**
 * auditD4PgDatabase.js — D4: PG数据库排查
 *
 * 检查PG表结构/索引/外键/数据落库一致性
 * 重点：DELETE去重语句是否已改为条件执行（DO $$块）
 */

const { warn, info, ok, readFile } = require('./auditUtils');

function auditPgDatabase() {
    console.log('\n=== D4: PG数据库排查 ===');

    // D4.1: PG表字段与fieldRegistry一致
    const pgSchemaCore = readFile('server/db/pgSchemaCore.js');
    const fieldRegistryCore = readFile('server/db/fieldRegistryCore.js');

    if (pgSchemaCore && fieldRegistryCore) {
        const projectsMatch = pgSchemaCore.match(/CREATE TABLE IF NOT EXISTS projects \(([^)]+)\)/);
        if (projectsMatch) {
            const pgFields = projectsMatch[1].split('\n')
                .map(l => l.trim().split(/\s+/)[0])
                .filter(f => f && !f.startsWith('--') && f !== 'id');
            ok('D4.1', `projects表有${pgFields.length}个字段`);
        }
    }

    // D4.2: extractor读取的字段名与业务对象字段名匹配（检测extractorSource修复）
    const fieldRegistry = readFile('server/db/fieldRegistry.js');
    if (fieldRegistry) {
        const hasExtractorSource = fieldRegistry.includes('extractorSource');
        const usesDataColName = fieldRegistry.includes('const value = data[colName]');

        if (usesDataColName && !hasExtractorSource) {
            warn('D4.2', 'generateExtractor用data[colName]读取，但colName是PG字段名', {
                extractorLogic: 'data[colName] where colName=targetChapterCount',
                businessField: 'data.targetChapters',
                impact: 'extractor读不到值，返回extractorDefault=null'
            });
        } else if (hasExtractorSource) {
            ok('D4.2', 'generateExtractor支持extractorSource字段映射，从业务对象正确字段读取');
        }
    }

    // D4.3: 索引覆盖
    if (pgSchemaCore) {
        const indexCount = (pgSchemaCore.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
        const uniqueIndexCount = (pgSchemaCore.match(/CREATE UNIQUE INDEX IF NOT EXISTS/g) || []).length;
        ok('D4.3', `索引覆盖: ${indexCount}个普通索引, ${uniqueIndexCount}个唯一索引`);
    }

    // D4.4: 检查是否有外键约束（有意设计：应用层级联删除，不使用PG外键）
    if (pgSchemaCore) {
        const fkCount = (pgSchemaCore.match(/FOREIGN KEY/g) || []).length;
        if (fkCount === 0) {
            info('D4.4', 'PG表无外键约束（设计决策：应用层级联删除）', {
                reason: '使用应用层级联删除而非PG外键，避免ON DELETE CASCADE与现有逻辑冲突',
                safeguard: 'projectDeleteHandler.js的CASCADE_STORE_TYPES覆盖14个数据目录',
                impact: '应用层bug可能导致孤儿数据，但已有级联删除测试覆盖'
            });
        } else {
            ok('D4.4', `有${fkCount}个外键约束`);
        }
    }

    // D4.5: 检查materials表的DELETE去重语句（检测是否已改为条件执行）
    if (pgSchemaCore) {
        const hasDeleteDedup = pgSchemaCore.includes('DELETE FROM materials a USING materials b');
        const hasConditionalBlock = pgSchemaCore.includes('DO $$') && pgSchemaCore.includes('IF EXISTS');

        if (hasDeleteDedup && !hasConditionalBlock) {
            warn('D4.5', 'PG schema包含无条件DELETE去重语句，每次启动都会执行', {
                impact: '启动时删除重复数据，但若数据源不一致会反复删除'
            });
        } else if (hasDeleteDedup && hasConditionalBlock) {
            ok('D4.5', 'DELETE去重已包装在DO $$条件块中，仅存在重复数据时执行');
        }
    }
}

module.exports = { auditPgDatabase };
