const { STORE_SIZE_LIMITS, STORE_DEFAULT_MAX_SIZE, STORE_TRIMMING } = require('../config/systemConfig');
const { CRAFT_TYPES } = require('../config/materialTypes');
const { normalizeMaterialRecord } = require('../config/materialShape');

function isFoundationMaterialCheck(mat, getFactionFn, visited = new Set(), depth = 0) {
    if (!mat) return false;
    if (depth > 5) return false;
    if (mat.isFoundation === true) return true;
    if (mat.isFoundation === false) return false;
    if (mat.sourceChapter) return false;
    if (CRAFT_TYPES.has(mat.type) && !mat.parentPlane) return true;
    if (['worldview', 'power-system'].includes(mat.type) && !mat.parentPlane) return true;
    if (mat.type === 'faction' && mat.parentPlane === null) return true;
    if (mat.type === 'institution' && mat.parentPlane === null) return true;
    if (mat.type === 'character' && mat.parentFaction) {
        if (visited.has(mat.parentFaction)) return false;
        visited.add(mat.parentFaction);
        const fac = getFactionFn(mat.parentFaction);
        if (fac && isFoundationMaterialCheck(fac, getFactionFn, visited, depth + 1)) return true;
    }
    return false;
}

function applyFilter(items, filter) {
    if (!filter) return items;
    if (typeof filter === 'function') return items.filter(filter);
    return items.filter(item => {
        return Object.keys(filter).every(key => {
            return item[key] === filter[key];
        });
    });
}

function trimItemData(type, data) {
    const maxSize = STORE_SIZE_LIMITS[type] || STORE_DEFAULT_MAX_SIZE;
    let serialized = JSON.stringify(data, null, 2);

    if (serialized.length <= maxSize) return data;

    if (type === 'chapters' && data.history) {
        data.history = data.history.slice(-STORE_TRIMMING.chapterHistoryKeep);
        const truncFields = {
            writerOutput: STORE_TRIMMING.outputTruncateLength,
            firstReviewOutput: STORE_TRIMMING.outputTruncateLength,
            secondReviewOutput: STORE_TRIMMING.outputTruncateLength,
            finalEditorOutput: STORE_TRIMMING.outputTruncateLength,
            materialManagerOutput: STORE_TRIMMING.outputTruncateLength,
            readerOutput: STORE_TRIMMING.readerOutputTruncate,
            reviserOutput: STORE_TRIMMING.outputTruncateLength,
            reviserOutputRaw: STORE_TRIMMING.outputTruncateLength,
            polisherOutput: STORE_TRIMMING.outputTruncateLength
        };
        for (const [field, maxLen] of Object.entries(truncFields)) {
            if (data[field] && data[field].length > maxLen) {
                data[field] = data[field].substring(0, maxLen) + '\n...[truncated]';
            }
        }
    }

    if (type === 'materials') {
        // T4：形状不变量（PG 写入路径同样单点兜底）
        Object.assign(data, normalizeMaterialRecord(data));
        if (data.changeLog && data.changeLog.length > STORE_TRIMMING.materialChangeLogKeep) {
            data.changeLog = data.changeLog.slice(-STORE_TRIMMING.materialChangeLogKeep);
        }
    }

    if (type === 'projects') {
        if (data.chapters && data.chapters.length > STORE_TRIMMING.projectChaptersKeep) {
            data.chapters = data.chapters.slice(-STORE_TRIMMING.projectChaptersKeep);
        }
        if (data.chapterIntents?.chapters) {
            if (Array.isArray(data.chapterIntents.chapters)) {
                if (data.chapterIntents.chapters.length > STORE_TRIMMING.projectChapterIntentsKeep) {
                    data.chapterIntents.chapters = data.chapterIntents.chapters.slice(-STORE_TRIMMING.projectChapterIntentsKeep);
                }
            } else {
                const keys = Object.keys(data.chapterIntents.chapters);
                if (keys.length > STORE_TRIMMING.projectChapterIntentsKeep) {
                    const keepKeys = keys.slice(-STORE_TRIMMING.projectChapterIntentsKeep);
                    const trimmed = {};
                    for (const k of keepKeys) trimmed[k] = data.chapterIntents.chapters[k];
                    data.chapterIntents.chapters = trimmed;
                }
            }
        }
        if (data.description && data.description.length > STORE_TRIMMING.projectDescriptionMaxLength) {
            data.description = data.description.substring(0, STORE_TRIMMING.projectDescriptionMaxLength);
        }
    }

    return data;
}

function applySizeLimit(type, data) {
    const maxSize = STORE_SIZE_LIMITS[type] || STORE_DEFAULT_MAX_SIZE;
    let serialized = JSON.stringify(data, null, 2);

    if (serialized.length > maxSize * 1.5) {
        serialized = JSON.stringify(data);
    }

    return { serialized, oversized: serialized.length > maxSize };
}

module.exports = { trimItemData, applySizeLimit, isFoundationMaterialCheck, applyFilter };
