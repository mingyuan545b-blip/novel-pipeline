const store = require('../server/store');

const projectId = process.argv[2];

if (!projectId) {
    console.error('❌ 用法: node scripts/reset-chapters.js <projectId>');
    console.error('   示例: node scripts/reset-chapters.js d4808c1a-3378-4372-b672-9d0a6bd075f8');
    process.exit(1);
}

const AGENT_OUTPUT_FIELDS = [
    'content',
    'writerOutput',
    'reviserOutput',
    'reviserOutputRaw',
    'firstReviewOutput',
    'secondReviewOutput',
    'finalEditorOutput',
    'materialManagerOutput',
    'normalContent',
    'intentPlannerOutput',
    '_skipReason',
    'approvedAt',
    'wordCount',
    'originalWordCount',
    '_versionTags'
];

const EMPTY_PIPELINE_METRICS = {
    agentTimings: {},
    reviewPassRates: {},
    tokenUsage: {},
    chapterDurations: [],
    errorCounts: {},
    agentPassRates: {},
    reviserLoops: [],
    hookResolutionLog: [],
    materialAddedLog: [],
    branchingLog: []
};

const EMPTY_CIRCUIT_BREAKER = {
    consecutiveFailures: 0,
    lastFailureStep: null,
    history: []
};

function logSection(title) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('═'.repeat(60));
}

async function main() {
    console.log(`\n🔄 章节重置脚本启动`);
    console.log(`   项目ID: ${projectId}`);

    const project = store.getItem('projects', projectId);
    if (!project) {
        console.error(`❌ 项目不存在: ${projectId}`);
        process.exit(1);
    }
    console.log(`   项目名: ${project.name || '(未命名)'}`);

    const stats = {
        chaptersReset: 0,
        chaptersSkipped: 0,
        reviewsDeleted: 0,
        pipelineLogsDeleted: 0,
        infiniteStateDeleted: false,
        circuitBreakerReset: false,
        pipelineMetricsReset: false,
        nonFoundationMaterialsDeleted: 0,
        foundationMaterialsKept: 0
    };

    logSection('1. 重置章节');
    const allChapters = store.listItems('chapters');
    const chapters = allChapters.filter(c => c.projectId === projectId);
    console.log(`   找到 ${chapters.length} 个章节`);

    for (const ch of chapters) {
        const prevStatus = ch.status;
        const hadContent = !!ch.content;

        ch.status = 'outlined';
        ch.round = 0;
        ch.version = 0;
        ch._reviewRounds = 0;
        ch._pipelineRetries = 0;
        ch._wordCountRetry = 0;

        for (const field of AGENT_OUTPUT_FIELDS) {
            delete ch[field];
        }

        store.setItem('chapters', ch.id, ch);
        stats.chaptersReset++;

        const changes = [];
        if (prevStatus !== 'outlined') changes.push(`status: ${prevStatus} → outlined`);
        if (hadContent) changes.push('content cleared');

        if (changes.length > 0) {
            console.log(`   ✅ Ch${ch.chapterNumber} (${ch.id.substring(0, 8)}...) ${changes.join(', ')}`);
        } else {
            stats.chaptersSkipped++;
        }
    }
    console.log(`   📊 重置: ${stats.chaptersReset}, 无变化: ${stats.chaptersSkipped}`);

    logSection('2. 删除关联审核记录');
    const chapterIds = new Set(chapters.map(c => c.id));
    const allReviews = store.listItems('reviews');
    const projectReviews = allReviews.filter(r => r.projectId === projectId);
    console.log(`   找到 ${projectReviews.length} 条审核记录`);

    for (const review of projectReviews) {
        if (chapterIds.has(review.chapterId)) {
            store.deleteItem('reviews', review.id);
            stats.reviewsDeleted++;
            console.log(`   🗑️ 删除审核: ${review.id} (chapterId: ${review.chapterId.substring(0, 8)}..., step: ${review.step || review.type || '?'})`);
        }
    }
    console.log(`   📊 删除: ${stats.reviewsDeleted}`);

    logSection('3. 删除Pipeline日志');
    const allPipelineLogs = store.listItems('pipeline-logs');
    const projectPipelineLogs = allPipelineLogs.filter(l => l.projectId === projectId);
    console.log(`   找到 ${projectPipelineLogs.length} 条Pipeline日志`);

    for (const log of projectPipelineLogs) {
        store.deleteItem('pipeline-logs', log.id);
        stats.pipelineLogsDeleted++;
        console.log(`   🗑️ 删除日志: ${log.id}`);
    }

    const chapterLogIds = chapters.map(c => `${c.id}_pipeline`);
    for (const logId of chapterLogIds) {
        try {
            const logData = store.getItem('pipeline-logs', logId);
            if (logData) {
                store.deleteItem('pipeline-logs', logId);
                stats.pipelineLogsDeleted++;
                console.log(`   🗑️ 删除章节日志: ${logId}`);
            }
        } catch (_) {}
    }
    console.log(`   📊 删除: ${stats.pipelineLogsDeleted}`);

    logSection('4. 删除无限Pipeline状态');
    try {
        const infiniteState = store.getItem('infinite-pipeline-state', projectId);
        if (infiniteState) {
            store.deleteItem('infinite-pipeline-state', projectId);
            stats.infiniteStateDeleted = true;
            console.log(`   🗑️ 已删除无限Pipeline状态`);
        } else {
            console.log(`   ℹ️ 无无限Pipeline状态记录`);
        }
    } catch (_) {
        console.log(`   ℹ️ 无无限Pipeline状态记录`);
    }

    logSection('5. 重置项目熔断器');
    if (project._circuitBreaker) {
        const prev = JSON.stringify(project._circuitBreaker);
        project._circuitBreaker = EMPTY_CIRCUIT_BREAKER;
        store.setItem('projects', projectId, project);
        stats.circuitBreakerReset = true;
        console.log(`   ✅ 熔断器已重置`);
        console.log(`      旧值: consecutiveFailures=${JSON.parse(prev).consecutiveFailures}, history=${JSON.parse(prev).history?.length || 0}条`);
    } else {
        project._circuitBreaker = EMPTY_CIRCUIT_BREAKER;
        store.setItem('projects', projectId, project);
        stats.circuitBreakerReset = true;
        console.log(`   ✅ 熔断器已初始化（之前不存在）`);
    }

    logSection('6. 重置Pipeline指标');
    if (project._pipeline_metrics) {
        const prevMetrics = project._pipeline_metrics;
        project._pipeline_metrics = EMPTY_PIPELINE_METRICS;
        store.setItem('projects', projectId, project);
        stats.pipelineMetricsReset = true;
        console.log(`   ✅ Pipeline指标已重置`);
        const agentCount = Object.keys(prevMetrics.agentTimings || {}).length;
        const reviserLoopCount = (prevMetrics.reviserLoops || []).length;
        console.log(`      旧值: ${agentCount}个agent计时, ${reviserLoopCount}条返修循环记录`);
    } else {
        project._pipeline_metrics = EMPTY_PIPELINE_METRICS;
        store.setItem('projects', projectId, project);
        stats.pipelineMetricsReset = true;
        console.log(`   ✅ Pipeline指标已初始化（之前不存在）`);
    }

    logSection('7. 删除非基底素材');
    const allMaterials = store.listItems('materials');
    const projectMaterials = allMaterials.filter(m => m.projectId === projectId);
    console.log(`   项目素材总数: ${projectMaterials.length}`);

    for (const mat of projectMaterials) {
        const isFoundation = store.isFoundationMaterial(mat);
        if (isFoundation) {
            stats.foundationMaterialsKept++;
        } else {
            store.deleteItem('materials', mat.id);
            stats.nonFoundationMaterialsDeleted++;
            console.log(`   🗑️ 删除: [${mat.type}] ${mat.name} (${mat.id.substring(0, 8)}...)`);
        }
    }
    console.log(`   📊 基底素材保留: ${stats.foundationMaterialsKept}, 非基底素材删除: ${stats.nonFoundationMaterialsDeleted}`);

    logSection('重置完成 - 汇总');
    console.log(`
   章节重置:       ${stats.chaptersReset} (跳过无变化: ${stats.chaptersSkipped})
   审核记录删除:   ${stats.reviewsDeleted}
   Pipeline日志:   ${stats.pipelineLogsDeleted}
   无限Pipeline:   ${stats.infiniteStateDeleted ? '已删除' : '无记录'}
   熔断器:         ${stats.circuitBreakerReset ? '已重置' : '无需重置'}
   Pipeline指标:   ${stats.pipelineMetricsReset ? '已重置' : '无需重置'}
   基底素材保留:   ${stats.foundationMaterialsKept}
   非基底素材删除: ${stats.nonFoundationMaterialsDeleted}
    `);

    console.log('✅ 所有操作已完成，项目已回到初始状态，可重新启动Pipeline。\n');
}

main().catch(err => {
    console.error('❌ 脚本执行出错:', err);
    process.exit(1);
});
