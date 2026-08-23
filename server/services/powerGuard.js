const logger = require('../shared/logger');
const store = require('../store');
const { POWER_LEVELS, LEVEL_MAP, _parsePowerString, _getLevelName } = require('./powerLevelMap');

const GUARD_CONFIG = {
    MAX_POWER_JUMP: 2,
    COOLDOWN_CHAPTERS: 3,
    ESCALATION_PATTERNS: ['突破', '晋级', '升阶', '实力大增', '修为精进', '境界提升', '战力飙升', '实力暴增'],
    DOWNGRADE_PATTERNS: ['修为尽失', '实力大减', '跌落', '退化', '封印', '削弱'],
    FORBIDDEN_PATTERNS: ['无敌', '天下第一', '最强', '无人能敌', '横扫一切']
};

function checkPowerConsistency(projectId, chapterNumber, content, characterStates) {
    const issues = [];
    if (!content || !characterStates) return issues;

    for (const [charId, state] of Object.entries(characterStates)) {
        const name = state.name || charId;
        const prevLevel = _parsePowerString(state.powerLevel || '');
        if (prevLevel === 0) continue;

        for (const pattern of GUARD_CONFIG.ESCALATION_PATTERNS) {
            const regex = new RegExp(`${name}[^。]*${pattern}`, 'g');
            const matches = content.match(regex);
            if (!matches) continue;

            for (const match of matches) {
                const jumpScore = _estimateJumpScore(match, pattern);
                const newLevel = prevLevel + jumpScore;
                const jumpLevels = Math.floor(jumpScore / 10);

                if (jumpLevels > GUARD_CONFIG.MAX_POWER_JUMP) {
                    issues.push({
                        type: 'power_escalation',
                        severity: 'critical',
                        character: name,
                        from: state.powerLevel,
                        to: _getLevelName(newLevel),
                        jumpLevels,
                        maxAllowed: GUARD_CONFIG.MAX_POWER_JUMP,
                        context: match.substring(0, 80),
                        suggestion: `${name}战力跨度过大(${jumpLevels}级)，建议分${Math.ceil(jumpLevels / GUARD_CONFIG.MAX_POWER_JUMP)}次突破`
                    });
                }

                const lastBreakthrough = state.lastBreakthroughChapter || 0;
                if (chapterNumber - lastBreakthrough < GUARD_CONFIG.COOLDOWN_CHAPTERS) {
                    issues.push({
                        type: 'power_cooldown_violation',
                        severity: 'warning',
                        character: name,
                        chaptersSinceLast: chapterNumber - lastBreakthrough,
                        cooldownRequired: GUARD_CONFIG.COOLDOWN_CHAPTERS,
                        suggestion: `${name}距离上次突破仅${chapterNumber - lastBreakthrough}章，建议间隔至少${GUARD_CONFIG.COOLDOWN_CHAPTERS}章`
                    });
                }
            }
        }

        for (const pattern of GUARD_CONFIG.DOWNGRADE_PATTERNS) {
            const regex = new RegExp(`${name}[^。]*${pattern}`, 'g');
            const matches = content.match(regex);
            if (matches) {
                issues.push({
                    type: 'power_downgrade',
                    severity: 'info',
                    character: name,
                    from: state.powerLevel,
                    context: matches[0].substring(0, 80),
                    suggestion: `${name}战力下降，注意后续章节是否需要恢复或解释`
                });
            }
        }

        for (const pattern of GUARD_CONFIG.FORBIDDEN_PATTERNS) {
            const regex = new RegExp(`${name}[^。]*${pattern}`, 'g');
            const matches = content.match(regex);
            if (matches) {
                issues.push({
                    type: 'power_forbidden',
                    severity: 'critical',
                    character: name,
                    context: matches[0].substring(0, 80),
                    suggestion: `${name}出现禁止的战力描述"${pattern}"，这违反了战力体系规则`
                });
            }
        }
    }

    return issues;
}

function _estimateJumpScore(match, pattern) {
    const jumpScores = {
        '突破': 10, '晋级': 10, '升阶': 10,
        '实力大增': 15, '修为精进': 10, '境界提升': 10,
        '战力飙升': 20, '实力暴增': 20
    };
    return jumpScores[pattern] || 10;
}

async function getPowerCurve(projectId) {
    const chapters = await store.queryItems('chapters', { projectId });
    const sorted = chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    const materials = await store.queryItems('materials', { projectId });
    const characters = materials.filter(m => m.type === 'character' && !m.archived);

    const curve = {};
    for (const ch of sorted) {
        if (!ch.content) continue;
        const chapterPowers = {};
        for (const char of characters) {
            const name = char.name;
            const regex = new RegExp(`${name}[^。]*(突破|晋级|升阶|实力大增|修为精进|境界提升|战力飙升|实力暴增)`, 'g');
            const matches = ch.content.match(regex);
            if (matches) {
                const currentLevel = _parsePowerString(char.currentContent || '');
                const jump = matches.length * 10;
                chapterPowers[name] = { level: currentLevel + jump, events: matches.length };
            }
        }
        if (Object.keys(chapterPowers).length > 0) {
            curve[ch.chapterNumber] = chapterPowers;
        }
    }
    return curve;
}

async function generatePowerCheckHint(projectId, chapterNumber) {
    const result = await checkPowerConsistency(projectId, chapterNumber);
    if (!result || !result.inconsistencies || result.inconsistencies.length === 0) return '';
    return `【战力一致性提示】${result.inconsistencies.map(i => i.description || i.message || String(i)).join('；')}`;
}

const _exports = { checkPowerConsistency, getPowerCurve, generatePowerCheckHint, GUARD_CONFIG, _parsePowerString, _getLevelName, POWER_LEVELS, LEVEL_MAP };
// 兼容 const { powerGuard } = require('./powerGuard') 解构导入
_exports.powerGuard = _exports;
module.exports = _exports;
