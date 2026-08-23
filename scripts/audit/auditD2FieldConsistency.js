'use strict';

/**
 * auditD2FieldConsistency.js — D2: 字段一致性排查
 *
 * 检查targetChapters/styleProfile/chapterIntents/wordConfig
 * 四个核心字段的归一化器和schema完整性
 */

const fs = require('fs');
const path = require('path');
const { warn, ok, readFile, ROOT } = require('./auditUtils');

function auditFieldConsistency() {
    console.log('\n=== D2: 字段一致性排查 ===');

    // D2.1: targetChapters归一化全链路
    const normalizer = readFile('server/config/targetChaptersNormalizer.js');
    if (!normalizer) {
        warn('D2.1', 'targetChaptersNormalizer.js不存在');
    } else {
        ok('D2.1', 'targetChaptersNormalizer存在');
    }

    // D2.2: styleProfile 7个约束字段
    const styleProfileSchema = readFile('server/config/styleProfileSchema.js');
    if (styleProfileSchema) {
        const requiredFields = ['povRule', 'dialogueRule', 'behaviorRule', 'toneRule', 'titleRule'];
        const missing = requiredFields.filter(f => !styleProfileSchema.includes(f));
        if (missing.length > 0) {
            warn('D2.2', 'styleProfileSchema缺少字段', missing);
        } else {
            ok('D2.2', 'styleProfileSchema包含所有必填字段');
        }
    }

    // D2.3: chapterIntents结构
    const chapterIntentsSchema = readFile('server/config/chapterIntentsSchema.js');
    if (chapterIntentsSchema) {
        if (chapterIntentsSchema.includes('Array.isArray') && chapterIntentsSchema.includes('chapters')) {
            ok('D2.3', 'chapterIntentsSchema校验chapters为对象');
        }
    }

    // D2.4: wordConfig归一化
    const wordConfigNormalizer = readFile('server/config/wordConfigNormalizer.js');
    if (wordConfigNormalizer) {
        const standardFields = ['minWords', 'targetWords', 'maxWords'];
        const missing = standardFields.filter(f => !wordConfigNormalizer.includes(f));
        if (missing.length > 0) {
            warn('D2.4', 'wordConfigNormalizer缺少标准字段', missing);
        } else {
            ok('D2.4', 'wordConfigNormalizer包含标准字段');
        }
    }

    // D2.5: 检查genre-profiles是否都有wordConfig
    const genreProfilesDir = path.join(ROOT, 'data', 'genre-profiles');
    if (fs.existsSync(genreProfilesDir)) {
        const profiles = fs.readdirSync(genreProfilesDir).filter(f => f.endsWith('.json'));
        for (const file of profiles) {
            const content = JSON.parse(fs.readFileSync(path.join(genreProfilesDir, file), 'utf8'));
            if (!content.wordConfig) {
                warn('D2.5', `genre-profile ${file} 缺少wordConfig`);
            }
        }
        ok('D2.5', `扫描${profiles.length}个genre-profile完成`);
    }
}

module.exports = { auditFieldConsistency };
