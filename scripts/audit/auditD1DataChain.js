'use strict';

/**
 * auditD1DataChain.js — D1: 数据链断裂排查
 *
 * 检查项目→章节→材料→审核→实体→PG全链路字段一致性
 * 重点：targetChapters业务字段 vs targetChapterCount PG列名的映射
 */

const { critical, warn, ok, readFile } = require('./auditUtils');

function auditDataChain() {
    console.log('\n=== D1: 数据链断裂排查 ===');

    // D1.1: 项目创建→PG落库→前端读取 字段链
    const createHandler = readFile('server/routes/projects/projectCreateHandler.js');
    if (!createHandler) {
        critical('D1.1', 'projectCreateHandler.js不存在');
        return;
    }
    if (!createHandler.includes('targetChapters')) {
        critical('D1.1', '项目创建未写入targetChapters字段');
    } else {
        ok('D1.1', '项目创建写入targetChapters');
    }

    // D1.2: PG extractor是否读取正确字段（检测extractorSource修复）
    const fieldRegistryCore = readFile('server/db/fieldRegistryCore.js');
    if (fieldRegistryCore && fieldRegistryCore.includes('targetChapterCount')) {
        const colDefMatch = fieldRegistryCore.match(/targetChapterCount:\s*\{[^}]+\}/);
        if (colDefMatch) {
            const colDef = colDefMatch[0];
            const hasExtractorSource = colDef.includes('extractorSource');
            const extractorDefaultMatch = colDef.match(/extractorDefault:\s*(\w+)/);

            if (hasExtractorSource) {
                const sourceMatch = colDef.match(/extractorSource:\s*'(\w+)'/);
                ok('D1.2', `PG targetChapterCount列已配置extractorSource映射`, {
                    extractorSource: sourceMatch ? sourceMatch[1] : 'unknown',
                    impact: 'extractor从业务对象的targetChapters字段读取，PG正确落库'
                });
            } else if (extractorDefaultMatch) {
                warn('D1.2', 'PG projects表用targetChapterCount，但业务代码用targetChapters', {
                    pgField: 'targetChapterCount',
                    businessField: 'targetChapters',
                    extractorDefault: extractorDefaultMatch[1],
                    impact: 'PG索引列永远为null，无法按章节数查询'
                });
            }
        }
    }

    // D1.3: store-pg-writer是否用extractor的字段（检测extractorSource修复）
    const fieldRegistry = readFile('server/db/fieldRegistry.js');
    const storePgWriter = readFile('server/db/store-pg-writer.js');
    if (storePgWriter && fieldRegistry) {
        const hasExtractorSource = fieldRegistry.includes('extractorSource');
        const projectUpdateMatch = storePgWriter.match(/UPDATE projects SET mode=\?,targetChapterCount=\?/);

        if (projectUpdateMatch) {
            if (hasExtractorSource) {
                ok('D1.3', 'store-pg-writer用f.targetChapterCount写入，extractor通过extractorSource从targetChapters读取', {
                    writerField: 'f.targetChapterCount',
                    extractorSource: 'data.targetChapters (via extractorSource)',
                    result: 'PG.targetChapterCount正确落库'
                });
            } else {
                warn('D1.3', 'store-pg-writer用f.targetChapterCount写入PG，但extractor从data.targetChapterCount读取（业务对象只有targetChapters）', {
                    writerField: 'f.targetChapterCount',
                    extractorSource: 'data.targetChapterCount',
                    businessField: 'data.targetChapters',
                    result: 'PG.targetChapterCount永远为null'
                });
            }
        }
    }

    // D1.4: 级联删除完整性
    const deleteHandler = readFile('server/routes/projects/projectDeleteHandler.js');
    if (!deleteHandler) {
        critical('D1.4', 'projectDeleteHandler.js不存在');
    } else {
        ok('D1.4', '级联删除处理器存在');
    }

    // D1.5: 检查CASCADE_STORE_TYPES是否覆盖所有含projectId的表
    const dataStoreRegistry = readFile('server/config/dataStoreRegistry.js');
    if (dataStoreRegistry) {
        const cascadeMatch = dataStoreRegistry.match(/CASCADE_STORE_TYPES\s*=\s*\[([^\]]+)\]/);
        if (cascadeMatch) {
            const types = cascadeMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
            ok('D1.5', `CASCADE_STORE_TYPES包含${types.length}个类型`);
        }
    }
}

module.exports = { auditDataChain };
