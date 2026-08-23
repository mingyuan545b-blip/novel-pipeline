/**
 * startupChecksPipeline.js — Pipeline相关启动检查
 *
 * 从 startupChecks.js 拆出，包含3个Pipeline完整性检查：
 * - 实体中心数据一致性校验（自动修复不同步的实体）
 * - Pipeline Step完整性校验（确保所有Step模块可加载且继承BaseStep）
 * - Pipeline配置同步校验（确保pipelineContract与pipelineErrors常量一致）
 *
 * 通过 registerCheck 注册到主检查列表，主文件加载时自动调用。
 */

/** 防护1：实体中心数据一致性校验 */
function registerEntityConsistencyCheck(registerCheck) {
    registerCheck('实体中心数据一致性', async () => {
        try {
            const store = require('../store');
            const { syncToRegistry } = require('./entityCenter/entityCRUD');
            const allEntities = await store.queryItems('entities', { entityType: 'character' });
            const entities = allEntities.filter(e => e.lifecycleState !== 'archived' && !e.archived);
            if (entities.length === 0) {
                return { level: 'ok', message: '无角色实体，跳过校验' };
            }
            const allRegistry = await store.queryItems('entity-registry', { entityType: 'character' });
            const registry = allRegistry.filter(r => r.lifecycleState !== 'archived' && r.isActive !== false);
            const regMap = {};
            for (const r of registry) regMap[r.id] = r;

            let outOfSync = 0;
            for (const entity of entities) {
                const reg = regMap[entity.id];
                if (!reg) { outOfSync++; continue; }
                const SYNC_FIELDS = ['position', 'personality', 'speakingTone', 'signatureDetail', 'craftStyle', 'factionName', 'genreId'];
                for (const field of SYNC_FIELDS) {
                    if (entity[field] && !reg[field]) { outOfSync++; break; }
                }
            }

            if (outOfSync > 0) {
                // 自动修复
                for (const entity of entities) {
                    await syncToRegistry(entity);
                }
                return { level: 'warning', message: `${outOfSync}个实体与registry不同步，已自动修复` };
            }
            return { level: 'ok', message: `${entities.length}个实体全部同步` };
        } catch (e) {
            return { level: 'warning', message: `校验失败: ${e.message}` };
        }
    });
}

/** 防护2：Pipeline Step完整性校验 — 确保所有Step模块可加载且继承BaseStep */
function registerPipelineStepCheck(registerCheck) {
    registerCheck('Pipeline Step完整性', () => {
        try {
            const { BaseStep } = require('../core/pipeline/steps/BaseStep');
            const stepModules = [
                'WriterStep', 'FirstReviewStep', 'SecondReviewStep', 'FastReviewStep',
                'FinalEditorStep', 'ReviserStep', 'PolisherStep', 'ReaderStep',
                'MaterialManagerStep', 'MaterialRegistrarStep', 'MaterialOrganizerStep'
            ];
            let loaded = 0;
            const errors = [];
            for (const modName of stepModules) {
                try {
                    const StepClass = require(`../core/pipeline/steps/${modName}`);
                    if (!StepClass.prototype || !(StepClass.prototype instanceof BaseStep)) {
                        errors.push(`${modName}未继承BaseStep`);
                    } else {
                        loaded++;
                    }
                } catch (e) {
                    errors.push(`${modName}加载失败: ${e.message}`);
                }
            }
            if (errors.length > 0) {
                return { level: 'critical', message: `${loaded}/${stepModules.length}加载成功，错误: ${errors.join('; ')}` };
            }
            return { level: 'ok', message: `${loaded}/${stepModules.length}个Step全部加载成功` };
        } catch (e) {
            return { level: 'critical', message: `检查失败: ${e.message}` };
        }
    });
}

/** 防护3：Pipeline配置同步校验 — 确保pipelineContract与pipelineErrors常量一致 */
function registerPipelineConfigSyncCheck(registerCheck) {
    registerCheck('Pipeline配置同步', () => {
        try {
            const { checkPipelineConfigSync } = require('./pipeline/configSyncCheck');
            const result = checkPipelineConfigSync();
            if (result.details.length > 0) {
                return { level: result.level, message: `${result.message} | ${result.details.join('; ')}` };
            }
            return { level: result.level, message: result.message };
        } catch (e) {
            return { level: 'critical', message: `检查失败: ${e.message}` };
        }
    });
}

/** 注册所有Pipeline检查到主检查列表 */
function registerPipelineChecks(registerCheck) {
    registerEntityConsistencyCheck(registerCheck);
    registerPipelineStepCheck(registerCheck);
    registerPipelineConfigSyncCheck(registerCheck);
}

module.exports = { registerPipelineChecks };
