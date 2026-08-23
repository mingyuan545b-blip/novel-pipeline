const router = require('express').Router();
const license = require('../services/license');

router.get('/', (req, res) => {
    const versionInfo = license.getVersionInfo();
    res.json(versionInfo);
});

router.post('/check', (req, res) => {
    const remoteInfo = req.body;
    const updateCheck = license.checkForUpdate(remoteInfo);
    res.json(updateCheck);
});

module.exports = router;
