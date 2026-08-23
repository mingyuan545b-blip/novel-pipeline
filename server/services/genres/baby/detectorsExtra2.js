/**
 * baby/detectorsExtra2.js
 */
const perspective = require('./perspectiveConfig');
const { qualityChecks } = require('./qualityChecks');
const config = require('./config');
const techJargon = config.techJargon;

module.exports = {
modernSlang(content, styleProfile) {
            if (!content) return { count: 0, instances: [] };

            const INTERNET_SLANG = [
                { pattern: /尊嘟假嘟/g, type: '网络词' },
                { pattern: /抽象发言/g, type: '网络词' },
                { pattern: /这波啊这波/g, type: '网络词' },
                { pattern: /瞳孔地震/g, type: '网络词' },
                { pattern: /绝绝子/g, type: '网络词' },
                { pattern: /yyds/gi, type: '网络词' },
                { pattern: /破防了/g, type: '网络词' },
                { pattern: /emo了/g, type: '网络词' },
                { pattern: /蚌埠住了/g, type: '网络词' },
                { pattern: /绷不住了/g, type: '网络词' },
                { pattern: /细狗/g, type: '网络词' },
                { pattern: /摆烂/g, type: '网络词' },
                { pattern: /内卷/g, type: '网络词' },
                { pattern: /社死/g, type: '网络词' }
            ];

            const WEB_NOVEL_CLICHE = qualityChecks.modernSlangExtra ? [
                { pattern: /倒吸一口凉气/g, type: '网文腔' },
                { pattern: /瞳孔微缩/g, type: '网文腔' },
                { pattern: /降维打击/g, type: '网文腔' },
                { pattern: /杀意|煞星/g, type: '网文腔' },
                { pattern: /不禁倒吸/g, type: '网文腔' },
                { pattern: /嘴角微微上扬/g, type: '网文腔' },
                { pattern: /眼底闪过一/g, type: '网文腔' },
                { pattern: /冷笑一声/g, type: '网文腔' },
                { pattern: /嗤笑/g, type: '网文腔' }
            ] : [];

            const allPatterns = [...INTERNET_SLANG, ...WEB_NOVEL_CLICHE];
            const instances = [];
            for (const { pattern, type } of allPatterns) {
                const regex = new RegExp(pattern.source, 'g');
                let match;
                while ((match = regex.exec(content)) !== null) {
                    instances.push({ match: match[0], type, position: match.index });
                }
            }

            return { count: instances.length, instances: instances.slice(0, 15) };
        },

};
