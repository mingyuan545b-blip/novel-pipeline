const { resolveReference, resolveParentPlane, resolveParentFaction, normalizeMaterial, getProtagonistName } = require('./materialRefResolver');
const { checkIntegrity } = require('./materialIntegrityCheck');
const { autoFix } = require('./materialIntegrityFix');

module.exports = {
    resolveReference,
    resolveParentPlane,
    resolveParentFaction,
    checkIntegrity,
    autoFix,
    normalizeMaterial,
    getProtagonistName
};
