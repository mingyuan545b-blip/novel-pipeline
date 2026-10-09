/**
 * high-martial-crossplane/interceptors.js
 */
const detectors = require('./detectors');

module.exports = {
        firstReview(content, styleProfile, context) {
            const hardBlockIssues = [];
            const warningIssues = [];
            const hints = [];

            const literaryCheck = detectors.literaryBloat(content);
            if (literaryCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `文青病超标：检测到${literaryCheck.count}处华丽辞藻堆砌。必须删减，改用大白话讲故事。环境描写最多2句带过，把笔墨留给动作、对话、吐槽。`, title: '文青病' });
            }

            const comedyCheck = detectors.comedyCheck(content);
            if (comedyCheck.isInsufficient) {
                warningIssues.push({ severity: 'medium', description: `喜剧元素不足：仅检测到${comedyCheck.comedyCount}处笑点，建议至少${comedyCheck.required}处。本书核心卖点是搞笑，正文太正经就名不副实。增加主角吐槽、系统荒诞感、位面错位幽默。`, title: '喜剧偏弱' });
            }

            const paceCheck = detectors.paceCheck(content);
            if (paceCheck.isSlow) {
                hardBlockIssues.push({ severity: 'high', description: `节奏太慢：检测到大段纯环境描写或纯心理活动。必须删减铺陈，用对话和动作推进剧情。禁止连续2段纯描写。`, title: '节奏拖沓' });
            }

            const termCheck = detectors.terminology(content, styleProfile);
            if (termCheck.violationCount > 0 && termCheck.count > 3) {
                hardBlockIssues.push({ severity: 'critical', description: `检测到${termCheck.count}处战力命名烂大街或系统UI元数据泄露，违反铁律三。`, title: '体系污染' });
            }

            const perspectiveCheck = detectors.perspective(content, styleProfile);
            if (perspectiveCheck.isViolation) {
                hardBlockIssues.push({ severity: 'high', description: '视角越界描写小世界势力或系统后台，违反铁律二。', title: '视角崩坏' });
            }

            const aiTrace = detectors.aiTraceDetection(content);
            if (aiTrace.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: '检测到高频AI写作痕迹（机械过渡词/空洞比喻/重复句式），违反反套路与喜剧基调要求。', title: 'AI腔调超标' });
            }

            const slangCheck = detectors.modernSlang(content, styleProfile);
            if (slangCheck.count > 2) {
                warningIssues.push({ severity: 'high', description: '低质网络烂梗使用过多，破坏喜剧质感。', title: '梗质量低劣' });
            }

            const nameCheck = detectors.namingElegance(content);
            if (nameCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `检测到网文烂梗命名（${nameCheck.issues.map(i=>i.text).join(', ')}），违反古典雅致规范。`, title: '命名违规' });
            }

            // 陷阱#74修复：detectors.powerScalingCheck未实现（detectors.js未导出）
            // 防御性检查：只在函数存在时调用，避免TypeError被catch吞为WARN
            // 程序化分支用权限等级不用战力堆叠，此检测对程序化分支不适用
            if (typeof detectors.powerScalingCheck === 'function') {
                const scalingCheck = detectors.powerScalingCheck(content);
                if (scalingCheck && scalingCheck.isViolation) {
                    hardBlockIssues.push({ severity: 'critical', description: '检测到直接跨越大境界或堆叠战力超限，违反铁律一。', title: '战力崩坏' });
                }
            }

            const timeLimitCheck = detectors.timeLimitWeakening(content);
            if (timeLimitCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `弱化版能力使用了时间限制或残废化描述，违反铁律三。能力功能完整，弱化应通过主世界修为天花板自然压制体现。`, title: '弱化方式违规' });
            }

            const paraCheck = detectors.paragraphLength(content);
            if (paraCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: `段落过长影响阅读体验：${paraCheck.totalParagraphs}段中有${paraCheck.longParagraphs}段超200字。必须拆分：对话独立成段，每段不超过150字。`, title: '段落节奏违规' });
            }

            const ipCheck = detectors.ipDirectNaming(content);
            if (ipCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `IP角色/道具直呼其名（${ipCheck.issues.map(i=>i.text).join(', ')}），违反铁律四点五。必须用外貌特征+性格代号替代。`, title: 'IP直呼违规' });
            }

            const scoreTimeCheck = detectors.scoreStyleTime(content);
            if (scoreTimeCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: `评分式时间描述过多（${scoreTimeCheck.count}处"0.X秒"），违反活人写作规范。用正常人时间感知替代。`, title: '评分式时间' });
            }

            const toolCharCheck = detectors.toolCharacterDetection(content);
            if (toolCharCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: `配角可能被工具人化：${toolCharCheck.issues.join('；')}。每个出场配角至少展现1个独立特质（个人目标/判断/质疑/微表情）。`, title: '配角工具人化' });
            }

            hints.push('确保每章至少3处笑点');
            hints.push('用大白话讲故事，不要文青病');
            hints.push('节奏要快，不要大段描写铺陈');
            return { hardBlockIssues, warningIssues, hints };
        },
        secondReview(content, styleProfile, context) {
            const hardBlockIssues = [];
            const warningIssues = [];
            const hints = [];

            // 铁律三：系统UI元数据直出（结构化检测 + 否定语境豁免，修误报）
            const metaCheck = detectors.systemMetadataLeak(content);
            if (metaCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `检测到${metaCheck.count}处系统UI元数据直出（${metaCheck.issues.map(i => i.text).slice(0, 3).join('、')}），违反铁律三：系统提示/积分面板须内化为世界观具象表达。`, title: '元数据泄露' });
            }

            const literaryCheck = detectors.literaryBloat(content);
            if (literaryCheck.isViolation) {
                warningIssues.push({ severity: 'high', description: '仍存在文青病描写，建议进一步删减华丽辞藻。', title: '文风偏文青' });
            }

            const comedyCheck = detectors.comedyCheck(content);
            if (comedyCheck.isInsufficient) {
                warningIssues.push({ severity: 'high', description: `喜剧元素仍不足（${comedyCheck.comedyCount}/${comedyCheck.required}），建议增加吐槽和错位幽默。`, title: '喜剧偏弱' });
            }

            const powerCheck = detectors.terminology(content, styleProfile);
            if (powerCheck.violationCount > 0) {
                warningIssues.push({ severity: 'medium', description: '战力命名未严格遵循9×9雅致框架，建议替换。', title: '命名雅化不足' });
            }

            const aiTrace = detectors.aiTraceDetection(content);
            if (aiTrace.isViolation) {
                warningIssues.push({ severity: 'medium', description: '存在机械过渡词或影视化套话，建议改为白描笔法。', title: '文风AI化' });
            }

            const ipCheck = detectors.ipDirectNaming(content);
            if (ipCheck.isViolation) {
                hardBlockIssues.push({ severity: 'critical', description: `IP角色/道具直呼其名（${ipCheck.issues.map(i=>i.text).join(', ')}），违反铁律四点五。`, title: 'IP直呼违规' });
            }

            hints.push('复核节奏是否够快、喜剧是否达标、文风是否接地气');
            return { hardBlockIssues, warningIssues, hints };
        }
    };
