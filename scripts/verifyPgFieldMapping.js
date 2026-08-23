/**
 * verifyPgFieldMapping.js — 验证PG字段映射问题
 * 创建项目→查PG→确认targetChapterCount是否为null
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const HOST = '127.0.0.1';

const envPath = path.join(__dirname, '..', '.env');
let AUTH_TOKEN = '';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const matches = envContent.match(/^REQUEST_SECRET=(.+)$/gm);
    if (matches && matches.length > 0) {
        AUTH_TOKEN = matches[matches.length - 1].split('=')[1].trim();
    }
}

function request(method, urlPath, body = null) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: HOST, port: PORT, path: urlPath, method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH_TOKEN}` },
            timeout: 30000,
        };
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
        const req = http.request(options, (res) => {
            let chunks = '';
            res.on('data', (chunk) => chunks += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(chunks), raw: chunks }); }
                catch (e) { resolve({ status: res.statusCode, body: null, raw: chunks }); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (data) req.write(data);
        req.end();
    });
}

async function main() {
    console.log('========================================');
    console.log('PG字段映射验证');
    console.log('========================================');

    // 1. 创建项目
    console.log('\n=== 1. 创建项目 ===');
    const createRes = await request('POST', '/api/projects', {
        name: 'PG字段映射测试',
        genre: '玄幻',
        subGenre: 'tomato-talisman',
        targetChapters: 15,
        wordConfig: { minWords: 2000, targetWords: 3000, maxWords: 4000 },
    });
    if (createRes.status !== 201) {
        console.log('❌ 创建失败:', createRes.status, createRes.body);
        process.exit(1);
    }
    const project = createRes.body;
    console.log(`✅ 项目创建成功: id=${project.id}`);
    console.log(`   targetChapters(业务对象): ${project.targetChapters}`);
    console.log(`   targetChapterCount(业务对象): ${project.targetChapterCount}`);

    // 2. 直接查PG
    console.log('\n=== 2. 查询PG数据库 ===');
    const { Client } = require('pg');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
    if (!dbUrlMatch) {
        console.log('❌ 未找到DATABASE_URL');
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrlMatch[1].trim() });
    await client.connect();

    const pgRes = await client.query('SELECT id, mode, targetChapterCount, targetWordCount FROM projects WHERE id = $1', [project.id]);
    if (pgRes.rows.length === 0) {
        console.log('❌ PG中找不到项目');
    } else {
        const row = pgRes.rows[0];
        console.log(`✅ PG查询成功:`);
        console.log(`   mode: ${row.mode}`);
        console.log(`   targetChapterCount(PG列): ${row.targetchaptercount}`);
        console.log(`   targetWordCount(PG列): ${row.targetwordcount}`);

        if (row.targetchaptercount === null) {
            console.log('   ❌ 确认问题: PG.targetChapterCount为null，业务对象targetChapters=15未落库到PG索引列');
        } else if (row.targetchaptercount === 15) {
            console.log('   ✅ PG.targetChapterCount正确落库');
        }
    }

    // 3. 查data字段
    const dataRes = await client.query('SELECT data FROM projects WHERE id = $1', [project.id]);
    if (dataRes.rows.length > 0) {
        const data = JSON.parse(dataRes.rows[0].data);
        console.log(`\n=== 3. data字段检查 ===`);
        console.log(`   data.targetChapters: ${data.targetChapters}`);
        console.log(`   data.targetChapterCount: ${data.targetChapterCount}`);
        if (data.targetChapters === 15 && data.targetChapterCount === undefined) {
            console.log('   ✅ data字段包含targetChapters=15');
        }
    }

    await client.end();

    // 4. 清理
    console.log('\n=== 4. 清理 ===');
    const delRes = await request('DELETE', `/api/projects/${project.id}`);
    if (delRes.status === 200) {
        console.log('✅ 项目已删除');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('执行异常:', err);
    process.exit(1);
});
