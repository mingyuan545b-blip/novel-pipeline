/**
 * baby/interceptors.js
 */
const detectors = require('./detectors');
const { qualityChecks } = require('./qualityChecks');

module.exports = {
        firstReview(content, styleProfile, context) {
            const hardBlockIssues = [];
            const warningIssues = [];
            const hints = [];

            const perspResult = detectors.perspective(content, styleProfile);
            if (perspResult.isViolation) {
                const criticalDescs = perspResult.issues.filter(i => i.severity === 'critical').map(i => i.desc);
                const highDescs = perspResult.issues.filter(i => i.severity === 'high').map(i => i.desc);
                if (criticalDescs.length > 0) {
                    hardBlockIssues.push({ severity: 'critical', description: `视角违规：${criticalDescs.join('；')}，必须重写为幼崽视角/幼崽行为驱动`, title: '视角违规' });
                    hints.push(`【🚨视角违规检测 - 严重违规】幼崽角色出现成人化内心：${criticalDescs.join('；')}。必须重写为幼崽视角/幼崽行为驱动`);
                }
                if (highDescs.length > 0) {
                    hardBlockIssues.push({ severity: 'critical', description: `视角越界：${highDescs.join('；')}，必须重写加入幼崽视角/幼崽行为描写`, title: '视角越界' });
                    hints.push(`【⚠️视角偏移检测 - 需调整】${highDescs.join('；')}。成人角色内心活动应优先通过幼崽可观察行为侧面表达`);
                }
            }

            const termResult = detectors.terminology(content, styleProfile);
            if (termResult.violationCount > 0) {
                const babyJargons = termResult.instances.filter(j => !j.allowable).map(j => `"${j.match}"(${j.perspective}视角)→"${j.suggestion}"`).join('、');
                const adultJargons = termResult.instances.filter(j => j.allowable).map(j => `"${j.match}"(成人语境)`).join('、');
                hardBlockIssues.push({ severity: 'critical', description: `幼崽视角科技术语未降维：发现${termResult.violationCount}处幼崽视角中的科技术语(${babyJargons})，必须替换为感官隐喻`, title: '幼崽视角科技术语未降维' });
                hints.push(`【🚨科技术语检测 - 幼崽视角违规】发现${termResult.violationCount}处幼崽视角中的科技术语：${babyJargons}。幼崽视角必须替换为感官隐喻`);
                if (adultJargons) hints.push(`【ℹ️科技术语提示 - 成人语境合理】成人角色语境中的术语(${adultJargons})使用合理，无需降维`);
            }

            const slangResult = detectors.modernSlang(content, styleProfile);
            if (slangResult.count > 0) {
                hardBlockIssues.push({ severity: 'critical', description: `年代语言污染：发现${slangResult.count}处网络用语/网文腔(${slangResult.instances.slice(0, 3).map(s => s.match).join('、')})，必须替换为符合年代背景的表达`, title: '年代语言污染' });
            }

            if (qualityChecks.onomatopoeia.enabled) {
                const onoResult = detectors.onomatopoeia(content, styleProfile);
                if (onoResult.issues.length > 0) {
                    const onoIssue = onoResult.issues[0];
                    warningIssues.push({ severity: onoIssue.severity, description: `拟声词密度：${onoIssue.desc}（当前${onoResult.count}个，目标≥${qualityChecks.onomatopoeia.minCount}个）`, title: '拟声词密度不足' });
                }
            }

            if (qualityChecks.visualAnchors.enabled) {
                const vaResult = detectors.visualAnchors(content, styleProfile);
                if (vaResult.issues.length > 0) {
                    const vaIssue = vaResult.issues[0];
                    warningIssues.push({ severity: vaIssue.severity, description: `视觉锚点：${vaIssue.desc}（当前${vaResult.count}处，目标≥${qualityChecks.visualAnchors.minCount}处）`, title: '视觉锚点不足' });
                }
            }

            if (qualityChecks.motherChildDialogue.enabled) {
                const mcResult = detectors.motherChildDialogue(content, styleProfile);
                if (mcResult.issues.length > 0) {
                    const mcIssue = mcResult.issues[0];
                    warningIssues.push({ severity: mcIssue.severity, description: `母子对话：${mcIssue.desc}（当前${mcResult.count}处，目标≥${qualityChecks.motherChildDialogue.minCount}处）`, title: '母子对话不足' });
                }
            }

            return { hardBlockIssues, warningIssues, hints };
        },

        secondReview(content, styleProfile, context) {
            const hardBlockIssues = [];

            const termResult = detectors.terminology(content, styleProfile);
            if (termResult.violationCount > 0) {
                const babyJargons = termResult.instances.filter(j => !j.allowable).slice(0, 5).map(j => `"${j.match}"(${j.perspective}视角)→"${j.suggestion}"`).join('、');
                const adultJargons = termResult.instances.filter(j => j.allowable).map(j => `"${j.match}"(成人语境,合理)`).join('、');
                let desc = `复审通过但系统检测到幼崽视角科技术语未降维：发现${termResult.violationCount}处(${babyJargons})，必须替换为感官隐喻`;
                if (adultJargons) desc += `。注：成人语境中的术语(${adultJargons})使用合理，无需修改`;
                hardBlockIssues.push({ severity: 'critical', description: desc, title: '幼崽视角科技术语未降维(系统HARD BLOCK)' });
            }

            return { hardBlockIssues, warningIssues: [], hints: [] };
        }
    };
