const { v4: uuidv4 } = require('uuid');
const store = require('../store');

async function addInteraction(projectId, interactionData) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const interaction = {
        id,
        projectId,
        platformName: interactionData.platformName || '',
        chapterNumber: interactionData.chapterNumber || 0,
        type: interactionData.type || 'comment',
        author: interactionData.author || 'anonymous',
        content: interactionData.content || '',
        rating: interactionData.rating || null,
        reply: interactionData.reply || '',
        repliedAt: interactionData.repliedAt || null,
        isRead: false,
        needsReply: interactionData.needsReply || false,
        tags: interactionData.tags || [],
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('interactions', id, interaction);
    return interaction;
}

async function getInteractions(projectId, filter) {
    let items = await store.queryItems('interactions', { projectId });
    if (filter?.type) items = items.filter(i => i.type === filter.type);
    if (filter?.isRead !== undefined) items = items.filter(i => i.isRead === filter.isRead);
    if (filter?.needsReply) items = items.filter(i => i.needsReply);
    return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function updateInteraction(id, data) {
    const item = await store.getItem('interactions', id);
    if (!item) return null;
    const updated = { ...item, ...data, updatedAt: new Date().toISOString() };
    await store.setItem('interactions', id, updated);
    return updated;
}

async function deleteInteraction(id) {
    return await store.deleteItem('interactions', id);
}

async function getInteractionStats(projectId) {
    const interactions = await store.queryItems('interactions', { projectId });
    const stats = {
        total: interactions.length,
        comments: interactions.filter(i => i.type === 'comment').length,
        reviews: interactions.filter(i => i.type === 'review').length,
        tips: interactions.filter(i => i.type === 'tip').length,
        questions: interactions.filter(i => i.type === 'question').length,
        unread: interactions.filter(i => !i.isRead).length,
        needsReply: interactions.filter(i => i.needsReply && !i.reply).length,
        avgRating: 0
    };
    const rated = interactions.filter(i => i.rating);
    if (rated.length > 0) {
        stats.avgRating = (rated.reduce((sum, i) => sum + i.rating, 0) / rated.length).toFixed(1);
    }
    return stats;
}

module.exports = {
    addInteraction,
    getInteractions,
    updateInteraction,
    deleteInteraction,
    getInteractionStats
};
