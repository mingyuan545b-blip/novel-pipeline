/**
 * 清理data目录下的历史测试数据文件（保留系统配置文件）
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// 递归删除目录下所有内容（包括子目录）
function cleanDir(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    let count = 0;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            count += cleanDir(fullPath);
            fs.rmdirSync(fullPath);
        } else {
            fs.unlinkSync(fullPath);
            count++;
        }
    }
    return count;
}

// 需要清空的目录（历史测试数据）
const CLEAN_DIRS = [
    'state-snapshots',
    'timelines',
    'memory-layers',
    'material-index',
    'circuit-breakers',
    'pipeline-logs',
    'state-meta',
    'map-nodes',
    'infinite-pipeline-state',
    'narrative-state',
    'quests',
    'style-profiles',
    'test-type',
    'timeline-events',
    'materials',
    'subplanes',
    'entity-state-history',
    'character-state-cache',
    'state-kv-index',
    'entity-registry',
    'chapters',
    'projects',
    'outlines',
    'review-records',
    'audit-logs',
    'chapter-intents',
    'knowledge-base',
    'entity-relations',
];

// 需要保留的目录（系统配置）
const KEEP_DIRS = [
    'character-archetypes',
    'comic-config',
    'dialects',
    'genre-profiles',
    'humor-devices',
    'meme-lexicon',
    'naming-styles',
    'speech-styles',
    'system-personas',
];

// style-templates只保留default开头的
function cleanStyleTemplates() {
    const dir = path.join(DATA_DIR, 'style-templates');
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    let deleted = 0;
    for (const f of files) {
        if (!f.startsWith('default')) {
            fs.unlinkSync(path.join(dir, f));
            deleted++;
        }
    }
    console.log(`  style-templates: 删除${deleted}个非默认文件`);
}

let totalDeleted = 0;
for (const dir of CLEAN_DIRS) {
    const dirPath = path.join(DATA_DIR, dir);
    if (!fs.existsSync(dirPath)) {
        continue;
    }
    const count = cleanDir(dirPath);
    totalDeleted += count;
    console.log(`  清空 ${dir}: ${count} 个文件`);
}

cleanStyleTemplates();
console.log(`\n总计删除: ${totalDeleted} 个文件`);
console.log('保留的系统配置目录:', KEEP_DIRS.join(', '));
