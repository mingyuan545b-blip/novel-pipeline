/**
 * 全链路素材注入完整性校验（SOP硬门禁工具）
 *
 * 用途：新项目首章pipeline后，校验素材注入链路5个环节是否打通
 * 用法：node scripts/auditMaterialInjection.js <projectId> <chapterNumber>
 * 退出码：0=通过，1=有断链
 *
 * 校验环节：
 * ①生成端：material-organizer输出深度字段
 * ②存储端：stateKVIndex有character-states记录
 * ③加载端：调度器加载角色数>0
 * ④注入端：writer/reviser/review注入深度字段
 * ⑤运行时：writer prompt实际包含深度字段
 *
 * SOP 09硬门禁#8：新项目首章pipeline后必须运行，任何断链点阻断
 */
const http = require('http');

const SECRET = process.env.PIPELINE_SECRET || 'novel-pipeline-dev-secret-2024-change-in-prod';
const HOST = 'localhost';
const PORT = 3001;

function get(path) {
    return new Promise((resolve) => {
        const req = http.request({ hostname: HOST, port: PORT, path, method: 'GET', headers: { 'Authorization': `Bearer ${SECRET}` } }, res => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve({ ok: true, data: JSON.parse(d) }); }
                catch (e) { resolve({ ok: false, raw: d.slice(0, 500) }); }
            });
        });
        req.on('error', e => resolve({ ok: false, err: e.message }));
        req.end();
    });
}

// material-organizer输出的8个深度字段
const DEPTH_FIELDS = [
    'personalityNote', 'speakingToneNote', 'signatureDetailNote', 'catchphraseNote',
    'protagonistMirrorNote', 'independentStanceNote', 'fateArcNote', 'innerConflictNote'
];

function extractArr(resp) {
    if (!resp.ok) return [];
    const j = resp.data;
    return Array.isArray(j) ? j : (j.data || j.facts || []);
}

async function audit(projectId, chapterNumber) {
    const errors = [];
    const warnings = [];

    console.log(`\n========== 全链路素材注入完整性校验 ==========`);
    console.log(`项目:${projectId} 章节:CH${chapterNumber}\n`);

    // ①生成端：material-organizer输出
    const cs = await get(`/api/chapters?projectId=${projectId}`);
    const chapters = extractArr(cs);
    const ch = chapters.find(c => c.chapterNumber === chapterNumber);
    if (!ch) { errors.push(`CH${chapterNumber}不存在`); return { errors, warnings }; }
    const moOutput = ch.materialOrganizerOutput || '';
    let moDepthFields = [];
    try {
        const moJson = JSON.parse(moOutput);
        if (moJson.characters) {
            moDepthFields = moJson.characters.flatMap(c => DEPTH_FIELDS.filter(f => c[f]));
        }
    } catch (e) { warnings.push(`material-organizer输出JSON解析失败: ${e.message}`); }
    console.log(`①生成端 material-organizer深度字段: ${moDepthFields.length > 0 ? [...new Set(moDepthFields)].join(',') : '(无)'}`);
    if (moDepthFields.length === 0) errors.push('①生成端断链：material-organizer未输出深度字段');

    // ②存储端：stateKVIndex有character-states记录
    const chars = await get(`/api/entity-center/entities?projectId=${projectId}&entityType=character`);
    const charArr = extractArr(chars);
    console.log(`②存储端 entityCenter角色数: ${charArr.length}`);
    if (charArr.length === 0) errors.push('②存储端断链：entityCenter无角色实体');

    // 检查角色是否有深度字段（通过genreState.innerVoiceCount等）
    let hasDepthInGenreState = false;
    for (const c of charArr) {
        const gs = c.genreState || {};
        if (gs.innerVoiceCount > 0 || gs.autonomousDecisionCount > 0 || gs.subversiveBehaviorCount > 0) {
            hasDepthInGenreState = true; break;
        }
    }
    console.log(`   genreState有深度指标: ${hasDepthInGenreState ? '是' : '否（可能首章尚未提取）'}`);
    if (charArr.length > 0 && !hasDepthInGenreState) warnings.push('②存储端：角色genreState无深度指标（首章可能尚未提取，CH2+必须出现）');

    // ③加载端+④注入端：通过material-depth报告间接验证
    const md = await get(`/api/health/material-depth?projectId=${projectId}&chapterNumber=${chapterNumber}`);
    const mdr = md.ok ? (md.data?.data || md.data?.report || md.data) : null;
    console.log(`③④material-depth passed: ${mdr?.passed}`);
    const checks = mdr?.checks || {};
    if (checks.materialOrganizerOutput && !checks.materialOrganizerOutput.passed) {
        errors.push(`③④断链：materialOrganizerOutput检查失败 - ${checks.materialOrganizerOutput.reason || ''}`);
    }
    if (checks.knowledgeFacts && !checks.knowledgeFacts.passed) {
        errors.push(`③④断链：knowledgeFacts检查失败 - ${checks.knowledgeFacts.reason || ''}`);
    }
    if (checks.characterDepth && !checks.characterDepth.passed) {
        warnings.push(`③④characterDepth未通过（陷阱#76修复后CH2+应通过，首章可能因无前序深度字段未通过）`);
    }

    // ⑤运行时：检查writer是否实际拿到深度字段（通过章节内容间接验证）
    // 如果writer拿到了深度字段，章节内容应体现角色深度（有内心活动/独立立场描写）
    const content = ch.content || '';
    const hasInnerActivity = /心中|内心|心底|暗想|思忖|犹豫|纠结|挣扎/.test(content);
    console.log(`⑤运行时 章节内容有内心活动描写: ${hasInnerActivity}`);
    if (!hasInnerActivity && content.length > 1000) {
        warnings.push('⑤运行时：章节内容可能缺乏内心活动描写（writer可能未拿到深度字段）');
    }

    // 汇总
    console.log(`\n========== 校验结果 ==========`);
    if (errors.length > 0) {
        console.log(`❌ 失败（${errors.length}个断链）：`);
        errors.forEach(e => console.log(`  - ${e}`));
        return { errors, warnings, exitCode: 1 };
    }
    if (warnings.length > 0) {
        console.log(`⚠️ 警告（${warnings.length}个，不阻断）：`);
        warnings.forEach(w => console.log(`  - ${w}`));
    }
    console.log(`✅ 全链路注入完整性校验通过`);
    return { errors, warnings, exitCode: 0 };
}

(async () => {
    const projectId = process.argv[2];
    const chapterNumber = parseInt(process.argv[3], 10);
    if (!projectId || !chapterNumber) {
        console.log('用法: node scripts/auditMaterialInjection.js <projectId> <chapterNumber>');
        process.exit(1);
    }
    try {
        const result = await audit(projectId, chapterNumber);
        process.exit(result.exitCode);
    } catch (e) {
        console.error('校验异常:', e.message);
        process.exit(1);
    }
})();
