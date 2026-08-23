/**
 * baby/detectorsExtra1.js
 */
const perspective = require('./perspectiveConfig');
const { qualityChecks } = require('./qualityChecks');
const config = require('./config');
const techJargon = config.techJargon;

module.exports = {
terminology(content, styleProfile) {
            if (!content) return { count: 0, instances: [], violationCount: 0 };

            const p = perspective;
            const jargonTerms = techJargon.terms;

            const ADULT_CONTEXT_MARKERS = p.adultViewMarkers;
            const ADULT_CONTEXT_REGEX = new RegExp(ADULT_CONTEXT_MARKERS.join('|'));
            const BABY_VIEW_MARKERS = p.babyViewMarkers;
            const BABY_VIEW_REGEX = new RegExp(BABY_VIEW_MARKERS.join('|'));

            const paragraphs = content.split(/\n\n+/);
            const paragraphContexts = paragraphs.map(para => {
                if (ADULT_CONTEXT_REGEX.test(para) && !BABY_VIEW_REGEX.test(para)) return 'adult';
                if (BABY_VIEW_REGEX.test(para) && !ADULT_CONTEXT_REGEX.test(para)) return 'baby';
                if (ADULT_CONTEXT_REGEX.test(para) && BABY_VIEW_REGEX.test(para)) return 'mixed';
                return 'unknown';
            });

            const GENRE_SPECIFIC_JARGON = jargonTerms.map(t => ({
                pattern: new RegExp(t.term, 'g'),
                type: '题材术语',
                suggestion: t.suggestion
            }));

            const instances = [];
            let violationCount = 0;

            let charOffset = 0;
            for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
                const para = paragraphs[pIdx];
                const context = paragraphContexts[pIdx];

                for (const { pattern, type, suggestion } of GENRE_SPECIFIC_JARGON) {
                    const regex = new RegExp(pattern.source, 'g');
                    let match;
                    while ((match = regex.exec(para)) !== null) {
                        const globalPos = charOffset + match.index;
                        const matchStart = Math.max(0, match.index - 60);
                        const matchEnd = Math.min(para.length, match.index + match[0].length + 60);
                        const sentenceContext = para.substring(matchStart, matchEnd);
                        const isNearAdult = ADULT_CONTEXT_REGEX.test(sentenceContext);
                        const isNearBaby = BABY_VIEW_REGEX.test(sentenceContext);
                        const isAllowable = isNearAdult && !isNearBaby;

                        if (isAllowable) {
                            instances.push({
                                match: match[0], type, suggestion, position: globalPos,
                                perspective: 'adult', allowable: true,
                                note: '成人角色语境中术语使用合理，无需降维'
                            });
                        } else if (isNearAdult && isNearBaby) {
                            instances.push({
                                match: match[0], type, suggestion, position: globalPos,
                                perspective: 'mixed', allowable: false,
                                note: '混合视角段落中题材术语需确认是否在幼崽感知范围内'
                            });
                            violationCount++;
                        } else {
                            instances.push({
                                match: match[0], type, suggestion, position: globalPos,
                                perspective: isNearBaby ? 'baby' : 'unknown', allowable: false,
                                note: '幼崽视角中题材术语必须降维为感官隐喻'
                            });
                            violationCount++;
                        }
                    }
                }
                charOffset += para.length + 2;
            }

            return { count: instances.length, instances: instances.slice(0, 20), violationCount };
        },

onomatopoeia(content, styleProfile) {
            if (!content) return { count: 0, density: 0, issues: [] };

            const config = qualityChecks.onomatopoeia;
            const ONOMATOPOEIA = /沙沙|咕噜|吧唧|滴答|呼哧|咔嗒|噗|嗡嗡|叮咚|嗒嗒|嘶嘶|嘭|哧|吱呀|扑通|咕嘟|窸窣|哗啦|嘎吱|嗖|咚|啪|叮当|淅沥|呼啦|咕咕|叽叽|喳喳|喵|汪|咩|哼哧|咕咚|噼啪|嗒啦|窸窣|沙啦啦|呼噜噜|叮铃铃|淅沥沥|咕噜噜/g;
            const matches = content.match(ONOMATOPOEIA) || [];
            const count = matches.length;
            const charCount = content.replace(/\s/g, '').length;
            const density = charCount > 0 ? (count / charCount * 10000) : 0;

            const issues = [];
            if (count < config.levels.high) {
                issues.push({ desc: `拟声词严重不足（${count}个<${config.levels.high}个），需系统性补入`, severity: 'high' });
            } else if (count < config.levels.medium) {
                issues.push({ desc: `拟声词偏少（${count}个<${config.levels.medium}个），建议补入至≥${config.levels.low}个`, severity: 'medium' });
            } else if (count < config.levels.low) {
                issues.push({ desc: `拟声词略少（${count}个<${config.levels.low}个），建议适当补入`, severity: 'low' });
            }

            return { count, density: density.toFixed(2), issues, found: [...new Set(matches)] };
        },

visualAnchors(content, styleProfile) {
            if (!content) return { count: 0, issues: [] };

            const config = qualityChecks.visualAnchors;
            const VISUAL_PATTERNS = [
                /(?:看(到|见|着)|映入|映出|浮现|望(着|过|来|去|上|成|下|起|着|出|过|着)|折射|反射)/,
                /(?:颜色|色彩|红|橙|黄|绿|蓝|紫|白|黑|灰|金|银|粉|青|碧|褐)/,
                /(?:光(影|线|芒|晕|圈|点|束|子|像|斑|光|点|斑|影|处|斑)|折射|反射)/,
                /(?:圆|方|尖|扁|弯|曲|直|螺旋|锯齿|弧|棱角)/,
                /(?:飘|飞|旋|转|晃|摇|闪|跳|蹦|流|涌|散|落)/
            ];

            const paragraphs = content.split(/\n\n+/);
            let visualCount = 0;
            const visualParagraphs = [];
            for (let i = 0; i < paragraphs.length; i++) {
                const para = paragraphs[i];
                let hasVisual = false;
                for (const pattern of VISUAL_PATTERNS) {
                    if (pattern.test(para)) { hasVisual = true; break; }
                }
                if (hasVisual) { visualCount++; visualParagraphs.push(i); }
            }

            const issues = [];
            if (visualCount < config.levels.high) {
                issues.push({ desc: `视觉锚点严重不足（${visualCount}处<${config.levels.high}处），触觉描写可能独大`, severity: 'high' });
            } else if (visualCount < config.levels.medium) {
                issues.push({ desc: `视觉锚点偏少（${visualCount}处<${config.levels.medium}处），建议增加视觉画面描写`, severity: 'medium' });
            }

            return { count: visualCount, totalParagraphs: paragraphs.length, issues, visualParagraphs };
        },

motherChildDialogue(content, styleProfile) {
            if (!content) return { count: 0, issues: [] };

            const config = qualityChecks.motherChildDialogue;
            const MOTHER_NAMES = /妈妈|妈咪|母亲|林晚|林晚阿姨/;
            const CHILD_NAMES = /小满|团团|宝宝|萌宝|小豆丁/;
            const DIALOGUE_REGEX = /[\u201c\u201d\u0022\u300c\u300d\u300e\u300f]([^\u201c\u201d\u0022\u300c\u300d\u300e\u300f]+)[\u201c\u201d\u0022\u300c\u300d\u300e\u300f]/g;
            const DIALOGUE_TEST = /[\u201c\u201d\u0022\u300c\u300d\u300e\u300f]([^\u201c\u201d\u0022\u300c\u300d\u300e\u300f]+)[\u201c\u201d\u0022\u300c\u300d\u300e\u300f]/;

            const dialogues = [];
            let m;
            while ((m = DIALOGUE_REGEX.exec(content)) !== null) dialogues.push(m[1]);

            const paragraphs = content.split(/\n\n+/);
            let motherChildCount = 0;
            const mcParagraphs = [];
            for (let i = 0; i < paragraphs.length; i++) {
                const para = paragraphs[i];
                const hasMother = MOTHER_NAMES.test(para);
                const hasChild = CHILD_NAMES.test(para);
                const hasDialogue = DIALOGUE_TEST.test(para);
                if (hasDialogue && (hasMother || hasChild)) {
                    const nearbyText = para + (paragraphs[i + 1] || '');
                    if ((hasMother && hasChild) || (hasMother && CHILD_NAMES.test(nearbyText)) || (hasChild && MOTHER_NAMES.test(nearbyText))) {
                        motherChildCount++;
                        mcParagraphs.push(i);
                    }
                }
            }

            const issues = [];
            if (motherChildCount === 0) {
                issues.push({ desc: '全章无母子对话，建议添加2-3句幼崽与母亲直接对话', severity: 'high' });
            } else if (motherChildCount < config.levels.medium) {
                issues.push({ desc: `母子对话偏少（${motherChildCount}处<${config.levels.medium}处），建议增加`, severity: 'medium' });
            }

            return { count: motherChildCount, totalDialogues: dialogues.length, issues, mcParagraphs };
        },

};
