const store = require('../server/store');
const crypto = require('crypto');
const { subPlaneUpdates } = require('./fix-subplane-abilities');

const pid = '7804d8fd-c4f1-4d55-afdd-5754ab8af167';

const unlockStatus = {
    '次位面·沉默之域': true,
    '次位面·锈蚀王庭': true,
};

const subPlanes = Object.entries(subPlaneUpdates).map(([name, content]) => ({
    name,
    content,
    unlocked: unlockStatus[name] || false
}));

subPlanes.forEach(sp => {
    const id = crypto.randomUUID();
    store.setItem('materials', id, {
        id,
        projectId: pid,
        type: 'sub-plane',
        name: sp.name,
        initialContent: sp.content,
        currentContent: sp.content,
        tags: [sp.unlocked ? 'unlocked' : 'locked'],
        isLocked: !sp.unlocked,
        unlockChapter: sp.unlocked ? 0 : -1,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
});

console.log('Sub-plane materials created:', subPlanes.length);
const allMats = store.queryItems('materials', { projectId: pid });
console.log('Total materials:', allMats.length);
const unlocked = allMats.filter(m => m.name.includes('次位面') && !m.isLocked);
const locked = allMats.filter(m => m.name.includes('次位面') && m.isLocked);
console.log('Unlocked sub-planes:', unlocked.length, '- ', unlocked.map(m => m.name).join(', '));
console.log('Locked sub-planes:', locked.length, '- ', locked.map(m => m.name).join(', '));
