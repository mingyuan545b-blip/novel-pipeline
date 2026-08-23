/**
 * high-martial-crossplane/detectors.js
 *
 * 阶段3：通用检测器，仅保留跨分支通用的检测逻辑
 * 分支专属术语检测（禁用修仙术语）由分支detectorConfig注入
 *
 * 已移除：硬编码配角名（苏挽青/陆衡霜/顾缄言等）——违反禁止硬编码
 *         传统修仙境界术语检测（练气/筑基等）——分支通过detectorConfig管理
 */
const config = require('./config');
const perspective = config.perspective;

// 通用IP直呼检测词表（跨分支共享）
const IP_DIRECT_NAMES = /(路飞|孙悟空|哆啦A梦|鸣人|佐助|七龙珠|海贼王|奥特曼|恶魔果实|仙豆|竹蜻蜓|念能力|龟派气功|元气弹|螺旋丸|写轮眼|草帽|铁臂阿童木|柯南|毛利兰|灰太狼|喜羊羊|美羊羊|懒羊羊|光头强|熊大|熊二)/g;

module.exports = {
        perspective(content, styleProfile) {
            // 视角越界检测：全知解说规则来源/系统后台/环境势力
            const violationPatterns = [
                /环境\s+势力\s+正在\s+(进攻|集结|布阵)/g,
                /系统\s+后台\s+显示/gi,
                /全知视角\s+解说\s+规则来源/g
            ];
            let issues = [];
            for (const p of violationPatterns) {
                const matches = content.match(p);
                if (matches) issues.push({ type: 'perspective', text: matches[0] });
            }
            return { isViolation: issues.length > 0, issues, hasCriticalIssue: true };
        },
        terminology(content, styleProfile) {
            // 通用UI系统术语检测（跨分支共享）
            // 分支专属术语检测（修仙术语禁用）由分支detectorConfig注入
            const uiSystemTerms = /(积分\s*[:：]?\d+|进度条|面板显示|系统提示)/gi;
            let count = 0, instances = [], violationCount = 0;
            const uiMatches = content.match(uiSystemTerms);
            if (uiMatches) { count += uiMatches.length; instances.push(...uiMatches.map(t => ({ type: 'system_ui', text: t }))); violationCount++; }
            return { count, instances, violationCount };
        },
        modernSlang(content, styleProfile) {
            const slangPattern = /(我他妈|卧槽|牛逼|绝了|就这|栓Q)/g;
            const matches = content.match(slangPattern);
            return { count: matches ? matches.length : 0, instances: matches || [] };
        },
        aiTraceDetection(content) {
            const tracePatterns = [/(仿佛|似乎|不禁)\s+(他|主角)\s+(发现|感慨|觉得|意识到)/g, /(镜头\s+缓缓\s+拉近|推远|切换)/g, /(?:又|再|还)\s+是\s+(他|主角)\s+的(?:思考|内心)/g];
            let issues = [];
            for (const p of tracePatterns) {
                const matches = content.match(p);
                if (matches) issues.push(...matches.slice(0, 3).map(t => ({ type: 'ai_trace', text: t })));
            }
            return { isViolation: issues.length > 2, issues, hasCriticalIssue: true };
        },
        namingElegance(content) {
            // 通用网文烂梗命名检测（跨分支共享）
            // 分支专属命名检测（古风雅称禁用）由分支namingStyle注入
            const clichéNames = /(龙傲天|叶辰|柳如烟|萧炎|林动|楚轩)/g;
            const matches = content.match(clichéNames);
            return { isViolation: !!matches, issues: matches ? matches.map(n => ({ type: 'naming', text: n })) : [] };
        },
        timeLimitWeakening(content) {
            // 检测"残废化弱化"描述（时间限制/部位限制）
            const timePatterns = /(?:仅能|只能|仅可|仅限).{0,20}(\d+)\s*(秒|分钟|时辰)/g;
            const cripplePatterns = /(?:仅限|只能).{0,10}(手指关节|指尖大小|巴掌大小|指甲盖)/g;
            const matches = [];
            let m;
            while ((m = timePatterns.exec(content)) !== null) {
                matches.push({ type: 'time-limit-ability', text: m[0] });
            }
            while ((m = cripplePatterns.exec(content)) !== null) {
                matches.push({ type: 'crippled-ability', text: m[0] });
            }
            return { isViolation: matches.length > 0, issues: matches };
        },
        paragraphLength(content) {
            const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
            const longParas = paragraphs.filter(p => p.length > 200);
            const veryLongParas = paragraphs.filter(p => p.length > 300);
            return {
                isViolation: longParas.length > paragraphs.length * 0.3,
                totalParagraphs: paragraphs.length,
                longParagraphs: longParas.length,
                veryLongParagraphs: veryLongParas.length,
                issues: veryLongParas.slice(0, 3).map(p => ({ type: 'long-paragraph', text: p.substring(0, 60) + '...', length: p.length }))
            };
        },
        literaryBloat(content) {
            const bloatPatterns = [
                /(宛如|恍若|犹似|恰似|犹如).{0,20}(般|一样|似的|一般)/g,
                /(?:那|这).{0,5}(一抹|一缕|一丝|一道).{0,15}(划过|掠过|浮上|涌上)/g,
                /(?:空气|氛围|气息).{0,10}(凝固|凝滞|沉寂|静谧)/g
            ];
            let count = 0;
            for (const p of bloatPatterns) {
                const m = content.match(p);
                if (m) count += m.length;
            }
            return { isViolation: count > 3, count, issues: count > 3 ? ['文青病描写过多，需删减华丽辞藻改用大白话'] : [] };
        },
        comedyCheck(content) {
            const comedyPatterns = [
                /吐槽|内心OS|冷面|翻白眼|嘴角抽搐|无语|扶额|叹气|嘀咕/g,
                /系统.{0,20}(荒诞|离谱|离大谱|什么鬼|离奇)/g
            ];
            let count = 0;
            for (const p of comedyPatterns) {
                const m = content.match(p);
                if (m) count += m.length;
            }
            return { comedyCount: count, isInsufficient: count < 3, required: 3 };
        },
        paceCheck(content) {
            const envOnly = content.match(/(?:.{0,5}(雾气|云层|山峦|溪流|竹林|石阶|殿堂|廊道).{0,30}[。！？]\s*){3,}/g);
            const psychOnly = content.match(/(?:.{0,5}(心中|暗想|思忖|盘算|犹豫|纠结).{0,30}[。！？]\s*){3,}/g);
            return {
                isSlow: !!(envOnly || psychOnly),
                envBlock: envOnly ? envOnly.length : 0,
                psychBlock: psychOnly ? psychOnly.length : 0
            };
        },
        ipDirectNaming(content) {
            const matches = [];
            let m;
            while ((m = IP_DIRECT_NAMES.exec(content)) !== null) {
                matches.push({ type: 'ip-direct-name', text: m[0] });
            }
            return { isViolation: matches.length > 0, count: matches.length, issues: matches };
        },
        scoreStyleTime(content) {
            const scorePatterns = /(?:0\.[0-9]+\s*(秒|分钟|毫秒)|仅\s*[0-9]+\s*(秒|分钟|毫秒)\s*[内里])/g;
            const matches = [];
            let m;
            while ((m = scorePatterns.exec(content)) !== null) {
                matches.push({ type: 'score-style-time', text: m[0] });
            }
            return { isViolation: matches.length > 2, count: matches.length, issues: matches };
        },
        toolCharacterDetection(content) {
            // 通用工具人台词检测（跨分支共享）
            // 已移除硬编码配角名（苏挽青/陆衡霜等），改为通用检测
            if (!content) return { isViolation: false, issues: [] };
            const issues = [];
            const toolPhrases = [
                /(?:果然如此|您说得对|属下明白|主人英明|少爷英明|是，?大人|遵命|诺)/g,
                /(?:[^。！？]{0,10}(点了点头|应了一声|没有异议|表示赞同)[^。！？]{0,10})/g
            ];
            let toolCount = 0;
            for (const p of toolPhrases) {
                const m = content.match(p);
                if (m) toolCount += m.length;
            }
            const dialogueLines = content.match(/[""「」『』][^""「」『』]+[""「」『』]/g) || [];
            const shortAgree = dialogueLines.filter(d => d.length < 12 && /^(果然|是的|好的|明白|遵命|诺|是)/.test(d.slice(1)));
            if (toolCount > 5 || shortAgree.length > 3) {
                issues.push(`检测到${toolCount}处工具性台词+${shortAgree.length}处短同意对话，配角可能被工具人化`);
            }
           return { isViolation: issues.length > 0, issues, toolPhraseCount: toolCount, shortAgreeCount: shortAgree.length };
        }
    };
