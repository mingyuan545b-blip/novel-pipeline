/**
 * 清理所有测试项目数据
 *
 * 删除范围：所有项目及其关联数据（chapters/materials/entities等）
 * 保留范围：基础配置数据（library/genre-profiles/dialects/character-archetypes等）
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const PROJECT_DATA_DIRS = [
    'projects', 'chapters', 'materials', 'reviews',
    'entities', 'entity-registry', 'item-definitions',
    'character-binds', 'character-relations', 'pet-entities', 'servant-entities',
    'consistency-checks', 'consistency-constraints', 'foreshadow-ledger',
    'knowledge-facts', 'knowledge-access', 'infinite-pipeline-state',
    'pipeline-state', 'pipeline-tasks', 'chapter-audits', 'chapter-cascade',
    'worldscope', 'worldscope-entities', 'worldscope-transitions',
    'character-states', 'quests', 'franchises',
];

const PRESERVE_DIRS = [
    'library', 'character-archetypes', 'comic-config', 'dialects',
    'genre-profiles', 'humor-devices', 'migrations', 'style-templates',
    'worldview-profiles', 'prompt-config', 'foundation-prompts', 'genre-rules',
];

let deletedCount = 0;
let deletedDirs = 0;

function clearDir(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            clearDir(fullPath);
            fs.rmdirSync(fullPath);
        } else {
            fs.unlinkSync(fullPath);
            deletedCount++;
        }
    }
}

console.log('========================================');
console.log('清理测试项目数据');
console.log('========================================\n');

for (const dir of PROJECT_DATA_DIRS) {
    const dirPath = path.join(DATA_DIR, dir);
    if (fs.existsSync(dirPath)) {
        const beforeCount = deletedCount;
        clearDir(dirPath);
        const removed = deletedCount - beforeCount;
        console.log('  [OK] 清空 ' + dir + '/ (' + removed + '个文件)');
        deletedDirs++;
    }
}

try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(DATA_DIR, 'novel-pipeline.db');
    if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath);
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        let clearedTables = 0;
        for (const { name } of tables) {
            if (name.startsWith('sqlite_') || name.startsWith('_')) continue;
            if (PRESERVE_DIRS.some(p => name.includes(p))) continue;
            try {
                const result = db.prepare('DELETE FROM ' + name).run();
                if (result.changes > 0) {
                    console.log('  [OK] 清空数据库表 ' + name + ' (' + result.changes + '行)');
                    clearedTables++;
                }
            } catch (e) {
                // skip
            }
        }
        db.close();
        if (clearedTables > 0) {
            console.log('  [OK] 数据库清理完成 (' + clearedTables + '个表)');
        }
    }
} catch (e) {
    console.log('  [WARN] 数据库清理跳过: ' + e.message);
}

console.log('\n========================================');
console.log('清理完成: 删除' + deletedCount + '个文件，清空' + deletedDirs + '个目录');
console.log('========================================');
