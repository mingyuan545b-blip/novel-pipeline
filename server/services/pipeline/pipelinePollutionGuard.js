const { PipelineContractError } = require('./pipelineErrors');
const { POLLUTION_SEVERITY, PIPELINE_CONTRACT, extractChineseNames, extractSettingKeywords, calcSimilarity } = require('./pollutionPatterns');

function detectCharacterPollution(content, materialNames) {
    if (!content || !materialNames || materialNames.length === 0) {
        return { hasPollution: false, unknownNames: [], knownNames: [] };
    }

    const charNames = materialNames.filter(m => m.type === 'character').map(m => m.name);
    if (charNames.length === 0) return { hasPollution: false, unknownNames: [], knownNames: [] };

    const extractedNames = extractChineseNames(content);
    const knownNames = [];
    const unknownNames = [];

    for (const name of extractedNames) {
        const isKnown = charNames.some(cn => cn === name || cn.includes(name) || name.includes(cn));
        if (isKnown) {
            knownNames.push(name);
        } else if (!PIPELINE_CONTRACT.COMMON_WORDS_EXCLUDE.includes(name) && name.length >= 2) {
            unknownNames.push(name);
        }
    }

    return { hasPollution: unknownNames.length > 0, unknownNames: [...new Set(unknownNames)], knownNames: [...new Set(knownNames)] };
}

function detectMaterialDuplication(materials) {
    if (!materials || materials.length === 0) return { hasDuplication: false, duplicates: [] };

    const duplicates = [];
    const nameMap = new Map();

    for (const mat of materials) {
        if (mat.archived) continue;
        const key = `${mat.type}:${mat.name}`;
        if (nameMap.has(key)) {
            const existing = nameMap.get(key);
            duplicates.push({ type: 'same_name', name: mat.name, materialType: mat.type, ids: [existing.id, mat.id], message: `素材"${mat.name}"(${mat.type})存在重复：${existing.id} 和 ${mat.id}` });
        } else {
            nameMap.set(key, mat);
        }
    }

    const charMats = materials.filter(m => m.type === 'character' && !m.archived);
    for (let i = 0; i < charMats.length; i++) {
        for (let j = i + 1; j < charMats.length; j++) {
            const a = charMats[i], b = charMats[j];
            if (a.name === b.name) continue;
            const contentA = (a.currentContent || a.initialContent || '').substring(0, PIPELINE_CONTRACT.SIMILARITY_COMPARE_LENGTH);
            const contentB = (b.currentContent || b.initialContent || '').substring(0, PIPELINE_CONTRACT.SIMILARITY_COMPARE_LENGTH);
            if (contentA.length > PIPELINE_CONTRACT.CONTENT_MIN_LENGTH && contentB.length > PIPELINE_CONTRACT.CONTENT_MIN_LENGTH) {
                const similarity = calcSimilarity(contentA, contentB);
                if (similarity > PIPELINE_CONTRACT.DUPLICATE_SIMILARITY_THRESHOLD) {
                    duplicates.push({ type: 'similar_content', name: `${a.name} vs ${b.name}`, materialType: 'character', ids: [a.id, b.id], similarity, message: `角色"${a.name}"和"${b.name}"内容相似度${(similarity * 100).toFixed(0)}%` });
                }
            }
        }
    }

    return { hasDuplication: duplicates.length > 0, duplicates };
}

function detectSettingDrift(reviewOutput, materialNames) {
    if (!reviewOutput || !materialNames || materialNames.length === 0) return { hasDrift: false, driftItems: [] };

    const driftItems = [];
    const charMats = materialNames.filter(m => m.type === 'character');

    for (const char of charMats) {
        const content = char.content || '';
        if (!content) continue;
        const settingKeywords = extractSettingKeywords(content);

        for (const keyword of settingKeywords) {
            const charMentionPattern = new RegExp(`${char.name}[^。！？\n]{0,30}(?!${keyword})`, 'g');
            const mentions = reviewOutput.match(charMentionPattern) || [];
            if (mentions.length > 0 && reviewOutput.includes(char.name)) {
                const hasCorrectSetting = reviewOutput.includes(keyword);
                if (!hasCorrectSetting && keyword.length >= PIPELINE_CONTRACT.SETTING_KEYWORD_MIN_LENGTH) {
                    driftItems.push({ characterName: char.name, expectedSetting: keyword, severity: 'MEDIUM', message: `角色"${char.name}"的设定"${keyword}"在审核输出中未出现` });
                }
            }
        }
    }

    return { hasDrift: driftItems.length > 0, driftItems };
}

function detectPollution(step, output, context = {}) {
    const results = [];

    if (step === 'writer' || step === 'reviser') {
        const charPollution = detectCharacterPollution(output.content || '', context.materialNames || []);
        if (charPollution.hasPollution) {
            results.push({ code: 'P-001', label: '角色名污染', severity: POLLUTION_SEVERITY.HIGH, detail: `正文中出现素材库外的角色名：${charPollution.unknownNames.join('、')}`, unknownNames: charPollution.unknownNames, knownNames: charPollution.knownNames });
        }
    }

    if (step === 'material-manager' || step === 'material-registrar') {
        const duplication = detectMaterialDuplication(context.materials || []);
        if (duplication.hasDuplication) {
            results.push({ code: 'P-002', label: '素材重复', severity: POLLUTION_SEVERITY.MEDIUM, detail: duplication.duplicates.map(d => d.message).join('；'), duplicates: duplication.duplicates });
        }
    }

    if (step === 'first-review' || step === 'second-review') {
        const drift = detectSettingDrift(output.firstReviewOutput || output.secondReviewOutput || '', context.materialNames || []);
        if (drift.hasDrift) {
            results.push({ code: 'P-003', label: '设定偏移', severity: POLLUTION_SEVERITY.MEDIUM, detail: drift.driftItems.map(d => d.message).join('；'), driftItems: drift.driftItems });
        }
    }

    return { hasPollution: results.length > 0, results };
}

module.exports = { detectPollution, detectCharacterPollution, detectMaterialDuplication, detectSettingDrift, extractChineseNames, extractSettingKeywords };
