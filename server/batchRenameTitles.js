const store = require('./store');
const llm = require('./services/llm');

const PROJECT_ID = 'd017ca48-3b93-42ad-8b40-6ed938f10507';

const TECH_SUFFIXES = '阀|舱|器|系统|装置|模块|缓冲层|过滤网|导流栅|呼吸阀|隔离层|调节器|缓冲舱|导流阀|沉降网|枢|匣|网|栅|层|桥|阵|膜|筒|管|环|计|穹|帐|藤|盘|闸|桩|槽|廊|界|床|弦|台|笛|堤|阈|壁|带|阱|脊|幕|帷|庭|腔|渠|坝|巢|茧|枕|毯|垫|垫片|堰|屏|囊|脉|泵|隙|结';

const TECH_PATTERN = new RegExp(`.{2,10}(与|和).{2,10}的.{2,12}(${TECH_SUFFIXES})(（续）)?$`);

const BATCH_SIZE = 25;

function isTechTitle(title) {
    if (TECH_PATTERN.test(title)) return true;
    if (/深呼吸$/.test(title) && title.length > 6) return true;
    return false;
}

async function generateBatchTitles(techChapters, allChapters, batchIndex) {
    const batch = techChapters;
    const existingTitles = new Set(allChapters.map(c => c.title));

    const titleList = batch.map(c =>
        `第${c.chapterNumber}章: "${c.title}" (摘要: ${(c.content || '').replace(/\s/g, '').substring(0, 60)}...)`
    ).join('\n');

    const poeticExamples = allChapters.filter(c => !isTechTitle(c.title)).slice(-15).map(c => c.title);

    const messages = [
        {
            role: 'system',
            content: `你是小说章节标题优化专家。将工程技术说明书式的章节标题改为诗情画意、具画面感的标题。

【命名规则 - 必须遵守】
❌禁止："XX与YY的ZZ阀/舱/器/枢/匣/网/栅/层/桥/阵/膜/筒/管/环/计/穹/帐/藤/盘/闸/桩/槽/廊/界/床/弦/台/笛/堤/阈/壁/带/阱/脊/幕/帷/庭/腔/渠/坝/巢/茧/枕/毯/垫"（材料+材料+功能装置的工程命名模式）
❌禁止：任何"XX与YY的ZZ[技术名词]"格式
✅正确：用感官意象+动作/状态命名，让读者产生画面感和好奇心

【正确示例】
- "废彩印纸与枯芒草茎的暴雨导流栅" → "雨声落在纸皮上"
- "旧窗框毛条与干地衣群的微气候缓冲舱" → "冻土下的软被子"
- "紫绒线团与碎火山岩的孔隙呼吸阀" → "绒线团里的风声"
- "碎蛋壳与旧棉纱的呼吸匣" → "蛋壳里藏着风"
- "干苔藓球与碎滤棉的醒墒层" → "苔藓球醒过来"
- "碎贝壳与旧铜管的谐振腔" → "贝壳在铜管里唱歌"
- "细柳枝与旧毛线团的引菌槽" → "柳枝和毛线说悄悄话"

【要求】
1. 新标题必须保留原章节的核心意象/元素，但用感官化方式表达
2. 新标题不能与已有标题重复
3. 每个新标题6-14字
4. 标题（续）后缀保留
5. 输出JSON数组格式

已有诗情画意标题参考：
${poeticExamples.join('、')}`
        },
        {
            role: 'user',
            content: `请为以下${batch.length}个章节生成诗情画意的新标题：

${titleList}

输出JSON数组：
[{"chapterNumber": 7, "oldTitle": "原标题", "newTitle": "新标题"}, ...]`
        }
    ];

    console.log(`\n  调用LLM (批次${batchIndex + 1}, ${batch.length}个标题)...`);

    const result = await llm.chat(messages, { temperature: 0.8, maxTokens: 8192 });

    const responseText = result.choices?.[0]?.message?.content || '';

    let renames;
    try {
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('No JSON array found');
        renames = JSON.parse(match[0]);
    } catch (e) {
        console.error(`  ❌ JSON解析失败: ${e.message}`);
        console.log(`  响应前200字: ${responseText.substring(0, 200)}`);
        return [];
    }

    return renames;
}

async function main() {
    const chapters = store.queryItems('chapters', c =>
        c.projectId === PROJECT_ID && !c.archived && c.content
    ).sort((a, b) => a.chapterNumber - b.chapterNumber);

    const techChapters = chapters.filter(c => isTechTitle(c.title));

    console.log(`\n=== 批量章节标题诗情画意化（全量） ===`);
    console.log(`总章节数: ${chapters.length}`);
    console.log(`技术化标题: ${techChapters.length}个`);
    console.log(`诗情画意标题: ${chapters.length - techChapters.length}个\n`);

    if (techChapters.length === 0) {
        console.log('✅ 无需修改');
        return;
    }

    const args = process.argv.slice(2);
    const isApply = args.includes('--apply');

    const allRenames = [];
    const batches = [];
    for (let i = 0; i < techChapters.length; i += BATCH_SIZE) {
        batches.push(techChapters.slice(i, i + BATCH_SIZE));
    }

    console.log(`分${batches.length}批处理，每批最多${BATCH_SIZE}个\n`);

    for (let i = 0; i < batches.length; i++) {
        const batchRenames = await generateBatchTitles(batches[i], chapters, i);
        allRenames.push(...batchRenames);
        console.log(`  批次${i + 1}生成: ${batchRenames.length}个标题`);
        if (i < batches.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log(`\n=== 生成结果汇总 (${allRenames.length}个) ===\n`);

    const renameMap = {};
    const usedNewTitles = new Set(chapters.map(c => c.title));

    for (const item of allRenames) {
        const ch = techChapters.find(c => c.chapterNumber === item.chapterNumber);
        if (!ch) {
            console.log(`  ⚠ 第${item.chapterNumber}章未找到匹配`);
            continue;
        }
        if (usedNewTitles.has(item.newTitle)) {
            console.log(`  ⚠ 第${item.chapterNumber}章新标题重复: "${item.newTitle}"`);
            continue;
        }
        if (isTechTitle(item.newTitle)) {
            console.log(`  ⚠ 第${item.chapterNumber}章新标题仍是技术式: "${item.newTitle}"`);
            continue;
        }
        usedNewTitles.add(item.newTitle);
        renameMap[ch.id] = { chapterNumber: ch.chapterNumber, oldTitle: ch.title, newTitle: item.newTitle };
        console.log(`  ✅ Ch${ch.chapterNumber}: "${ch.title}" → "${item.newTitle}"`);
    }

    const missingChapters = techChapters.filter(c => !renameMap[c.id]);
    if (missingChapters.length > 0) {
        console.log(`\n⚠ 未覆盖的章节 (${missingChapters.length}个):`);
        missingChapters.forEach(c => console.log(`  Ch${c.chapterNumber}: "${c.title}"`));
    }

    console.log(`\n=== 统计 ===`);
    console.log(`将修改: ${Object.keys(renameMap).length}个`);
    console.log(`未覆盖: ${missingChapters.length}个`);

    if (!isApply) {
        console.log('\n这是预览模式。要执行修改，请运行:');
        console.log('node batchRenameTitles.js --apply');
        return;
    }

    console.log('\n正在应用修改...');

    let updated = 0;
    let materialUpdated = 0;
    let contentUpdated = 0;

    for (const [chapterId, info] of Object.entries(renameMap)) {
        const chapter = store.getItem('chapters', chapterId);
        if (!chapter) continue;

        chapter.title = info.newTitle;
        chapter.updatedAt = new Date().toISOString();
        store.setItem('chapters', chapterId, chapter);
        updated++;

        const materials = store.queryItems('materials', m =>
            m.projectId === PROJECT_ID && JSON.stringify(m).includes(info.oldTitle)
        );
        for (const mat of materials) {
            const before = JSON.stringify(mat);
            const after = before.replaceAll(info.oldTitle, info.newTitle);
            if (before !== after) {
                const updatedMat = JSON.parse(after);
                store.setItem('materials', mat.id, updatedMat);
                materialUpdated++;
                console.log(`  📎 素材[${mat.type}]已更新: "${info.oldTitle}" → "${info.newTitle}"`);
            }
        }

        const allChapters = store.queryItems('chapters', c =>
            c.projectId === PROJECT_ID && c.id !== chapterId && (c.content || '').includes(info.oldTitle)
        );
        for (const otherCh of allChapters) {
            otherCh.content = otherCh.content.replaceAll(info.oldTitle, info.newTitle);
            otherCh.updatedAt = new Date().toISOString();
            store.setItem('chapters', otherCh.id, otherCh);
            contentUpdated++;
            console.log(`  📝 Ch${otherCh.chapterNumber}内容已更新: "${info.oldTitle}" → "${info.newTitle}"`);
        }
    }

    console.log(`\n=== 修改完成 ===`);
    console.log(`章节标题更新: ${updated}个`);
    console.log(`素材引用更新: ${materialUpdated}处`);
    console.log(`章节内容更新: ${contentUpdated}处`);

    console.log('\n=== 验证 ===');
    const verifyChapters = store.queryItems('chapters', c =>
        c.projectId === PROJECT_ID && !c.archived && c.content
    );
    const remainingTech = verifyChapters.filter(c => isTechTitle(c.title));
    console.log(`剩余技术式标题: ${remainingTech.length}个`);
    if (remainingTech.length > 0) {
        remainingTech.forEach(c => console.log(`  ⚠ Ch${c.chapterNumber}: "${c.title}"`));
    } else {
        console.log('✅ 所有技术式标题已替换！');
    }

    const titleCounts = {};
    verifyChapters.forEach(c => { titleCounts[c.title] = (titleCounts[c.title] || 0) + 1; });
    const dups = Object.entries(titleCounts).filter(([k, v]) => v > 1);
    if (dups.length > 0) {
        console.log(`⚠ 发现重复标题:`);
        dups.forEach(([t, c]) => console.log(`  [${c}次] ${t}`));
    } else {
        console.log('✅ 无重复标题');
    }
}

main().catch(e => console.error('Error:', e));
