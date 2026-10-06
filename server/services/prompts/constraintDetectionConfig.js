'use strict';

/**
 * 元约束检测配置（Constraint Detection Config）
 *
 * 单一数据源：所有检测器的关键词列表、阈值、模式都从此处读取
 * 可扩展性：新增约束=在此文件新增配置+新建检测器，不改核心
 *
 * 详见 SOP: docs/sop/08-约束执行规范.md 第六节
 */

const DETECTION_CONFIG = Object.freeze({
    M1: {
        threshold: 5,
        patterns: {
            metaphor: /(?:仿佛|宛如|似乎|犹如|恰似|宛若|好似|好像|一如|恍若|像是|如同|仿佛是|宛如是)[^，。！？\n]{0,20}(?:般|样|的|一般|一样|似的|一样|模样|样子)/g,
            adverb: /(?:不禁|不由|不由自主|情不自禁|默默|静静|缓缓|淡淡|微微|悄然|蓦地|蓦然|陡然|陡地|霍然)[^，。！？\n]{0,15}(?:叹|笑|皱|摇|点|转|站|坐|走|看|望|说|道|问|答|喊|叫|吼|喝)/g,
            quantifier: /(?:一丝|一缕|一抹|一瞬|一刹那|一瞬间|一分|一毫|一股|一阵|一泓|一汪)[^，。！？\n]{0,12}(?:笑意|寒意|暖意|意味|神色|气息|感觉|情绪|波动|涟漪|光|影|风|雾|香|腥)/g,
        },
    },
    M2: {
        threshold: 1,
        lookbackBase: 10,
        conflictPatterns: [
            { id: 'passive-counter', regex: /(?:不想|懒得|本不想|被迫|无奈).{0,30}(?:出手|反击|动手|出手|出手).{0,80}(?:意外|误伤|失手|没想到|不料|谁知道).{0,60}(?:装逼|装逼|牛逼|厉害|佩服|惊呆|震惊|傻眼)/ },
            { id: 'genius-fall', regex: /(?:天才|妖孽|绝世|第一).{0,40}(?:陨落|跌落|失败|落败|惨败|输给).{0,60}(?:主角|他)/ },
            { id: 'pig-eats-tiger', regex: /(?:嘲讽|讥讽|鄙视|看不起|废物|废柴|垃圾).{0,80}(?:展露|露出|展现|展示|爆发|发威).{0,60}(?:打脸|震惊|傻眼|惊呆|目瞪口呆)/ },
        ],
    },
    M3: {
        threshold: 0,
        endingChars: 200,
        openingChars: 200,
        minContentLength: 20,
        ngramSizes: [2, 3, 4],
        ngramOverlapThreshold: 3,
        sceneKeywords: /(?:场景|地点|环境|房间|街道|山林|天空|地面|前方|身后|左右|四周|周围)/,
        actionKeywords: /(?:走|跑|跳|站|坐|倒|摔|抓|推|拉|打|击|劈|砍|刺|挡|闪|躲|退|进|出|起|落)/,
        dialogueKeywords: /(?:["「『"].{0,50}["」』"]|说道|喊道|问道|答道|道:|说:|问:)/,
        timeKeywords: /(?:第二天|次日|清晨|傍晚|黄昏|夜晚|半夜|上午|下午|不久后|过了一会|片刻后|稍顷|少顷|须臾)/,
    },
    M4: {
        threshold: 2,
        patterns: {
            abstractTime: /(?:时间|空间|世界|天地|万物).{0,5}(?:仿佛|宛如|似乎|犹如|好像|像是|如同).{0,10}(?:静止|凝固|停滞|停止|冻结|冰封|冰结)/g,
            airSolidify: /(?:空气|氛围|气息|周遭|四周).{0,3}(?:凝固|冻结|冰封|冰结|停滞|静止)/g,
            fateGear: /(?:命运|历史|世界|时代|天道).{0,10}(?:的)?.{0,5}(?:齿轮|洪流|潮流|巨轮|车轮|轨迹|漩涡|浪潮).{0,15}(?:转动|滚滚|向前|涌动|推进|碾压|碾压)/g,
            fateStatement: /(?:这就是|这便是|皆是|无非是|不过是).{0,3}(?:命运|天意|宿命|天道|定数|因果|注定)/g,
            silentShock: /(?:无言|沉默|无声|寂静|静谧).{0,5}(?:的)?.{0,10}(?:震撼|力量|威压|感动|感悟|意味|领悟|真理|哲理|一切)/g,
            allInSilence: /(?:一切|所有|全部).{0,5}(?:尽在|都在|全在).{0,5}(?:不言|无声|沉默|静默|无言)中?/g,
        },
    },
    M5: {
        threshold: 0.5,
        maxLineLength: 30,
        minDialogueCount: 2,
        toolResponsePatterns: [
            /^(?:是|好的|嗯|对|没错|好|行)[，。！？.!?]/,
            /^(?:牛逼|厉害|真厉害|真牛逼|威武)[，。！？.!?]/,
            /^(?:说得对|说得是|就是啊|可不是嘛|对的)[，。！？.!?]/,
            /^(?:主人|公子|少爷|小姐|女王|陛下)[，。！？.!?]/,
            /^(?:是|好的|嗯|对|没错|好|行)，(?:主人|公子|少爷|小姐)/,
        ],
        independentInfoMarkers: /(?:但是|可是|不过|我觉得|我认为|我不|我还有|我需要|我想要|我有条件|不过我|但是我)/,
        dialoguePattern: /(?:["「『"])(.{1,30})(?:["」』"])/g,
    },
    // —— 12-创作工艺 新增：治"AI味/张力泄气/升华收尾/意象复用/钩子同质/情绪断档" ——
    M6: {
        threshold: 2,
        lookaheadChars: 60,
        tensionPattern: /(?:死|血|伤|命|杀|逃|危|颤|战栗|冷汗|剧痛|喘息|嘶|断裂|碎裂|逼|擒|锁|僵|惨|尸|葬|亡|鬼|魂|地府|阎王|收尸|棺|丧|埋|追兵|黑榜|偿命)/,
        banterPattern: /(?:差评|吐槽|甲方|乙方|报销|绩效|打卡|加班|客服|进度条|KPI|老板|打工|下班|工资|月薪|外包|供应商|用户体验|开挂|上分|BUG|内存|代码|服务器|上线|售后|退货|发票|减压|健身|减肥)/,
        tonePattern: /(?:嘿嘿|哈哈|冷笑话|开个玩笑|打个比方|自嘲|苦中作乐)/,
    },
    M7: {
        threshold: 2,
        endingChars: 160,
        paragraphTailChars: 40,
        elevationPatterns: {
            scaleVista: /(?:渺小|微不足道|浩瀚|辽阔|无垠|苍茫|天地之间|融入[^，。！？\n]{0,8}(?:画卷|洪流|长河|夜色))/g,
            fateStatement: /(?:终将|注定|或许[^，。！？\n]{0,10}才是|才是[^，。！？\n]{0,8}(?:真谛|答案|意义)|而这一切|这一切)/g,
            openEnding: /(?:(?:真正的|一切)[^，。！？\n]{0,6}(?:才|刚刚)开始|才刚刚开始|故事[^，。！？\n]{0,4}开始|没有人知道|无人知晓)/g,
            lingeringEmotion: /(?:久久不|挥之不去|难以言喻|说不出的|莫名的)/g,
        },
    },
    M8: {
        threshold: 0,
        prevTailChars: 250,
        openingChars: 320,
        tensionPattern: /(?:死|血|伤|命|杀|逃|危|颤|冷|痛|抖|慌|惊|怕|喘|汗|断|碎|裂|沉|逼|压|锁|僵|惨)/,
        minOverlapBigrams: 3,
    },
    M9: {
        threshold: 1,
        minImageLength: 6,
        similePattern: /(?:像|好像|如同|仿佛|宛如|犹如|好似|恰似|恍若)[^，。！？\n]{2,24}/g,
    },
    M10: {
        threshold: 0,
        endingChars: 150,
        minSharedBigrams: 3,
        hookTypes: {
            danger: /(?:脚步声|逼近|袭来|阴影里|扑来|杀意|危险|贴上|压境|合拢|涌出|踏地声|转动|启动)/,
            information: /(?:纸条|一行|小字|写着|刻着|字迹|落款|署名|符号|地图|暗纹|印记)/,
            choice: /(?:选择|抉择|该不该|要么|必须)[^，。！？\n]{0,12}(?:还是|或|要么)/,
            reversal: /(?:原来|竟然|没想到|其实|真正|反倒|反而)/,
            cost: /(?:代价|失去|换来|再也|回不去|折了|葬送)/,
        },
    },
});

function getConfig(constraintId) {
    return DETECTION_CONFIG[constraintId] || null;
}

function getThreshold(constraintId) {
    const config = DETECTION_CONFIG[constraintId];
    return config?.threshold ?? 0;
}

module.exports = {
    DETECTION_CONFIG,
    getConfig,
    getThreshold,
};
