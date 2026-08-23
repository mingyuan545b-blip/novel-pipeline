const express = require('express');
const router = express.Router();

// Merge sub-routers
const registryRoutes = require('./flavorRegistryRoutes');
const projectPromptRoutes = require('./flavorProjectPrompt');

router.use(registryRoutes);
router.use(projectPromptRoutes);

module.exports = router;
