const store = require('../../store');
const logger = require('../../shared/logger');
const { STATUS_VALUES } = require('../chapterStatus');

async function catchupMaterialManager(projectId, chapters, runPipelineStep, options = {}) {
    const { onStep, pipelineLog, maxRetries = 3 } = options;
    const approvedWithoutMaterials = chapters.filter(
        c => c.status === STATUS_VALUES.APPROVED && (!c.materialManagerOutput || c.materialManagerFailed)
    );

    if (approvedWithoutMaterials.length === 0) return;

    logger.warn('materialManagerCatchup', '[PIPELINE] ⚠️ 发现{count}个approved但缺素材管理的章节，补跑中...', { count: approvedWithoutMaterials.length });

    for (const ch of approvedWithoutMaterials) {
        try {
            logger.info('materialManagerCatchup', '[PIPELINE] 补跑第{chChapterNumber}章素材管理器...', { chChapterNumber: ch.chapterNumber });
            const result = await runPipelineStep(projectId, ch.id, 'material-manager', 1, { materialGuidance: '' });
            ch.materialManagerOutput = result?.feedback?.summary || '[补跑完成]';
            ch.materialManagerFailed = false;
            delete ch.materialManagerError;
            ch.status = STATUS_VALUES.MATERIAL_UPDATED;
            ch.updatedAt = new Date().toISOString();
            await store.setItem('chapters', ch.id, ch);
            if (pipelineLog) {
                pipelineLog.push({ step: 'material-manager-catchup', chapterNumber: ch.chapterNumber, status: 'completed', timestamp: new Date().toISOString() });
            }
            if (onStep) {
                onStep({ step: 'material-manager-catchup', round: 0, passed: true, roleName: '素材管理(补跑)', feedback: result?.feedback || { summary: '补跑完成' } });
            }
            logger.info('materialManagerCatchup', '[PIPELINE] ✅ 第{chChapterNumber}章素材管理器补跑完成', { chChapterNumber: ch.chapterNumber });
        } catch (matErr) {
            logger.error('materialManagerCatchup', '[PIPELINE] 第{chChapterNumber}章素材管理器补跑失败:', { chChapterNumber: ch.chapterNumber, matErrMessage: matErr.message });
            ch._matManagerRetries = (ch._matManagerRetries || 0) + 1;
            // P1-4a：不再伪造 material-updated（那会让"素材缺口"静默消失）。
            // 保持 approved + materialManagerFailed=true → 由 materialGate 持续拦截下一章并告警，
            // 超过阈值后走**显式债务** materialDebt 放行（可见、可查），而不是假成功。
            ch.materialManagerFailed = true;
            ch.materialManagerOutput = `[素材管理补跑失败${ch._matManagerRetries}次，未归档]`;
            if (ch._matManagerRetries >= maxRetries) {
                logger.error('materialManagerCatchup', '[PIPELINE] 第{chChapterNumber}章素材补跑连续失败，保持缺口（不伪造 material-updated）', { chChapterNumber: ch.chapterNumber, retries: ch._matManagerRetries });
            }
            await store.setItem('chapters', ch.id, ch);
        }
    }
}

module.exports = { catchupMaterialManager };
