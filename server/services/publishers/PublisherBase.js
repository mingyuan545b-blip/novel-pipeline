const platformConfig = require('./platformConfig');
const browserManager = require('./browserManager');
const loginManager = require('./loginManager');
const editorHelpers = require('./editorHelpers');

module.exports = {
    PLATFORMS: platformConfig.PLATFORMS,
    publishStates: platformConfig.publishStates,
    getPlatformState: platformConfig.getPlatformState,
    getAllStates: platformConfig.getAllStates,
    addLog: platformConfig.addLog,
    stopPublish: platformConfig.stopPublish,
    takeScreenshot: browserManager.takeScreenshot,
    connectBrowser: browserManager.connectBrowser,
    closeBrowser: browserManager.closeBrowser,
    closeAllBrowsers: browserManager.closeAllBrowsers,
    checkLoginStatus: loginManager.checkLoginStatus,
    waitForLogin: loginManager.waitForLogin,
    ensureLogin: loginManager.ensureLogin,
    dismissEditorGuides: editorHelpers.dismissEditorGuides,
    handleInterceptors: editorHelpers.handleInterceptors,
    debugPageInputs: editorHelpers.debugPageInputs
};
