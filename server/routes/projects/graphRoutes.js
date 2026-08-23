const store = require('../../store');
const { buildRelationshipGraph } = require('../knowledge/relationshipGraphBuilder');
const { ERROR_CODES } = require('../../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

function registerGraphRoutes(router) {
    router.get('/:id/relationship-graph', async (req, res) => {
        const projectId = req.params.id;
        try {
            const graph = await buildRelationshipGraph(projectId);
            res.json(graph);
        } catch (e) {
            res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
        }
    });
}

module.exports = { registerGraphRoutes };
