const router = require('express').Router();
const { GUIDE_DATA } = require('./guideData');

router.get('/', (req, res) => { res.json(GUIDE_DATA); });
router.get('/quick-start', (req, res) => { res.json(GUIDE_DATA.quickStart); });
router.get('/template', (req, res) => { res.json(GUIDE_DATA.templateGuide); });
router.get('/style-template', (req, res) => { res.json(GUIDE_DATA.styleTemplateGuide); });
router.get('/aipy-pro', (req, res) => { res.json(GUIDE_DATA.aipyProGuide); });
router.get('/pipeline-flow', (req, res) => { res.json(GUIDE_DATA.pipelineFlow); });
router.get('/comic', (req, res) => { res.json(GUIDE_DATA.comicGuide); });
router.get('/agent-roles', (req, res) => { res.json(GUIDE_DATA.agentRoles); });

module.exports = router;
