/**
 * characterChronicle — 角色编年史模块
 *
 * 三级开关：off / basic / full
 * 数据存储: character-chronicle store
 * LLM提取: chronicleExtractor.js
 */
const store = require('../store');
const entityCenter = require('./entityCenter');
const { extractChronicleFromChapter } = require('./chronicleExtractor');
const logger = require('../shared/logger');

const STORE_TYPE = 'character-chronicle';

async function saveChronicleEntry(projectId, entityId, entityName, chapterNumber, data) {
    const id = `chr-${entityId}-ch${chapterNumber}`;
    const entry = {
        id, projectId, entityId, entityName, chapterNumber,
        stance: data.stance || '',
        innerConflict: data.innerConflict || '',
        quotes: data.quotes || [],
        deeds: data.deeds || [],
        stanceShiftReason: data.stanceShiftReason || '',
        level: data.level || 'basic',
        createdAt: new Date().toISOString()
    };
    await store.setItem(STORE_TYPE, id, entry);
    return entry;
}

async function extractAndSave(projectId, chapterNumber, chapterContent, level) {
    const extracted = await extractChronicleFromChapter(projectId, chapterNumber, chapterContent, level);
    if (extracted.length === 0) return [];

    const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
    const saved = [];

    for (const item of extracted) {
        const entity = _matchEntity(entities, item.name);
        if (!entity) continue;

        const entry = await saveChronicleEntry(projectId, entity.id, entity.name, chapterNumber, {
            ...item, level
        });

        if (item.stance || item.innerConflict) {
            try {
                await entityCenter.updateEntity(entity.id, {
                    genreState: {
                        independentStance: item.stance,
                        innerConflict: item.innerConflict,
                        lastChronicleChapter: chapterNumber
                    }
                });
            } catch (err) {
                logger.warn('chronicle', `Failed to update entity genreState: ${err.message}`);
            }
        }
        saved.push(entry);
    }

    logger.info('chronicle', `Saved ${saved.length} chronicle entries for ch${chapterNumber} (level=${level})`);
    return saved;
}

async function getChronicleForEntity(entityId, options = {}) {
    const all = await store.queryItems(STORE_TYPE, { entityId });
    let results = all.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    if (options.fromChapter) results = results.filter(c => c.chapterNumber >= options.fromChapter);
    if (options.toChapter) results = results.filter(c => c.chapterNumber <= options.toChapter);
    return results;
}

async function getChronicleForProject(projectId, options = {}) {
    const all = await store.queryItems(STORE_TYPE, { projectId });
    let results = all.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    if (options.fromChapter) results = results.filter(c => c.chapterNumber >= options.fromChapter);
    if (options.toChapter) results = results.filter(c => c.chapterNumber <= options.toChapter);
    if (options.entityId) results = results.filter(c => c.entityId === options.entityId);
    return results;
}

function formatChronicleForPrompt(chronicleData, level) {
    if (!chronicleData || chronicleData.length === 0) return '';
    const lines = ['【角色编年史——当前立场提醒】'];
    for (const c of chronicleData) {
        let line = `▸ ${c.entityName}：立场=${c.stance || '未知'}`;
        if (c.innerConflict) line += ` | 内心矛盾=${c.innerConflict}`;
        if (level === 'full' && c.stanceShiftReason) line += ` | 立场转变原因=${c.stanceShiftReason}`;
        lines.push(line);
    }
    lines.push('写作时必须尊重角色当前立场，不得让角色做出与立场矛盾的行为。');
    return lines.join('\n');
}

async function getRecentChronicleForPrompt(projectId, currentChapter, level, windowSize = 3) {
    const fromChapter = Math.max(1, currentChapter - windowSize);
    const all = await getChronicleForProject(projectId, { fromChapter, toChapter: currentChapter - 1 });
    const latestByEntity = new Map();
    for (const c of all) {
        const existing = latestByEntity.get(c.entityId);
        if (!existing || c.chapterNumber > existing.chapterNumber) {
            latestByEntity.set(c.entityId, c);
        }
    }
    return formatChronicleForPrompt([...latestByEntity.values()], level);
}

async function detectStanceShift(projectId, chapterNumber, readerOutput) {
    if (!readerOutput) return;
    try {
        const { extractJSON } = require('./jsonUtils');
        const parsed = extractJSON(readerOutput);
        const hardIssues = parsed?.hardIssues || [];
        const stanceIssues = hardIssues.filter(i =>
            i.type === 'stance-shift' || i.type === 'character-inconsistency'
        );
        if (stanceIssues.length === 0) return;

        const entities = await entityCenter.getEntitiesForProject(projectId, { entityType: 'character' });
        for (const issue of stanceIssues) {
            const entity = _matchEntity(entities, issue.character || issue.name);
            if (!entity) continue;
            await saveChronicleEntry(projectId, entity.id, entity.name, chapterNumber, {
                stance: issue.currentStance || '',
                innerConflict: '',
                stanceShiftReason: issue.description || '',
                level: 'basic'
            });
        }
    } catch (err) {
        logger.warn('chronicle', `detectStanceShift failed: ${err.message}`);
    }
}

function _matchEntity(entities, name) {
    if (!name) return null;
    const normalized = name.toLowerCase().replace(/[\s\-_··]/g, '');
    return entities.find(e => {
        const eName = (e.name || '').toLowerCase().replace(/[\s\-_··]/g, '');
        return eName === normalized || eName.includes(normalized) || normalized.includes(eName);
    }) || null;
}

module.exports = {
    extractAndSave,
    saveChronicleEntry,
    getChronicleForEntity,
    getChronicleForProject,
    formatChronicleForPrompt,
    getRecentChronicleForPrompt,
    detectStanceShift,
    STORE_TYPE
};
