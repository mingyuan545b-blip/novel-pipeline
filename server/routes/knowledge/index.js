const express = require('express');
const router = express.Router();

const memoryRoutes = require('./memoryRoutes');
const snapshotRoutes = require('./snapshotRoutes');
const consistencyRoutes = require('./consistencyRoutes');
const timelineRoutes = require('./timelineRoutes');
const lifecycleRoutes = require('./lifecycleRoutes');
const graphRoutes = require('./graphRoutes');
const knowledgeAccessRoutes = require('./knowledgeAccessRoutes');

router.use('/', memoryRoutes);
router.use('/', snapshotRoutes);
router.use('/', consistencyRoutes);
router.use('/', timelineRoutes);
router.use('/', lifecycleRoutes);
router.use('/', graphRoutes);
router.use('/knowledge-access', knowledgeAccessRoutes);

module.exports = router;
