const PROJECT_ID = 'd017ca48-3b93-42ad-8b40-6ed938f10507';

const REPAIR_CHAPTERS = [
    { n: 17, issue: '全章无幼崽视角/行为描写，完全是成人观察视角。必须加入幼崽小满的感官/行为/对话描写，幼崽出场段占比≥40%。' },
    { n: 43, issue: '全章无幼崽视角/行为描写。必须加入幼崽小满的感官/行为/对话描写。' },
    { n: 66, issue: '全章无幼崽视角/行为描写。必须加入幼崽小满的感官/行为/对话描写。' },
    { n: 70, issue: '全章无幼崽视角/行为描写。必须加入幼崽小满的感官/行为/对话描写。' },
    { n: 78, issue: '全章无幼崽视角/行为描写。必须加入幼崽小满的感官/行为/对话描写。' },
    { n: 123, issue: '全章无幼崽视角/行为描写。必须加入幼崽小满的感官/行为/对话描写。' },
    { n: 149, issue: '全章无幼崽视角/行为描写。必须加入幼崽小满的感官/行为/对话描写。' },
    { n: 151, issue: '全章无幼崽视角/行为描写。必须加入幼崽小满的感官/行为/对话描写。' },
    { n: 20, issue: '网文腔/网络用语。必须替换为符合幼崽视角的自然表达。' },
    { n: 26, issue: '网文腔/网络用语。必须替换为符合幼崽视角的自然表达。' },
];

const BASE_URL = 'http://localhost:3001/api/chapter-audit';

async function getChapterId(n) {
    const resp = await fetch(`http://localhost:3001/api/chapters`);
    const chapters = await resp.json();
    const ch = chapters.find(c => c.chapterNumber === n);
    return ch?.id;
}

async function repairChapter(chapterId, instructions) {
    const body = JSON.stringify({
        provider: 'aliyunCoding',
        model: 'qwen3.6-plus',
        autoReview: false,
        repairInstructions: instructions,
    });
    const resp = await fetch(`${BASE_URL}/repair/${PROJECT_ID}/${chapterId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
    });
    return resp.json();
}

async function auditChapter(chapterId) {
    const resp = await fetch(`${BASE_URL}/audit/${PROJECT_ID}/chapter/${chapterId}`);
    return resp.json();
}

async function main() {
    console.log(`\n=== 批量返修问题章节 (${REPAIR_CHAPTERS.length}个) ===\n`);

    const results = [];

    for (const item of REPAIR_CHAPTERS) {
        const chapterId = await getChapterId(item.n);
        if (!chapterId) {
            console.log(`Ch${item.n}: NOT FOUND`);
            results.push({ n: item.n, success: false, error: 'NOT FOUND' });
            continue;
        }

        console.log(`\n--- 返修 Ch${item.n} ---`);
        console.log(`  问题: ${item.issue}`);

        try {
            const result = await repairChapter(chapterId, item.issue);
            if (result.success) {
                console.log(`  ✅ 返修成功! 新字数: ${result.newWordCount}`);
                results.push({ n: item.n, success: true, newWordCount: result.newWordCount });
            } else {
                console.log(`  ❌ 返修失败: ${result.error}`);
                results.push({ n: item.n, success: false, error: result.error });
            }
        } catch (e) {
            console.log(`  ❌ 异常: ${e.message}`);
            results.push({ n: item.n, success: false, error: e.message });
        }

        await new Promise(r => setTimeout(r, 5000));
    }

    console.log('\n=== 验证返修结果 ===\n');

    let allPass = true;
    for (const item of REPAIR_CHAPTERS) {
        const chapterId = await getChapterId(item.n);
        if (!chapterId) continue;

        try {
            const audit = await auditChapter(chapterId);
            const hasViolation = audit.violations && audit.violations.length > 0;
            if (hasViolation) {
                allPass = false;
                console.log(`  ⚠ Ch${item.n}: ${audit.violations.length}项违规`);
                audit.violations.forEach(v => console.log(`    [${v.severity}] ${v.desc}`));
            } else {
                console.log(`  ✅ Ch${item.n}: 审计通过`);
            }
        } catch (e) {
            console.log(`  ⚠ Ch${item.n}: 审计异常 ${e.message}`);
        }
    }

    console.log(allPass ? '\n✅✅✅ 全部验证通过！' : '\n⚠ 部分章节仍有问题');

    console.log('\n=== 返修结果汇总 ===');
    const successCount = results.filter(r => r.success).length;
    console.log(`成功: ${successCount}/${results.length}`);
    results.forEach(r => {
        console.log(`  Ch${r.n}: ${r.success ? '✅ ' + r.newWordCount + '字' : '❌ ' + r.error}`);
    });
}

main().catch(e => console.error('Error:', e));
