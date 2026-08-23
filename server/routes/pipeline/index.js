const router = require('express').Router();

const coreRoutes = require('./coreRoutes');
const infiniteRoutes = require('./infiniteRoutes');
const materialRoutes = require('./materialRoutes');
const toolRoutes = require('./toolRoutes');
const taskRoutes = require('./taskRoutes');
const subplaneRoutes = require('./subplaneRoutes');
const templateRoutes = require('./templateRoutes');
const pipelineOutputRoutes = require('./pipelineOutputRoutes');

router.use('/', coreRoutes);
router.use('/infinite', infiniteRoutes);
router.use('/', materialRoutes);
router.use('/', toolRoutes);
router.use('/', taskRoutes);
router.use('/', subplaneRoutes);
router.use('/', templateRoutes);
router.use('/', pipelineOutputRoutes);

module.exports = router;
