/**
 * runNewProjectTest.js — 新建项目全流程测试（主入口）
 * 只复用世界观框架（高武·反套路喜剧），角色/剧情/装备/功法全部重新设计
 * 步骤: 创建项目 → 生成素材 → 生成大纲 → 逐章流水线
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env'), override: true });
const http = require('http');
const REQUEST_SECRET = process.env.REQUEST_SECRET || '';

function fetchApi(method, path, body, timeoutMs = 600000) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'localhost', port: 3001, path, method,
            headers: { 'Authorization': `Bearer ${REQUEST_SECRET}`, 'Content-Type': 'application/json' },
            timeout: timeoutMs
        };
        if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
        const r = http.request(opts, (res) => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
                catch (e) { resolve({ status: res.statusCode, data: d }); }
            });
        });
        r.on('error', reject);
        r.on('timeout', () => { r.destroy(); reject(new Error(`超时(${timeoutMs}ms)`)); });
        if (data) r.write(data);
        r.end();
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 重新设计的角色与剧情（不复用之前的江缺/王胖子等）
const PROJECT_DESC = [
    '【世界观框架-复用】主世界高武·反套路喜剧：五家九境修仙体系，小世界穿越，反套路系统，30章一卷，喜剧占比30%+。',
    '',
    '【角色-全新设计】',
    '主角：苏沉，25岁前游戏测试员，穿越为青云宗外门弟子。性格：吐槽役实用主义，擅长找BUG思维破局，说话带互联网黑话但会自嘲。',
    '配角：周大壮（外号"壮哥"），主角室友，体修憨厚肌肉男，头脑简单但忠诚，常被主角吐槽"血厚防高智商低"。',
    'NPC：李长风，外门执事长老，势利眼，巴结内门弟子，对外门弟子冷嘲热讽，是前期打脸对象。',
    '',
    '【装备-全新设计】',
    '键盘飞剑：苏沉前世机械键盘化作的飞剑法器，键位即剑招（WASD控制方向，空格暴击），打字速度决定剑速。',
    '',
    '【功法-全新设计】',
    '摸鱼心法：苏沉自创功法，摸鱼时修炼效率翻倍，正经打坐反而走火入魔。核心机制：越懒越强，越努力越废。',
    '',
    '【剧情线-全新设计】',
    '第1章：苏沉穿越醒来发现自己是青云宗外门垫底弟子，觉醒反套路系统，获得键盘飞剑，用摸鱼心法意外突破。',
    '第2章：李长风刁难外门弟子，苏沉用键盘飞剑的"空格暴击"当众打脸，周大壮围观惊叹。',
    '第3章：系统发布首个小世界任务（像素游戏世界），苏沉和周大壮组队准备进入，摸鱼心法在主世界被压制但仍有妙用。'
].join('\n');

async function createProject() {
    console.log('=== 步骤1: 创建新项目 ===');
    const body = {
        name: '高武测试_全新设计_' + Date.now(),
        description: PROJECT_DESC,
        genre: '高武',
        subGenre: 'high-martial-comedy',
        targetChapters: 3,
        settings: { chapterRounds: 3, chronicleLevel: 'full', worldScopeLevel: 'full' }
    };
    const r = await fetchApi('POST', '/api/projects', body);
    console.log(`HTTP=${r.status} 项目ID=${r.data.id || '无'}`);
    if (r.status !== 201 && !r.data.id) throw new Error('项目创建失败: ' + JSON.stringify(r.data).substring(0, 300));
    return r.data.id;
}

async function generateMaterials(pid) {
    console.log('\n=== 步骤2: 生成素材 ===');
    const t = Date.now();
    const r = await fetchApi('POST', '/api/pipeline/generate-materials', { projectId: pid, prompt: PROJECT_DESC });
    console.log(`HTTP=${r.status} 耗时=${((Date.now() - t) / 1000).toFixed(1)}s`);
    if (r.data.materials) {
        console.log(`素材数: ${r.data.materials.length}`);
        r.data.materials.forEach(m => console.log(`  - ${m.type}: ${m.name} (${(m.content || '').length}字)`));
    } else {
        console.log('响应:', JSON.stringify(r.data).substring(0, 500));
    }
    return r.data;
}

async function generateOutlines(pid) {
    console.log('\n=== 步骤3: 生成大纲 ===');
    const t = Date.now();
    const r = await fetchApi('POST', '/api/pipeline/generate-outlines', { projectId: pid, prompt: '', targetChapters: 3 });
    console.log(`HTTP=${r.status} 耗时=${((Date.now() - t) / 1000).toFixed(1)}s`);
    if (r.data.chapters) {
        console.log(`大纲数: ${r.data.chapters.length}`);
        r.data.chapters.forEach(c => console.log(`  - 第${c.chapterNumber}章: ${c.title}`));
    } else {
        console.log('响应:', JSON.stringify(r.data).substring(0, 500));
    }
    return r.data;
}

async function runChapterPipeline(pid, chapter) {
    console.log(`\n--- 第${chapter.chapterNumber}章流水线 ---`);
    const t = Date.now();
    const r = await fetchApi('POST', '/api/pipeline/full', { projectId: pid, chapterId: chapter.id, maxRounds: 3 });
    if (r.data.taskId) {
        console.log(`taskId=${r.data.taskId}`);
        for (let i = 0; i < 120; i++) {
            await sleep(10000);
            const s = await fetchApi('GET', `/api/pipeline/task/${r.data.taskId}`);
            if (s.data.status === 'completed' || s.data.status === 'done') {
                console.log(`✅ 完成 耗时=${((Date.now() - t) / 1000).toFixed(1)}s`);
                return true;
            }
            if (s.data.status === 'failed') {
                console.log(`❌ 失败: ${s.data.error || JSON.stringify(s.data).substring(0, 200)}`);
                return false;
            }
            process.stdout.write(`\r  等待${i * 10 + 10}s ${s.data.status || '...'}`);
        }
        console.log('\n❌ 超时');
        return false;
    }
    console.log('响应:', JSON.stringify(r.data).substring(0, 300));
    return false;
}

(async () => {
    let pid;
    try {
        pid = await createProject();
        await generateMaterials(pid);
        await generateOutlines(pid);
        console.log('\n=== 步骤4: 逐章执行流水线 ===');
        const chResp = await fetchApi('GET', `/api/chapters?projectId=${pid}`);
        const chapters = Array.isArray(chResp.data) ? chResp.data : (chResp.data.chapters || []);
        for (const ch of chapters) {
            await runChapterPipeline(pid, ch);
        }
        console.log(`\n=== 流水线全部完成，项目ID: ${pid} ===`);
        console.log(`\n请运行验证脚本: node scripts/verifyNewProject.js ${pid}`);
    } catch (err) {
        console.error('测试失败:', err.message);
        console.error(err.stack);
    } finally {
        process.exit(0);
    }
})();
