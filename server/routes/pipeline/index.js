const router = require('express').Router();

const coreRoutes = require('./coreRoutes');
const infiniteRoutes = require('./infiniteRoutes');
const materialRoutes = require('./materialRoutes');
const toolRoutes = require('./toolRoutes');
const taskRoutes = require('./taskRoutes');
const subplaneRoutes = require('./subplaneRoutes');
const templateRoutes = require('./templateRoutes');
const pipelineOutputRoutes = require('./pipelineOutputRoutes');
const progressRoutes = require('./progressRoutes');

router.use('/', coreRoutes);
router.use('/infinite', infiniteRoutes);
router.use('/', materialRoutes);
router.use('/', toolRoutes);
router.use('/', taskRoutes);
router.use('/', subplaneRoutes);
router.use('/', templateRoutes);
router.use('/', pipelineOutputRoutes);
// 运行看板：进度/当前步骤/Agent 耗时（合成端点，避免前端多请求时序不一致）
router.use('/', progressRoutes);

module.exports = router;
