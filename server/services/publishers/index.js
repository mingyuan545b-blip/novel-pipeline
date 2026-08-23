const { PLATFORMS, stopPublish, getPlatformState, getAllStates, closeBrowser, ensureLogin } = require('./PublisherBase');
const { publishToPlatform } = require('./publishOrchestrator');
const { checkPlatformLogin, openWriterBackend, openFanqieBookEditor } = require('./publishUtils');
const { updateChaptersToQimao } = require('./qimaoPublisher');
const { closeAllBrowsers } = require('./PublisherBase');

process.on('SIGINT', async () => { await closeAllBrowsers(); process.exit(0); });
process.on('SIGTERM', async () => { await closeAllBrowsers(); process.exit(0); });

module.exports = {
    PLATFORMS,
    publishToPlatform,
    stopPublish,
    getPlatformState,
    getAllStates,
    closeBrowser,
    checkPlatformLogin,
    openWriterBackend,
    openFanqieBookEditor,
    ensureLogin,
    updateChaptersToQimao
};
