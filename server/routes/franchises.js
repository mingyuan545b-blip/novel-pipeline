const express = require('express');
const router = express.Router();

router.use(require('./franchiseCrudRoutes'));
router.use(require('./franchiseImportRoutes'));
router.use(require('./franchiseProductRoutes'));

module.exports = router;
