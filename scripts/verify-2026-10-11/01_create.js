/**
 * 01_create.js — 2026-10-11 验证会话：新建 10 章项目（根源修复验收）
 * 题材：高武·反套路喜剧（high-martial-crossplane），分支：metaverse（游戏化元宇宙·副本）
 * 目的：验证 S1-S8 字段单一源/契约/登记分诊/实体投影/装配审计/首轮字数 + 铁律一~三 + M11 AI腔 + 取名/人物工艺
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env'), override: true });
const http = require('http');
const fs = require('fs');
const path = require('path');
const SECRET = process.env.REQUEST_SECRET || '';

function api(method, p, body, timeoutMs = 1800000) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = { hostname: 'localhost', port: 3001, path: p, method,
            headers: { 'Authorization': 'Bearer ' + SECRET, 'Content-Type': 'application/json' }, timeout: timeoutMs };
        if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
        const r = http.request(opts, (res) => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch (e) { resolve({ status: res.statusCode, data: d }); } });
        });
        r.on('error', reject);
        r.on('timeout', () => { r.destroy(); reject(new Error('timeout ' + timeoutMs)); });
        if (data) r.write(data); r.end();
    });
}

const DESC = [
    '【世界观·游戏化元宇宙】众生界是一套仍在运行的"结算宇宙"：天道不是神，而是一台老旧的结算主机；山门是公会，飞剑是挂件，功法是技能树，境界是等级。世界处处是没修干净的机制BUG——任务描述词不达意、副本判定自相矛盾、奖励随结算延迟忽高忽低。修士即玩家，一切行为都要"入账"。',
    '',
    '【主角】陆行舟（ID：Ferryman_行舟），前航运调度员，惯于在资源表里找漏洞，冷静克制、话少但毒。穿越成 Lv1 白板玩家，觉醒"越界者"体质——能看见world.log里的底层报错行，擅长"读日志→算收益→设计绕行路径→执行"。口头禅："先把日志读完再动手。"',
    '',
    '【配角】阿磬（ID：BronzeBell_磬），体修护卫，憨直守信，血厚防高不善言辞，常被主角当人形沙包使唤却从不记恨。成长线：从"只会挡"到"会算伤值"。',
    '',
    '【系统NPC·谜题核心】拂尘（客服编号SVC-027），副本引导NPC，台词脚本僵化，偶发"越界发言"暗示有自我意识，是全卷悬念的钥匙。',
    '',
    '【反派】尚工阁主·裴迟，全服最强公会"尚工阁"的会长，高端玩家，表面维护秩序，实则垄断首通奖励，信奉"规则是用来保护既得者的"。',
    '',
    '【金手指·越界日志权限】主角能调用的不是外挂，而是"日志权限"：读(world.log)、过滤(grep)、回滚(checkout上一次状态)、屏蔽(注释掉一次判定)。能力受等级限制，代价是消耗"行舟值"或招致反作弊审计。',
    '',
    '【第一卷主线（10章）】1章 穿越新手村Lv1、觉醒越界日志、用回滚救下将团灭的阿磬；2章 首个副本"静默码头"仇恨结算错误，读日志卡BUG首通（Lv1→Lv8）；3-4章 加入小公会"摆渡人"、露头排行榜、与尚工阁结怨；5-7章 限时活动"潮汛季"关卡规则自相矛盾，越级博弈；8-9章 拂尘暴露越界发言，主角发现越界者不止一人、底层有"管理员"；10章 第一卷高潮，复合日志指令卡掉裴迟的垄断机制，拿下服务器级首通，同时付出越界代价。',
].join('\n');

const OUTLINE_PROMPT = [
    '生成10章完整大纲，严格遵循游戏化元宇宙·副本博弈节奏：',
    '1章 新手村觉醒+日志权限初显；2章 首个副本读日志卡BUG首通（Lv1→Lv8）；',
    '3-4章 小公会+排行榜露头+与尚工阁结怨；5-7章 限时活动潮汛季越级博弈；',
    '8-9章 拂尘越界发言+越界者真相+管理员伏笔；10章 第一卷高潮·服务器首通+代价。',
    '每章必须包含至少1个可画面化的名场面、1处机制BUG或博弈设计、1个章末钩子。',
    '战力用"等级/经验值/装备/技能/副本/日志"表述，禁用传统修仙术语（练气/筑基/金丹/境界/修为/灵力/功法/法宝/丹药/宗门）。',
    '人物取名必须带画面与身份、符合世界观（参考：陆行舟/阿磬/拂尘/裴迟），禁止"萧炎/龙傲天/沈砚/顾清寒/柳如烟"式烂大街名与"姓+清寒/云雪"式流水线拼接。',
].join('\n');

(async () => {
    const body = {
        name: '结算宇宙·拾荒者（根源修复验收）',
        genre: '高武',
        subGenre: 'high-martial-comedy',
        branchKey: 'metaverse',
        targetChapters: 10,
        description: DESC,
        settings: { chapterRounds: 3, chronicleLevel: 'full', worldScopeLevel: 'full' },
        materialPrompt: DESC,
        outlinePrompt: OUTLINE_PROMPT,
    };
    console.log('=== POST /api/projects/initialize (branchKey=metaverse, 10章) ===');
    const t = Date.now();
    const r = await api('POST', '/api/projects/initialize', body);
    console.log('HTTP=', r.status, 'elapsed=', ((Date.now() - t) / 1000).toFixed(1) + 's');
    fs.writeFileSync(path.join(__dirname, '01_create_resp.json'), JSON.stringify(r.data, null, 2));
    const respBody = (r.data && r.data.data) ? r.data.data : r.data;
    console.log('steps:', JSON.stringify(respBody.steps || [], null, 2));
    const pid = respBody && (respBody.projectId || (respBody.project && respBody.project.id));
    if (pid) { fs.writeFileSync(path.join(__dirname, 'project_id.txt'), pid); console.log('\n>>> PROJECT_ID =', pid); }
    else console.error('\n>>> 未取到 projectId:', JSON.stringify(r.data).substring(0, 500));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
