/**
 * Jest config used only by Stryker.
 *
 * - Limits discovery to the tests that cover the mutation targets.
 * - forceExit prevents the project's background timers/watchers from keeping
 *   Jest workers alive after the dry run.
 */
const base = require('./jest.config');

module.exports = {
    ...base,
    forceExit: true,
    roots: ['<rootDir>/tests'],
    testMatch: [
        '<rootDir>/tests/unit/validateQuotes.test.js',
        '<rootDir>/tests/unit/validateHighlights.test.js',
        '<rootDir>/tests/unit/craftWriteGate.test.js',
        '<rootDir>/tests/unit/entityWriteGateWiring.test.js',
        '<rootDir>/tests/unit/materialRegistrarTriage.test.js',
        '<rootDir>/tests/unit/verifyProjectStandards.test.js'
    ]
};
