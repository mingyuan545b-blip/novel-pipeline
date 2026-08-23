'use strict';

/**
 * auditD5FrontendUI.js — D5: 前端UI显示排查
 *
 * 检查项目卡片/章节列表/实体中心/材料树
 * 重点：前端字段读取是否与后端业务字段一致
 */

const { warn, ok, readFile } = require('./auditUtils');

function auditFrontendUI() {
    console.log('\n=== D5: 前端UI显示排查 ===');

    // D5.1: 项目卡片显示targetChapters
    const projectFormFields = readFile('client/src/components/ProjectFormFields.jsx');
    if (projectFormFields) {
        if (projectFormFields.includes('targetChapters')) {
            ok('D5.1', '前端表单用targetChapters');
        } else if (projectFormFields.includes('targetChapterCount')) {
            warn('D5.1', '前端表单用targetChapterCount（历史字段）');
        }
    }

    // D5.2: usePipelinePageState字段读取（检测是否用??兼容）
    const usePipelinePageState = readFile('client/src/pages/pipeline/usePipelinePageState.js');
    if (usePipelinePageState) {
        const hasTargetChapters = usePipelinePageState.includes('targetChapters');
        const hasTargetChapterCount = usePipelinePageState.includes('targetChapterCount');
        const hasNullishCoalescing = usePipelinePageState.includes('??');

        if (hasTargetChapters && hasTargetChapterCount && hasNullishCoalescing) {
            ok('D5.2', 'usePipelinePageState用??兼容targetChapters和targetChapterCount两个字段');
        } else if (hasTargetChapterCount && !hasTargetChapters) {
            warn('D5.2', 'usePipelinePageState仅读取targetChapterCount（历史字段）', {
                impact: '若project对象只有targetChapters，会显示空值'
            });
        } else if (hasTargetChapters) {
            ok('D5.2', 'usePipelinePageState读取targetChapters');
        }
    }

    // D5.3: 实体中心章节选择器
    const entityCenterState = readFile('client/src/pages/entitycenter/useEntityCenterState.js');
    if (entityCenterState) {
        if (entityCenterState.includes('chapterOptions') || entityCenterState.includes('chapterNumber')) {
            ok('D5.3', '实体中心有章节选择器');
        }
    }

    // D5.4: 材料树projectId过滤
    const materialTreePanel = readFile('client/src/pages/materials/MaterialTreePanel.jsx');
    if (materialTreePanel) {
        if (materialTreePanel.includes('projectId')) {
            ok('D5.4', '材料树按projectId过滤');
        }
    }

    // D5.5: 章节列表状态显示
    const chaptersPage = readFile('client/src/pages/ChaptersPage.jsx');
    if (chaptersPage) {
        const statusMatch = chaptersPage.match(/status.*label|statusLabel|CHAPTER_STATUS/);
        if (statusMatch) {
            ok('D5.5', '章节列表显示状态');
        }
    }
}

module.exports = { auditFrontendUI };
