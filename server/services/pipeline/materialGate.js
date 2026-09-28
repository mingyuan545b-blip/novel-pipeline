/**
 * materialGate.js — 章节因果门槛（P1-4a）
 *
 * 目的：保证"前章素材已归档（material-updated），本章才开工"，
 * 消灭"跳章执行 → 后章看不到前章素材 → 自造新设定"的断档失忆。
 * 方案见 docs/design/章节因果门槛与单点素材装配（计划书）.md §三A。
 *
 * 规则：
 *  1. 第 N 章（N>1）开工前，第 1..N-1 章必须全部 status===material-updated；
 *  2. 缺口章若已 approved（正文过审、只差素材落库）→ 先补跑 material-manager；
 *  3. 补跑后仍缺 → 不静默：写 materialGateBlocked + 告警，本章不开工；
 *  4. 唯一妥协出口 = 显式债务 materialDebt（补跑连续失败 / 长时阻塞），放行但可见。
 */
const store = require('../../store');
const logger = require('../../shared/logger');
const { STATUS_VALUES } = require('../chapterStatus');
const { catchupMaterialManager } = require('./materialManagerCatchup');

const GATE_WAIT_MAX_MS = 120000;      // 主循环切片等待上限
const GATE_WAIT_MIN_MS = 5000;
const GATE_WAIT_DEFAULT_MS = 15000;   // 无冷却时间时（如审核失败重试中）的默认等待
const DEBT_AFTER_MS = 30 * 60 * 1000; // 缺口持续超此时长 → 显式债务放行
const DEBT_MIN_RETRIES = 3;           // 补跑连续失败次数 → 显式债务放行
const GATE_ERROR_CODE = 'MATERIAL_GATE_BLOCKED';

const chapterNumOf = (ch) => (ch && ch.chapterNumber) || 0;
const isArchivedChapter = (ch) => !!ch && ch.status === STATUS_VALUES.MATERIAL_UPDATED;

/** 前序缺口章节（升序）：第 1..N-1 章中未归档的 */
function findGaps(chapters, chapterNumber) {
    return (chapters || [])
        .filter(c => chapterNumOf(c) > 0 && chapterNumOf(c) < chapterNumber && !isArchivedChapter(c))
        .sort((a, b) => chapterNumOf(a) - chapterNumOf(b));
}

/** 缺口详情（纯函数） */
function toGapInfo(ch, now) {
    const retries = ch._matManagerRetries || 0;
    return {
        chapterNumber: chapterNumOf(ch),
        status: ch.status,
        materialManagerFailed: !!ch.materialManagerFailed,
        materialManagerRetries: retries,
        skipUntil: ch.skipUntil || 0,
        blockedSince: ch._gateBlockedSince || 0,
        // 正文已过审、只是素材没落库且补跑连续失败 → 可走债务出口
        repairExhausted: ch.status === STATUS_VALUES.APPROVED && !!ch.materialManagerFailed && retries >= DEBT_MIN_RETRIES,
        stuckTooLong: !!ch._gateBlockedSince && (now - ch._gateBlockedSince) >= DEBT_AFTER_MS
    };
}

/** 纯判定：本章能否开工（不写任何数据） */
function evaluateGate(chapters, chapterNumber, now = Date.now()) {
    if (!chapterNumber || chapterNumber <= 1) {
        return { ready: true, blockedBy: [], debt: null, earliestResumeAt: 0, report: '第1章无需门槛' };
    }
    const blockedBy = findGaps(chapters, chapterNumber).map(ch => toGapInfo(ch, now));
    if (blockedBy.length === 0) {
        return { ready: true, blockedBy: [], debt: null, earliestResumeAt: 0, report: `第${chapterNumber}章前序素材已全部归档` };
    }
    const waitUntil = blockedBy.map(g => g.skipUntil).filter(t => t > now);
    const earliestResumeAt = waitUntil.length > 0 ? Math.min(...waitUntil) : now + GATE_WAIT_DEFAULT_MS;
    const first = blockedBy[0];
    const report = `第${chapterNumber}章等待：第${first.chapterNumber}章素材未归档（状态${first.status}）`
        + (blockedBy.length > 1 ? `，共${blockedBy.length}章缺口` : '');

    const debtCandidates = blockedBy.filter(g => g.repairExhausted || g.stuckTooLong);
    if (debtCandidates.length > 0) {
        const c = debtCandidates[0];
        const since = Math.min(...debtCandidates.map(g => g.blockedSince || now));
        return {
            ready: true, blockedBy, earliestResumeAt, report,
            debt: {
                blockedChapters: debtCandidates.map(g => g.chapterNumber),
                reason: c.repairExhausted
                    ? `第${c.chapterNumber}章素材补跑连续失败${c.materialManagerRetries}次`
                    : `第${c.chapterNumber}章素材缺口持续超${Math.round(DEBT_AFTER_MS / 60000)}分钟`,
                since
            }
        };
    }
    return { ready: false, blockedBy, debt: null, earliestResumeAt, report };
}

/** 门槛拦截错误（供 pipelineStepRunner 抛出，主流程据此识别为"不罚重试"） */
function buildGateError(report) {
    const err = new Error(`章前素材门槛未通过：${report}`);
    err.code = GATE_ERROR_CODE;
    err.isMaterialGate = true;
    return err;
}

function isGateError(err) {
    return !!err && (err.code === GATE_ERROR_CODE || err.isMaterialGate === true);
}

function computeWaitMs(evaluation, now = Date.now()) {
    if (!evaluation) return GATE_WAIT_DEFAULT_MS;
    const raw = evaluation.earliestResumeAt ? evaluation.earliestResumeAt - now : GATE_WAIT_DEFAULT_MS;
    return Math.min(Math.max(raw, GATE_WAIT_MIN_MS), GATE_WAIT_MAX_MS);
}

/** 打标记：缺口章记阻塞起始时间；缺口已消解（已归档）的清理历史标记 */
async function syncGateMarks(chapters, blockedBy, now = Date.now()) {
    const gapNums = new Set((blockedBy || []).map(g => g.chapterNumber));
    for (const ch of chapters) {
        const isGap = gapNums.has(chapterNumOf(ch));
        if (isGap) {
            if (!ch._gateBlockedSince) ch._gateBlockedSince = now;
            ch._gateBlocks = (ch._gateBlocks || 0) + 1;
            ch.updatedAt = new Date().toISOString();
            await store.setItem('chapters', ch.id, ch);
        } else if (ch._gateBlockedSince && isArchivedChapter(ch)) {
            delete ch._gateBlockedSince;
            ch.updatedAt = new Date().toISOString();
            await store.setItem('chapters', ch.id, ch);
        }
    }
}

/** 显式债务：放行但记录在案（装配/提示词据此注入"前章素材缺失"声明） */
async function recordMaterialDebt(projectId, chapterNumber, debt) {
    const chapters = await store.queryItems('chapters', { projectId });
    const target = chapters.find(c => chapterNumOf(c) === chapterNumber);
    if (!target) return null;
    target.materialDebt = {
        blockedChapters: debt.blockedChapters,
        reason: debt.reason,
        since: debt.since || Date.now(),
        at: new Date().toISOString()
    };
    target.updatedAt = new Date().toISOString();
    await store.setItem('chapters', target.id, target);
    logger.error('materialGate', `第${chapterNumber}章带债放行：${debt.reason}（缺口章 ${debt.blockedChapters.join('、')}）`, { materialDebt: target.materialDebt });
    return target.materialDebt;
}

/**
 * 门槛主入口：判定本章能否开工；可先补跑可修复的缺口章。
 * @returns {Promise<{ready:boolean, blockedBy:Array, repaired:Array, debt:object|null, report:string, earliestResumeAt:number}>}
 */
async function assertChapterReady({ projectId, chapterNumber, runPipelineStep = null, repair = true, persist = true, now = Date.now() }) {
    let chapters = await store.queryItems('chapters', { projectId });
    let evaluation = evaluateGate(chapters, chapterNumber, now);
    const repaired = [];

    if (!evaluation.ready && repair && runPipelineStep && evaluation.blockedBy.length > 0) {
        const repairable = evaluation.blockedBy.filter(g => g.status === STATUS_VALUES.APPROVED);
        if (repairable.length > 0) {
            const subset = chapters.filter(c => repairable.some(g => g.chapterNumber === chapterNumOf(c)));
            await catchupMaterialManager(projectId, subset, runPipelineStep, {});
            chapters = await store.queryItems('chapters', { projectId });
            for (const g of repairable) {
                const cur = chapters.find(c => chapterNumOf(c) === g.chapterNumber);
                repaired.push({
                    chapterNumber: g.chapterNumber,
                    ok: isArchivedChapter(cur),
                    error: isArchivedChapter(cur) ? null : '素材仍未归档'
                });
            }
            evaluation = evaluateGate(chapters, chapterNumber, Date.now());
        }
    }

    if (persist) {
        if (evaluation.ready && evaluation.debt) {
            await recordMaterialDebt(projectId, chapterNumber, evaluation.debt);
        } else if (!evaluation.ready) {
            logger.error('materialGate', `第${chapterNumber}章被门槛拦下：${evaluation.report}`, { blockedBy: evaluation.blockedBy });
        }
        await syncGateMarks(chapters, evaluation.blockedBy, now);
    }

    return { ...evaluation, repaired };
}

module.exports = {
    findGaps,
    evaluateGate,
    buildGateError,
    isGateError,
    computeWaitMs,
    assertChapterReady,
    recordMaterialDebt,
    GATE_ERROR_CODE,
    GATE_WAIT_MAX_MS,
    GATE_WAIT_DEFAULT_MS,
    DEBT_AFTER_MS,
    DEBT_MIN_RETRIES
};
