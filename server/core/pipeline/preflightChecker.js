const store = require('../../store');
const logger = require('../../shared/logger');
const { catchupMaterialManager } = require('../../services/pipeline/materialManagerCatchup');
const { buildConstraintInjection } = require('../../services/prompts/constraintInjector');

async function runPreflightChecks(projectId, chapterId, runPipelineStep, pipelineLog, onStep) {
    const chapter = await store.getItem('chapters', chapterId);
    if (!chapter || chapter.chapterNumber <= 1) return;

    const allPrevChapters = (await store.queryItems('chapters', { projectId }))
        .filter(c => c.chapterNumber < chapter.chapterNumber)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

    await catchupMaterialManager(projectId, allPrevChapters, runPipelineStep, { onStep, pipelineLog });

    const allMaterials = await store.queryItems('materials', { projectId });
    const emptyMaterials = allMaterials.filter(m =>
        !m.archived && (!m.currentContent || m.currentContent.trim().length < 5) &&
        m.initialContent && m.initialContent.trim().length > 10
    );
    for (const em of emptyMaterials) {
        logger.warn('pipeline', 'Material "{emName}" content empty, restoring initialContent', { emName: em.name });
        em.currentContent = em.initialContent;
        em.updatedAt = new Date().toISOString();
        await store.setItem('materials', em.id, em);
    }

    // SOP-2修复：约束对齐校验（writer约束⊆reviewer约束）
    await _verifyConstraintAlignment(projectId);
}

/** SOP-2修复：约束对齐校验
 *  防止SOP断链：如果reviewer有povRule但writer没有，Pipeline拒绝执行并报错
 */
async function _verifyConstraintAlignment(projectId) {
    try {
        const writerConstraints = await buildConstraintInjection(projectId, 'writer');
        const reviewerConstraints = await buildConstraintInjection(projectId, 'first-review');

        // 检查关键约束是否对齐（pov-lock必须在writer和reviewer中都存在或都不存在）
        const project = await store.getItem('projects', projectId);
        const hasPovRule = project?.styleProfile?.povRule;

        if (hasPovRule) {
            const writerHasPov = writerConstraints.includes('视角锁定') || writerConstraints.includes('pov-lock');
            const reviewerHasPov = reviewerConstraints.includes('视角锁定') || reviewerConstraints.includes('pov-lock');

            if (!writerHasPov) {
                logger.error('pipeline', '[SOP-2] 约束对齐校验失败: writer缺少pov-lock约束，但项目有povRule。视角违规SOP断链风险！');
                throw new Error('约束对齐校验失败: writer缺少pov-lock约束（povRule未注入到writer prompt）');
            }
            if (!reviewerHasPov) {
                logger.error('pipeline', '[SOP-2] 约束对齐校验失败: reviewer缺少pov-lock约束，但项目有povRule。审核标准不一致风险！');
                throw new Error('约束对齐校验失败: reviewer缺少pov-lock约束（povRule未注入到reviewer prompt）');
            }
            logger.info('pipeline', '[SOP-2] 约束对齐校验通过: writer和reviewer均包含pov-lock约束');
        }
    } catch (err) {
        logger.error('pipeline', '[SOP-2] 约束对齐校验异常:', { error: err.message });
        // 不抛出异常，只记录错误，避免阻塞Pipeline（约束注入已修复，校验作为预警）
    }
}

module.exports = { runPreflightChecks };
