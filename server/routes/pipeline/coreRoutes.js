const router = require('express').Router();

// 挂载子路由
router.use(require('./pipelineDiagnosticRoutes'));
router.use(require('./pipelineExecutionRoutes'));
router.use(require('./pipelineChapterRoutes'));
router.use(require('./pipelineFeatureRoutes'));

module.exports = router;
