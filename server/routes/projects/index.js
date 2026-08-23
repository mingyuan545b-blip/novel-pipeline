const express = require('express');
const { registerCrudRoutes } = require('./crudRoutes');
const { registerGraphRoutes } = require('./graphRoutes');
const { registerStyleRoutes } = require('./styleRoutes');
const { registerCleanupRoutes } = require('./cleanupRoutes');
const { registerInitializeRoutes } = require('./initializeRoutes');
const { registerProjectConfigRoutes } = require('./projectConfigRoutes');

const router = express.Router();

registerCrudRoutes(router);
registerGraphRoutes(router);
registerStyleRoutes(router);
registerCleanupRoutes(router);
registerInitializeRoutes(router);
registerProjectConfigRoutes(router);

module.exports = router;
