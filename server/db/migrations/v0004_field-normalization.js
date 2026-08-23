const fs = require('fs');
const path = require('path');
const { runSql } = require('../database');
const logger = require('../../shared/logger');

const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');

const FIELD_DEFAULTS = {
    materials: {
        version: 1,
        isLocked: false,
        dialectIntensity: 'medium',
        speechStyleIntensity: 'medium',
        namingStyleIntensity: 'medium'
    },
    chapters: {
        _reviewRounds: 0,
        _wordCountRetry: 0,
        status: 'outlined'
    },
    projects: {
        mode: 'novel'
    }
};

function _readJsonFiles(dirName) {
    const dir = path.join(DATA_DIR, dirName);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
            try {
                const content = fs.readFileSync(path.join(dir, f), 'utf-8').replace(/^\uFEFF/, '');
                if (!content.trim()) return null;
                return { file: f, data: JSON.parse(content) };
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean);
}

function _normalizeMaterial(mat) {
    let changed = false;

    if (mat.parentPlane === undefined) { mat.parentPlane = null; changed = true; }
    if (mat.parentFaction === undefined) { mat.parentFaction = null; changed = true; }
    if (mat.currentPlaneId === undefined) { mat.currentPlaneId = null; changed = true; }
    if (mat.version === undefined) { mat.version = 1; changed = true; }
    if (mat.isLocked === undefined) { mat.isLocked = false; changed = true; }
    if (mat.archived === undefined) { mat.archived = false; changed = true; }
    if (mat.dialectRegion === undefined) { mat.dialectRegion = ''; changed = true; }
    if (mat.dialectIntensity === undefined) { mat.dialectIntensity = 'medium'; changed = true; }
    if (mat.speechStyle === undefined) { mat.speechStyle = ''; changed = true; }
    if (mat.speechStyleIntensity === undefined) { mat.speechStyleIntensity = 'medium'; changed = true; }
    if (mat.namingStyle === undefined) { mat.namingStyle = ''; changed = true; }
    if (mat.namingStyleIntensity === undefined) { mat.namingStyleIntensity = 'medium'; changed = true; }
    if (mat.archetype === undefined) { mat.archetype = ''; changed = true; }

    if (mat.changeLog && !Array.isArray(mat.changeLog)) {
        mat.changeLog = [];
        changed = true;
    }
    if (mat.tags && !Array.isArray(mat.tags)) {
        mat.tags = [];
        changed = true;
    }

    if (mat.type === 'character' && !mat.currentContent) {
        if (mat.initialContent) {
            mat.currentContent = mat.initialContent;
            changed = true;
        }
    }

    return { data: mat, changed };
}

function _normalizeChapter(ch) {
    let changed = false;

    if (ch._reviewRounds === undefined) { ch._reviewRounds = 0; changed = true; }
    if (ch._wordCountRetry === undefined) { ch._wordCountRetry = 0; changed = true; }
    if (ch.status === undefined) { ch.status = 'outlined'; changed = true; }
    if (ch.chapterNumber === undefined) { ch.chapterNumber = 0; changed = true; }
    if (ch.projectId === undefined) { ch.projectId = ''; changed = true; }

    if (ch.history && !Array.isArray(ch.history)) {
        ch.history = [];
        changed = true;
    }

    return { data: ch, changed };
}

function _normalizeProject(proj) {
    let changed = false;

    if (proj.mode === undefined) {
        proj.mode = proj.styleProfile?.mode || 'novel';
        changed = true;
    }
    if (!proj.styleProfile) {
        proj.styleProfile = {};
        changed = true;
    }
    if (proj.styleProfile.protagonistName === undefined) {
        proj.styleProfile.protagonistName = '';
        changed = true;
    }

    return { data: proj, changed };
}

async function up(db) {
    const report = { materials: 0, chapters: 0, projects: 0, totalChanged: 0, errors: [] };

    const materials = _readJsonFiles('materials');
    for (const { file, data } of materials) {
        try {
            const result = _normalizeMaterial(data);
            if (result.changed) {
                const filePath = path.join(DATA_DIR, 'materials', file);
                fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2), 'utf-8');
                report.materials++;
                report.totalChanged++;

                try {
                    const jsonStr = JSON.stringify(result.data);
                    runSql(db, `UPDATE materials SET data = ? WHERE id = ?`, [jsonStr, result.data.id]);
                } catch (dbErr) {
                    logger.warn('migration-v0004', `DB update failed for material ${result.data.id}: ${dbErr.message}`);
                }
            }
        } catch (e) {
            report.errors.push({ type: 'materials', file, error: e.message });
        }
    }
    logger.info('migration-v0004', `Materials normalized: ${report.materials} updated`);

    const chapters = _readJsonFiles('chapters');
    for (const { file, data } of chapters) {
        try {
            const result = _normalizeChapter(data);
            if (result.changed) {
                const filePath = path.join(DATA_DIR, 'chapters', file);
                fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2), 'utf-8');
                report.chapters++;
                report.totalChanged++;

                try {
                    const jsonStr = JSON.stringify(result.data);
                    runSql(db, `UPDATE chapters SET data = ? WHERE id = ?`, [jsonStr, result.data.id]);
                } catch (dbErr) {
                    logger.warn('migration-v0004', `DB update failed for chapter ${result.data.id}: ${dbErr.message}`);
                }
            }
        } catch (e) {
            report.errors.push({ type: 'chapters', file, error: e.message });
        }
    }
    logger.info('migration-v0004', `Chapters normalized: ${report.chapters} updated`);

    const projects = _readJsonFiles('projects');
    for (const { file, data } of projects) {
        try {
            const result = _normalizeProject(data);
            if (result.changed) {
                const filePath = path.join(DATA_DIR, 'projects', file);
                fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2), 'utf-8');
                report.projects++;
                report.totalChanged++;

                try {
                    const jsonStr = JSON.stringify(result.data);
                    runSql(db, `UPDATE projects SET data = ? WHERE id = ?`, [jsonStr, result.data.id]);
                } catch (dbErr) {
                    logger.warn('migration-v0004', `DB update failed for project ${result.data.id}: ${dbErr.message}`);
                }
            }
        } catch (e) {
            report.errors.push({ type: 'projects', file, error: e.message });
        }
    }
    logger.info('migration-v0004', `Projects normalized: ${report.projects} updated`);

    if (report.errors.length > 0) {
        logger.warn('migration-v0004', `${report.errors.length} errors:`, report.errors);
    }
    logger.info('migration-v0004', `Field normalization complete: ${report.totalChanged} records updated`);
}

async function down(db) {
    logger.info('migration-v0004', 'Rollback: Field normalization cannot be automatically reversed.');
    logger.info('migration-v0004', 'Rollback: JSON files have been modified in-place. Restore from backup if needed.');
    logger.info('migration-v0004', 'Rollback: To restore, run: node scripts/restore-data.js');
}

module.exports = { up, down, version: 4, name: 'field-normalization' };
