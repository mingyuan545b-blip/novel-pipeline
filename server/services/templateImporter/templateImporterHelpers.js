const store = require('../../store');
const { getDataContext } = require('../dataContext');

async function _importChapters(template, projectId, overwrite, uuidv4, result) {
    if (!template.chapters || template.chapters.length === 0) return;
    let created = 0, chSkipped = 0;
    const existingChapters = await store.queryItems('chapters', { projectId });
    const existingChNums = new Set(existingChapters.map(ec => ec.chapterNumber));
    for (const c of template.chapters) {
        if (existingChNums.has(c.chapterNumber)) { chSkipped++; continue; }
        const chId = c.id || uuidv4();
        await store.setItem('chapters', chId, { id: chId, projectId, chapterNumber: c.chapterNumber, title: c.title || `第${c.chapterNumber}章`, outline: c.outline || '', status: 'outlined', round: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        created++;
    }
    result.created['chapters'] = created;
    if (chSkipped > 0) result.skipped['chapters'] = `${chSkipped} duplicates by chapterNumber`;
}

async function _importQuests(template, projectId, overwrite, uuidv4, result) {
    if (!template.quests || template.quests.length === 0) return;
    let created = 0, qSkipped = 0;
    const existingQuests = await store.queryItems('quests', { projectId });
    const existingQNames = new Set(existingQuests.map(eq => eq.name));
    for (const q of template.quests) {
        const qName = q.name || q.title || '';
        if (existingQNames.has(qName)) { qSkipped++; continue; }
        const qId = q.id || uuidv4();
        await store.setItem('quests', qId, { id: qId, projectId, name: qName, type: q.type || 'main', description: q.description || '', status: q.status || 'pending', relatedChapters: q.relatedChapters || [], subQuests: q.subQuests || [], createdAt: new Date().toISOString() });
        created++;
    }
    result.created['quests'] = created;
    if (qSkipped > 0) result.skipped['quests'] = `${qSkipped} duplicates by name`;
}

async function _importTimelines(template, projectId, overwrite, uuidv4, result) {
    if (!template.timelines || template.timelines.length === 0) return;
    let created = 0, tSkipped = 0;
    const existingTimelines = await store.queryItems('timelines', { projectId });
    const existingTNames = new Set(existingTimelines.map(et => et.name));
    for (const t of template.timelines) {
        const tName = t.name || t.title || '';
        if (existingTNames.has(tName)) { tSkipped++; continue; }
        const tId = t.id || uuidv4();
        await store.setItem('timelines', tId, { id: tId, projectId, name: tName, events: t.events || [], createdAt: new Date().toISOString() });
        created++;
    }
    result.created['timelines'] = created;
    if (tSkipped > 0) result.skipped['timelines'] = `${tSkipped} duplicates by name`;
}

async function _importMapNodes(template, projectId, overwrite, uuidv4, result) {
    if (!template.mapNodes || template.mapNodes.length === 0) return;
    let created = 0, nSkipped = 0;
    const existingNodes = await store.queryItems('map-nodes', { projectId });
    const existingNNames = new Set(existingNodes.map(en => en.name));
    for (const n of template.mapNodes) {
        if (existingNNames.has(n.name || '')) { nSkipped++; continue; }
        const nId = n.id || uuidv4();
        await store.setItem('map-nodes', nId, { id: nId, projectId, name: n.name || '', type: n.type || 'location', description: n.description || '', parentId: n.parentId || null, children: n.children || [], x: n.x || 0, y: n.y || 0, createdAt: new Date().toISOString() });
        created++;
    }
    result.created['mapNodes'] = created;
    if (nSkipped > 0) result.skipped['mapNodes'] = `${nSkipped} duplicates by name`;
}

module.exports = { _importChapters, _importQuests, _importTimelines, _importMapNodes };
