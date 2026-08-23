const router = require('express').Router();
const { DEFAULT_MODEL } = require('../../config/modelResolver');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.get('/context-budget/:projectId', async (req, res) => {
    try {
        const { calculateMaxBatchChapters } = require('../../services/contextBudget');
        const model = process.env.ALIYUN_CODING_MODEL || DEFAULT_MODEL;
        const result = await calculateMaxBatchChapters(req.params.projectId, model);
        res.json(result);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/hook-budget/:projectId', async (req, res) => {
    try {
        const { getHookBudgetForProject } = require('../../services/hookBudget');
        const hookBudget = getHookBudgetForProject(req.params.projectId);
        const currentChapter = parseInt(req.query.chapter) || 0;
        res.json({
            budget: await hookBudget.getBudgetStatus(currentChapter),
            agenda: await hookBudget.generateHookAgenda(currentChapter),
            summary: await hookBudget.getHooksSummary()
        });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/rule-stack/:projectId', async (req, res) => {
    try {
        const { getRuleStackForProject } = require('../../services/ruleStack');
        const ruleStack = getRuleStackForProject(req.params.projectId);
        res.json({
            summary: await ruleStack.getStackSummary(),
            effectiveRules: await ruleStack.getEffectiveRules(req.query.context || 'writer'),
            formattedPrompt: await ruleStack.formatRuleStackForPrompt(req.query.context || 'writer')
        });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/chapter-intent/:projectId/:chapterNumber', async (req, res) => {
    try {
        const { getChapterIntentPlanner } = require('../../services/chapterIntent');
        const planner = getChapterIntentPlanner(req.params.projectId);
        const chapterNumber = parseInt(req.params.chapterNumber);
        const intent = await planner.getIntent(chapterNumber);
        if (!intent) return res.apiError(NOT_FOUND.statusCode, '意图尚未生成', NOT_FOUND.code);
        res.json({ intent, formattedPrompt: await planner.formatIntentForPrompt(chapterNumber) });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/context-trace/:projectId/:chapterNumber', async (req, res) => {
    try {
        const { getContextTraceForProject } = require('../../services/contextTrace');
        const trace = getContextTraceForProject(req.params.projectId);
        const chapterNumber = parseInt(req.params.chapterNumber);
        const chapterTrace = await trace.getChapterTrace(chapterNumber);
        if (!chapterTrace) return res.apiError(NOT_FOUND.statusCode, '追踪记录不存在', NOT_FOUND.code);
        res.json(chapterTrace);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/hook-budget/:projectId/register', async (req, res) => {
    try {
        const { getHookBudgetForProject } = require('../../services/hookBudget');
        const hookBudget = getHookBudgetForProject(req.params.projectId);
        const hook = await hookBudget.registerHook(req.body);
        res.json(hook);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/hook-budget/:projectId/sync', async (req, res) => {
    try {
        const { getHookBudgetForProject } = require('../../services/hookBudget');
        const hookBudget = getHookBudgetForProject(req.params.projectId);
        const imported = await hookBudget.syncFromForeshadowingMaterials();
        res.json({ imported, summary: await hookBudget.getHooksSummary() });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/rule-stack/:projectId/extract', async (req, res) => {
    try {
        const { getRuleStackForProject } = require('../../services/ruleStack');
        const ruleStack = getRuleStackForProject(req.params.projectId);
        const imported = await ruleStack.extractRulesFromMaterials();
        res.json({ imported, summary: await ruleStack.getStackSummary() });
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/prompt-audit/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const mode = req.query.mode || 'novel';
        const promptAuditor = require('../../services/promptAuditor');
        const report = await promptAuditor.getFullReport(projectId, mode);
        res.json(report);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/prompt-audit-latest', (req, res) => {
    try {
        const promptAuditor = require('../../services/promptAuditor');
        const lastAudit = promptAuditor.getLastAudit();
        if (!lastAudit) return res.json({ healthScore: -1, summary: '暂无审计数据' });
        res.json(lastAudit);
    } catch (error) {
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
