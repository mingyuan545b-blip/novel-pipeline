const logger = require('../../shared/logger');

const AGENT_CONSTRAINT_MAP = {
    'outline-generator': ['perspective', 'genre', 'worldview', 'naming'],
    'writer': ['perspective', 'genre', 'behavior', 'dialogue', 'naming', 'worldview'],
    'first-review': ['perspective', 'genre', 'behavior', 'dialogue'],
    'fast-review': ['perspective', 'genre'],
    'second-review': ['perspective', 'genre', 'behavior', 'dialogue'],
    'final-editor': ['perspective', 'genre', 'behavior', 'dialogue', 'naming'],
    'polisher': ['perspective', 'genre', 'naming'],
    'material-manager': ['genre', 'worldview', 'naming'],
    'consistency-constraint': ['perspective', 'genre', 'behavior', 'worldview']
};

function getAgentConstraintIds(agentId) {
    return AGENT_CONSTRAINT_MAP[agentId] || [];
}

function getAllAgentIds() {
    return Object.keys(AGENT_CONSTRAINT_MAP);
}

module.exports = { AGENT_CONSTRAINT_MAP, getAgentConstraintIds, getAllAgentIds };
