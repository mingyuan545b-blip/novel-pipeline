module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    testTimeout: 30000,
    collectCoverageFrom: [
        'server/config/**/*.js',
        'server/db/**/*.js',
        'server/services/materialValidator.js',
        'server/services/genreConfig.js',
        'server/store.js'
    ],
    transform: {},
    moduleFileExtensions: ['js', 'json']
};
