const router = require('express').Router();
const promptTemplateRoutes = require('./promptTemplateRoutes');
const promptStyleRoutes = require('./promptStyleRoutes');

router.use(promptTemplateRoutes);
router.use(promptStyleRoutes);

module.exports = router;
