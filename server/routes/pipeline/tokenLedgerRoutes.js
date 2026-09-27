'use strict';

/**
 * tokenLedgerRoutes.js — Token 去向面板 API
 *
 * GET /token-ledger/:projectId                       → 总览/逐章/分步/分段/场景/趋势/告警
 * GET /token-ledger/:projectId/chapter/:chapterNumber → 单章每次调用的明细（含截断分段）
 *
 * 数据来源：token-ledger（账本）+ context-assemblies（场景/阶段）+ chapters（字数）
 * 文件位置：server/routes/pipeline/tokenLedgerRoutes.js
 */
const router = require('express').Router();
const store = require('../../store');
const logger = require('../../shared/logger');
const tokenLedger = require('../../services/pipeline/tokenLedger');
const { buildTokenLedgerView } = require('../../services/pipeline/tokenLedgerView');
const { ASSEMBLY_STORE } = require('../../services/contextTrace');
const { slotMeta } = require('../../config/tokenSlotLabels');
const { AGENT_ROLE_NAMES } = require('../../services/fileOutput');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { INTERNAL_ERROR, VALIDATION_ERROR } = ERROR_CODES;

/** 章号 → { sceneTypes, phase }（取任一 Agent 记录的 meta；writer 优先） */
async function loadChapterMeta(projectId) {
    const rows = await store.queryItems(ASSEMBLY_STORE, { projectId });
    const map = {};
    for (const r of rows) {
        const ch = r.chapter ?? Number(String(r.chapterKey || '').replace('chapter-', '').replace(/^0+/, ''));
        if (!ch) continue;
        if (!map[ch] || r.agentType === 'writer') {
            map[ch] = { sceneTypes: r.meta?.sceneTypes || [], phase: r.meta?.phase || 'unknown' };
        }
    }
    return map;
}

/** 章号 → 字数 */
async function loadWordCounts(projectId) {
    const chapters = await store.queryItems('chapters', { projectId });
    const map = {};
    for (const ch of chapters) {
        const n = ch.chapterNumber;
        if (n) map[n] = ch.wordCount || (ch.content ? ch.content.length : 0);
    }
    return map;
}

router.get('/token-ledger/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const [ledger, assemblies, wordCounts] = await Promise.all([
            tokenLedger.getProjectLedger(projectId),
            loadChapterMeta(projectId),
            loadWordCounts(projectId),
        ]);
        res.json(buildTokenLedgerView({ projectId, ledger, assemblies, wordCounts }));
    } catch (e) {
        logger.warn('tokenLedgerRoutes', 'build view failed:', e.message);
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/token-ledger/:projectId/chapter/:chapterNumber', async (req, res) => {
    try {
        const chapterNumber = parseInt(req.params.chapterNumber, 10);
        if (!chapterNumber || chapterNumber < 1) {
            return res.apiError(VALIDATION_ERROR.statusCode, 'chapterNumber must be >= 1', VALIDATION_ERROR.code);
        }
        const calls = await tokenLedger.getChapterLedger(req.params.projectId, chapterNumber);
        // 分段名与步骤名统一转中文（唯一数据源：tokenSlotLabels / AGENT_ROLE_NAMES）
        const detailed = calls.map(c => ({
            ...c,
            stepLabel: AGENT_ROLE_NAMES[c.step] || c.step,
            promptSections: (c.promptSections || []).map(sec => ({ ...sec, label: slotMeta(sec.slot).label })),
        }));
        res.json({ chapterNumber, count: detailed.length, calls: detailed });
    } catch (e) {
        logger.warn('tokenLedgerRoutes', 'chapter detail failed:', e.message);
        res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
