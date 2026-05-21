const http = require('http');
const PROJECT_ID = 'd4808c1a-3378-4372-b672-9d0a6bd075f8';
const AUTH = 'Bearer novel-pipeline-2024-secure';

function apiCall(method, path, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : '';
        const options = {
            hostname: 'localhost', port: 3001, path, method,
            headers: { 'Content-Type': 'application/json', 'Authorization': AUTH }
        };
        if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(responseBody) }); }
                catch (_) { resolve({ status: res.statusCode, data: responseBody }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function createMaterial(type, name, content, extra = {}) {
    const body = {
        projectId: PROJECT_ID,
        type,
        name,
        initialContent: content,
        currentContent: content,
        ...extra
    };
    const result = await apiCall('POST', '/api/materials', body);
    if (result.status === 201 || result.status === 200) {
        console.log(`  OK ${type}: ${name}`);
        return result.data;
    } else {
        console.error(`  FAIL ${type}: ${name} - Status ${result.status}`, result.data?.error || result.data);
        return null;
    }
}

async function main() {
    console.log('=== 重建千面项目基底素材 ===\n');

    // 1. 次位面 - 九龙城寨
    const kowloon = await createMaterial('sub-plane', '九龙', `【次位面·九龙城寨】
类型：规则怪谈类（千局变体）
时代背景：1980年代九龙城寨
核心规则：千局无引导、纯生存。系统仅作为"门"的媒介，不提供任务说明、属性面板或UI提示
入场方式：通过铜筹激活的暗门进入
出局条件：筹码耗尽或违反局内铁律
氛围基调：市井写实+悬疑+黑色幽默，禁止网游化/系统化
视觉风格：逼仄巷道、违建叠楼、霓虹碎光、潮湿黏腻
社会结构：和义堂为唯一秩序维护者，底层生存逻辑驱动一切
特殊约束：白话文风，禁止网络用语，禁止游戏UI面板`, { parentPlane: null, parentFaction: null });

    const kowloonId = kowloon?.id;

    // 2. 势力 - 和义堂
    const heyitang = await createMaterial('faction', '和义堂', `【势力·和义堂】
所属位面：九龙
性质：九龙城寨唯一秩序维护者
内部结构：九指强为话事人，歪嘴明为账房管事，下设多个堂口
核心利益：控制千局规则解释权与账房信息
与主角关系：既是障碍也是线索来源
行为逻辑：利益驱动，非善恶二元
关键地点：账房（存放千局核心账本与老鬼遗留线索）
势力规模：中型（百人级）`, { parentPlane: kowloonId, parentFaction: null });

    const heyitangId = heyitang?.id;

    // 3. 角色 - 贺千（主角）
    await createMaterial('character', '贺千', `【主角·贺千】
身份：街头老千 / 千局入局者
性格：话术精湛、遇险不慌、笑容是武器、对未知代价保持警惕但敢于试错
核心动机：查清父亲贺山死因与债务真相
千术四基：
  易容术：改变声线步态微表情，需道具和时间
  读人术：观察微表情判断想法，准确率约七成
  设套术：制造信息差让对方自己骗自己，需时间布局
  脱身术：被识破后的逃跑手段，制造混乱脱身
禁忌：禁止系统开挂；禁止全知布局；每个骗局必须符合逻辑
口头禅：来局？（关键对峙或抉择节点自然触发）
微表情：说谎时眼神极度真诚，紧张时习惯性摸左手无名指（戒指已赌掉），真正动真格时笑容消失
生理标记：左手无名指戒痕（持续刺痛发痒），筹码使用后身体部位知觉丧失`, { parentPlane: null, parentFaction: null });

    // 4. 角色 - 纪棠
    await createMaterial('character', '纪棠', `【角色·纪棠】
身份：拆白（职业骗徒）/ 千局局中人
性格：眼毒嘴毒，对贺千仅因千术有用而保持有限合作
核心动机：寻找失踪的哥哥（暗线）
与贺千关系：互相利用不信任，合作必须带有明确目的性与嘲讽底色
微表情：歪头辨伪、嘴角微挑
行为模式：从不主动提供关键情报，帮助必带条件
禁忌：禁止对贺千产生情感依赖或无条件信任`, { parentPlane: kowloonId, parentFaction: null });

    // 5. 角色 - 贺山
    await createMaterial('character', '贺山', `【角色·贺山】
身份：贺千之父 / 千局前入局者（已死）
死因：与千局相关，具体真相待揭
遗留线索：信上只有一句"千局是假的"
与贺千关系：驱动贺千入局的核心动机
叙事功能：伏笔载体，通过遗留物和他人回忆逐步揭示
禁忌：不可通过回忆直接揭示全部真相`, { parentPlane: null, parentFaction: null });

    // 6. 角色 - 沈不归
    await createMaterial('character', '沈不归', `【角色·沈不归】
身份：千局"老鬼"（传说级人物）/ 前代入局者
状态：行踪不明，通过遗留线索和他人传闻存在
叙事功能：千局深层规则的揭示者，贺千最终理解千局真相的关键
与贺千关系：间接引导，非直接出场
禁忌：不可过早揭示身份，不可机械降神`, { parentPlane: null, parentFaction: null });

    // 7. 角色 - 江晚
    await createMaterial('character', '江晚', `【角色·江晚】
身份：千局中的神秘女性 / 身份待揭
性格：冷静自持，信息量大于表现量
与贺千关系：待定（非感情线）
叙事功能：信息节点，在关键时刻提供线索但从不解释原因
禁忌：不可沦为花瓶或感情工具人`, { parentPlane: kowloonId, parentFaction: null });

    // 8. 角色 - 九指强
    await createMaterial('character', '九指强', `【角色·九指强】
身份：和义堂话事人 / 九龙秩序维护者
性格：表面粗犷实则施压精准，以沉默与停顿制造心理威慑
微表情：把玩核桃骤停时目光锁定目标后颈，压迫感极强
断指疤痕：明显
与贺千关系：敌对但暂不清洗，视其为棋子
行为逻辑：利益最大化，对账房存疑但暂不发作
禁忌：不可降维为简单反派，需有独立立场`, { parentPlane: kowloonId, parentFaction: heyitangId });

    // 9. 角色 - 歪嘴明
    await createMaterial('character', '歪嘴明', `【角色·歪嘴明】
身份：和义堂账房管事 / 九指强下属
性格：表面服从实则自保，试图在老大夺权前保留筹码
微表情：倒茶时手指重刮杯壁掩饰紧张，拇指反复摩挲杯沿至指节泛白，嘴角歪斜加深
与贺千关系：警惕但暂用其跑腿
行为逻辑：在权力夹缝中求存，暗藏真账本
禁忌：不可沦为纯粹工具人`, { parentPlane: kowloonId, parentFaction: heyitangId });

    console.log('\n=== 基底素材重建完成 ===');
}

main().catch(e => console.error('Error:', e.message));
