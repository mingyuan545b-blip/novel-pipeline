/**
 * 清理重复大纲 - 保留最早版本，删除后续重复
 * 直接操作store，因为大纲没有DELETE API
 */
const path = require('path');
require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', '.env') });
const store = require(path.join(__dirname, '..', 'server', 'store'));

const PROJECT_ID = '49d5a6bf-0705-4b7b-a651-7142f1cf84a1';

async function main() {
    await store.ensureBackend();

    const outlines = await store.queryItems('chapter-outlines', { projectId: PROJECT_ID });
    console.log('Total outlines in chapter-outlines store:', outlines.length);

    // Group by chapterNumber
    const byChapter = {};
    outlines.forEach(ch => {
        if (!byChapter[ch.chapterNumber]) byChapter[ch.chapterNumber] = [];
        byChapter[ch.chapterNumber].push(ch);
    });

    let deleted = 0;
    let kept = 0;

    for (const [num, items] of Object.entries(byChapter)) {
        if (items.length > 1) {
            // Sort by createdAt, keep earliest
            items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            const keep = items[0];
            kept++;
            console.log(`KEEP Ch${num}: ${keep.title} (${keep.id.substring(0, 8)})`);

            const remove = items.slice(1);
            for (const item of remove) {
                console.log(`  DELETE: ${item.title} (${item.id.substring(0, 8)})`);
                await store.deleteItem('chapter-outlines', item.id);
                deleted++;
            }
        } else {
            kept++;
        }
    }

    console.log(`\nKept: ${kept}, Deleted: ${deleted}`);

    // Verify no more duplicates
    const remaining = await store.queryItems('chapter-outlines', { projectId: PROJECT_ID });
    console.log('Remaining outlines:', remaining.length);

    // Check for forbidden patterns
    const forbidden = ['霸总', '黑卡', '豪门', '总裁', '契约婚姻', '替身', '白月光'];
    let drifts = 0;
    remaining.forEach(ch => {
        const text = (ch.title || '') + ' ' + (ch.outline || '');
        forbidden.forEach(p => {
            if (text.includes(p)) {
                console.log('DRIFT Ch' + ch.chapterNumber + ': "' + p + '" in ' + ch.title);
                drifts++;
            }
        });
    });
    console.log('Drifts after cleanup:', drifts);

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
