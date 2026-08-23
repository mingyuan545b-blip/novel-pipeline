const { cleanChapterContent } = require('./contentUtils');
const platformsModule = require('./publishPlatforms');
const queueModule = require('./publishQueue');
const interactionsModule = require('./publishInteractions');

module.exports = {
    getPlatforms: platformsModule.getPlatforms,
    getPlatform: platformsModule.getPlatform,
    addPlatformAccount: platformsModule.addPlatformAccount,
    getPlatformAccounts: platformsModule.getPlatformAccounts,
    updatePlatformAccount: platformsModule.updatePlatformAccount,
    deletePlatformAccount: platformsModule.deletePlatformAccount,
    verifyPlatformAccount: platformsModule.verifyPlatformAccount,
    addToPublishQueue: queueModule.addToPublishQueue,
    getPublishQueue: queueModule.getPublishQueue,
    updatePublishQueueItem: queueModule.updatePublishQueueItem,
    deletePublishQueueItem: queueModule.deletePublishQueueItem,
    formatContentForPlatform: queueModule.formatContentForPlatform,
    batchAddToQueue: queueModule.batchAddToQueue,
    addInteraction: interactionsModule.addInteraction,
    getInteractions: interactionsModule.getInteractions,
    updateInteraction: interactionsModule.updateInteraction,
    deleteInteraction: interactionsModule.deleteInteraction,
    getInteractionStats: interactionsModule.getInteractionStats,
    getPublishStats: queueModule.getPublishStats,
    cleanChapterContent
};
