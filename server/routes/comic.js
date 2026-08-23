const router = require('express').Router();

router.use(require('./comic/comicStoryboardRoutes'));
router.use(require('./comic/comicTtsExportRoutes'));
router.use(require('./comic/comicComfyuiRoutes'));

module.exports = router;
