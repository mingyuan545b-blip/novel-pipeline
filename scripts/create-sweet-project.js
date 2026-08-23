/**
 * 甜宠漫剧项目创建+素材生成+大纲生成脚本
 * 项目：他的纹身机只为我停过
 * 题材：甜宠匠心 (tomato-sweet-artisan)
 */
const http = require('http');

const REQUEST_SECRET = 'dev';

function apiRequest(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const postData = body ? JSON.stringify(body) : '';
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (body) headers['Content-Length'] = Buffer.byteLength(postData);

        const req = http.request({ hostname: 'localhost', port: 3001, path, method, headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data: data.substring(0, 2000) }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(postData);
        req.end();
    });
}

async function main() {
    // Step 1: Get auth token
    console.log('Step 1: Getting auth token...');
    const authRes = await apiRequest('POST', '/api/auth/token', { secret: REQUEST_SECRET });
    if (authRes.status !== 200 || !authRes.data.token) {
        console.error('Auth failed:', JSON.stringify(authRes));
        process.exit(1);
    }
    const token = authRes.data.token;
    console.log('Token obtained successfully');

    // Step 2: Create project
    console.log('\nStep 2: Creating project...');
    const projectData = {
        name: '他的纹身机只为我停过',
        genre: '甜宠匠心',
        description: '落魄独立设计师沈星晚搬进旧城老巷，遇见沉默野性的纹身师陆野。她的设计线条细腻如刺绣，他的纹身粗犷中藏温柔。两个手艺人在创作碰撞中靠近，在社区烟火气中相守。当拆迁推土机碾过老巷，当旧伤在深夜复发，他们用作品替彼此挡住世界的冷——他修好她断针的缝纫机，她替他设计出最温柔的纹身稿。这不是霸总宠妻，是两个手艺人的笨拙温柔。',
        mode: 'novel',
        targetChapters: 25,
        styleProfile: { genre: '甜宠匠心', style: '诗意意象', tone: '甜蜜微虐烟火气', pov: '第三人称双视角' },
        genreProfile: '甜宠匠心',
        subgenre: 'tomato-sweet-artisan',
        wordConfig: { targetMin: 2200, targetMax: 2800, rejectMin: 1850, maxWords: 3500 },
        constraints: [
            'sweet-artisan-pace', 'sugar-abuse-ratio', 'artisan-chemistry',
            'anti-dog-blood', 'every-chapter-sugar', 'hook-every-chapter',
            'no-coward-behavior', 'artisan-sensory', 'anti-bazong',
            'artisan-dialogue-style', 'relationship-progression'
        ]
    };

    const createRes = await apiRequest('POST', '/api/projects', projectData, token);
    console.log('Create Status:', createRes.status);
    const projectId = createRes.data.project?.id || createRes.data.id;
    if (!projectId) {
        console.error('Project creation failed:', JSON.stringify(createRes.data, null, 2).substring(0, 2000));
        process.exit(1);
    }
    console.log('Project ID:', projectId);
    console.log('Project Name:', createRes.data.project?.name);

    // Step 3: Verify project data
    console.log('\nStep 3: Verifying project data...');
    const getRes = await apiRequest('GET', `/api/projects/${projectId}`, null, token);
    if (getRes.status === 200) {
        const p = getRes.data;
        console.log('  name:', p.name);
        console.log('  genre:', p.genre);
        console.log('  mode:', p.mode);
        console.log('  targetChapters:', p.targetChapters);
        console.log('  subgenre:', p.subgenre);
        console.log('  styleProfile.genre:', p.styleProfile?.genre);
        console.log('  constraints:', p.constraints?.length, 'items');
    }

    // Step 4: Generate initial materials
    console.log('\nStep 4: Generating initial materials...');
    const matRes = await apiRequest('POST', '/api/pipeline/generate-materials', {
        projectId,
        prompt: '根据甜宠匠心档案，生成完整素材库：落魄独立设计师沈星晚×旧城纹身师陆野，旧城老巷社区，创作碰撞+社区烟火气+拆迁危机。男主反差萌（对外野性沉默对女主小心翼翼），女主独立人格（落魄但不落志）。每章必须有画面感名场面，适合漫剧改编。'
    }, token);
    console.log('Materials Status:', matRes.status);
    if (matRes.data.error) {
        console.log('Materials Error:', matRes.data.error);
    } else {
        console.log('Materials Count:', matRes.data.count || matRes.data.created?.length || 'unknown');
        if (matRes.data.created) {
            console.log('Material Types:', matRes.data.created.map(m => m.type).join(', '));
        }
    }

    // Step 5: Generate chapter outlines
    console.log('\nStep 5: Generating chapter outlines...');
    const outlineRes = await apiRequest('POST', '/api/pipeline/generate-outlines', {
        projectId,
        prompt: '生成25章完整大纲，严格遵循甜宠匠心节奏：1章巷口相遇，3章职业交集，5章首次心动，10章大甜+关系升级+创作合作确立，15章小虐转折（拆迁危机+旧伤复发），25章终极甜蜜。每章大纲必须包含1个可画面化的名场面。',
        targetChapters: 25
    }, token);
    console.log('Outlines Status:', outlineRes.status);
    if (outlineRes.data.error) {
        console.log('Outlines Error:', outlineRes.data.error);
    } else {
        console.log('Outlines Count:', outlineRes.data.count || outlineRes.data.outlines?.length || 'unknown');
    }

    console.log('\n=== Project Creation Complete ===');
    console.log('Project ID:', projectId);
}

main().catch(e => console.error('Error:', e));
