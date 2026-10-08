/**
 * Data trimming/truncation for store items exceeding size limits.
 * Field-level truncation always applies (data quality guarantee).
 * Size-level truncation applies only when serialized data exceeds max.
 */
const { STORE_SIZE_LIMITS, STORE_DEFAULT_MAX_SIZE, STORE_TRIMMING } = require('../config/systemConfig');
const { normalizeMaterialRecord } = require('../config/materialShape');

const CHAPTER_TRUNC_FIELDS = {
    writerOutput: 'outputTruncateLength',
    firstReviewOutput: 'outputTruncateLength',
    secondReviewOutput: 'outputTruncateLength',
    finalEditorOutput: 'outputTruncateLength',
    materialManagerOutput: 'outputTruncateLength',
    readerOutput: 'readerOutputTruncate',
    adjusterOutput: 'adjusterOutputTruncate',
    reviserOutput: 'outputTruncateLength',
    reviserOutputRaw: 'outputTruncateLength',
    polisherOutput: 'outputTruncateLength'
};

function truncateField(data, field, configKey) {
    const maxLen = STORE_TRIMMING[configKey];
    if (data[field] && data[field].length > maxLen) {
        data[field] = data[field].substring(0, maxLen) + '\n...[truncated]';
    }
}

function trimChapterFields(data) {
    if (data.history && data.history.length > STORE_TRIMMING.chapterHistoryKeep) {
        data.history = data.history.slice(-STORE_TRIMMING.chapterHistoryKeep);
    }
    for (const [field, configKey] of Object.entries(CHAPTER_TRUNC_FIELDS)) {
        truncateField(data, field, configKey);
    }
}

function trimMaterialFields(data) {
    // T4：形状不变量（provenance / changeLog v2 / 时间戳 / version）——存储层单点兜底
    Object.assign(data, normalizeMaterialRecord(data));
    if (data.changeLog && data.changeLog.length > STORE_TRIMMING.materialChangeLogKeep) {
        data.changeLog = data.changeLog.slice(-STORE_TRIMMING.materialChangeLogKeep);
    }
    if (data.currentContent && data.currentContent.length > STORE_TRIMMING.materialContentMaxLen) {
        data.currentContent = data.currentContent.substring(0, STORE_TRIMMING.materialContentMaxLen) + '\n...[truncated]';
    }
}

function trimProjectFields(data) {
    if (data.chapters && data.chapters.length > STORE_TRIMMING.projectChaptersKeep) {
        data.chapters = data.chapters.slice(-STORE_TRIMMING.projectChaptersKeep);
    }
    // chapterIntents.chapters统一为对象类型{chapterId: intentData}
    // 历史数据可能是数组，此处兼容两种类型
    const intents = data.chapterIntents?.chapters;
    if (intents) {
        if (Array.isArray(intents)) {
            // 历史数组类型：按长度trim
            if (intents.length > STORE_TRIMMING.projectChapterIntentsKeep) {
                data.chapterIntents.chapters = intents.slice(-STORE_TRIMMING.projectChapterIntentsKeep);
            }
        } else {
            // 标准对象类型：按key数量trim
            const keys = Object.keys(intents);
            if (keys.length > STORE_TRIMMING.projectChapterIntentsKeep) {
                const keepKeys = keys.slice(-STORE_TRIMMING.projectChapterIntentsKeep);
                const trimmed = {};
                for (const k of keepKeys) trimmed[k] = intents[k];
                data.chapterIntents.chapters = trimmed;
            }
        }
    }
    if (data.description && data.description.length > STORE_TRIMMING.projectDescriptionMaxLength) {
        data.description = data.description.substring(0, STORE_TRIMMING.projectDescriptionMaxLength);
    }
}

function trimItemData(type, data) {
    const maxSize = STORE_SIZE_LIMITS[type] || STORE_DEFAULT_MAX_SIZE;

    // Field-level truncation always applies
    if (type === 'chapters') trimChapterFields(data);
    if (type === 'materials') trimMaterialFields(data);
    if (type === 'projects') trimProjectFields(data);

    let serialized = JSON.stringify(data, null, 2);
    if (serialized.length <= maxSize) return data;

    // Additional size-reduction for oversized items
    if (type === 'materials' && data.currentContent && data.currentContent.length > STORE_TRIMMING.materialContentMaxLen) {
        data.currentContent = data.currentContent.substring(0, STORE_TRIMMING.materialContentMaxLen) + '\n...[truncated]';
    }

    return data;
}

module.exports = { trimItemData };
