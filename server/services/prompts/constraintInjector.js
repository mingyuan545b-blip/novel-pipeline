const store = require('../../store');
const { resolveGenreFromProject } = require('../genreConfig');
const { getGenreConstraintPresets } = require('../genreDetectorHelpers');
const logger = require('../../shared/logger');
const { getStyleProfileForProject } = require('./styleInjector');
const { CONSTRAINT_TIERS } = require('../../config/systemConfig');
const { getDataContext } = require('../dataContext');
const { dedupeConstraints, buildTierOutput, formatConstraintOutput } = require('./constraintDedupe');

const BASE_CONSTRAINT_PRESETS = {
    'pov-lock': { label: '视角锁定', desc: '严格遵守项目styleProfile.povRule中定义的视角规则。禁止上帝视角解说他人心理，禁止全知旁白，禁止数值化内心独白（如"胜算三成"）。所有信息必须通过当前视角角色的感官获取。' },
    'no-derailment': { label: '不降智', desc: '角色不得出现智商断崖式下降' },
    'character-consistency': { label: '角色定位一致', desc: '每个角色的职位、行动和说话方式必须符合自身定位。角色行为必须遵守其职位/身份/能力边界——非技术角色不得直接修改核心代码/系统架构，非决策角色不得擅自授权核心资源，非战斗角色不得展现超出设定的战斗力。越权行为视为OOC崩坏。' },
    'anti-tool-character': { label: '反工具人化', desc: '配角必须有独立动机、立场逻辑和行为模式，不能只为推动主角剧情而存在。每个出场配角至少展现1个独立于主角的特质（个人目标/情感/判断/反应）。禁止配角只说"是""好的""主人英明"等工具性台词' },
    'character-depth': { label: '人物立体刻画', desc: '人物必须具备：①独立动机（不是围绕主角转的卫星）②立场逻辑（有自己的利益考量和行为底线）③微表情习惯（至少1个可识别的小动作/语气特征）④性格弧光（允许随事件改变立场/态度）。禁止脸谱化（纯善/纯恶/纯忠/纯叛）' },
    'worldview-consistency': { label: '世界观一致', desc: '不出现与世界观无关的元素，所有设定必须自洽' },
    'hook-every-chapter': { label: '章末钩子', desc: '每章结尾必须设置悬念或钩子' },
    'fast-escalation': { label: '节奏递进', desc: '剧情必须持续升级', applicableGenres: ['high-martial-comedy'] },
    'reader-satisfaction': { label: '读者爽感', desc: '主角必须频繁获得成就感', applicableGenres: ['high-martial-comedy'] },
    'simple-readable-style': { label: '简单好读', desc: '句子短、段落短、节奏流畅。禁止长句堆砌和大段心理描写', applicableGenres: null },
    'face-slapping': { label: '打脸', desc: '主角必须通过实力打脸质疑者（仅适用于爽文/逆袭类题材）' },
    'power-fantasy': { label: '力量幻想', desc: '主角必须持续获得力量提升（仅适用于升级流题材）' }
};

async function getConstraintPresets(genre) {
    try {
        const presets = await store.listItems('constraint-presets');
        if (presets && presets.length > 0) {
            const map = {};
            for (const p of presets) {
                map[p.id] = { label: p.label, desc: p.desc };
            }
            return map;
        }
    } catch(_) { logger.warn('constraintInjector', '[SILENT-CATCH]', { value1: _.message || _ }); }  // DEGRADE: 影响=store.listItems 失败→本步跳过（业务继续，质量/可观测性下降） 可见性=仅日志(logger.warn)
    const result = { ...BASE_CONSTRAINT_PRESETS };
    if (genre) {
        const genrePresets = getGenreConstraintPresets(genre);
        Object.assign(result, genrePresets);
    }
    return result;
}

async function buildConstraintInjection(projectId, agentType = null) {
    const _ciCtx = await getDataContext(projectId);
    const project = await _ciCtx.getProject();
    if (!project) return '';

    const profile = await getStyleProfileForProject(projectId);
    const genre = resolveGenreFromProject(project);
    const CONSTRAINT_PRESETS = await getConstraintPresets(genre);
    const profileOverrides = (profile && profile.constraintOverrides) ? profile.constraintOverrides : [];
    const projectConstraints = project.constraints || [];
    const genreRequiredConstraints = (genre && genre.requiredConstraints) ? genre.requiredConstraints : [];
    let effectiveConstraints = [...new Set([...genreRequiredConstraints, ...projectConstraints, ...profileOverrides])];

    // SOP-1修复：项目styleProfile有povRule时，自动注入pov-lock约束（确保全链路视角锁定）
    const styleProfile = project.styleProfile || profile;
    if (styleProfile && styleProfile.povRule && !effectiveConstraints.includes('pov-lock')) {
        effectiveConstraints.push('pov-lock');
    }

    if (genre && genre.incompatibleConstraints && genre.incompatibleConstraints.length > 0) {
        const before = effectiveConstraints.length;
        effectiveConstraints = effectiveConstraints.filter(c => !genre.incompatibleConstraints.includes(c));
        const removed = before - effectiveConstraints.length;
        if (removed > 0) {
            const removedIds = projectConstraints.concat(profileOverrides).filter(c => genre.incompatibleConstraints.includes(c));
            logger.info('constraintInjector', '[AGENT-PROMPTS] Genre incompatible filter for project {projectId}: removed {removed} constraints ({value2})', { projectId, removed, value2: removedIds.join(', ') });
        }
    }

    if (agentType) {
        const { shouldApplyConstraint } = require('./constraintScopes');
        const genreConstraintIds = Object.keys(genre ? getGenreConstraintPresets(genre) : {});
        const before = effectiveConstraints.length;
        effectiveConstraints = effectiveConstraints.filter(id => shouldApplyConstraint(id, agentType, genreConstraintIds));
        const filtered = before - effectiveConstraints.length;
        if (filtered > 0) {
            logger.info('constraintInjector', '[AGENT-PROMPTS] Scope filter for {agentType}: removed {filtered} out-of-scope constraints', { agentType, filtered });
        }
    }

    if (!effectiveConstraints.length) return '';

    const genreConstraintPresets = genre ? getGenreConstraintPresets(genre) : {};
    const { dedupedConstraints, dedupedReasons } = dedupeConstraints(effectiveConstraints, profile, genreConstraintPresets);

    if (dedupedReasons.length > 0) {
        logger.info('constraintInjector', '[AGENT-PROMPTS] Constraint dedup for project {projectId}: skipped {value2}', { projectId, value2: dedupedReasons.join(', ') });
    }

    const { tier1Items, tier2Labels, tier3Labels } = buildTierOutput(dedupedConstraints, CONSTRAINT_PRESETS, genre, genreConstraintPresets);
    return formatConstraintOutput(tier1Items, tier2Labels, tier3Labels, agentType);
}

module.exports = {
    BASE_CONSTRAINT_PRESETS,
    getConstraintPresets,
    buildConstraintInjection
};
