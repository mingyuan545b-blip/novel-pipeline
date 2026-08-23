/**
 * projectCreateVerify.js — 项目创建后自动验证
 * 检查styleProfile完整性、genre解析、PG持久化
 * 避免每次新建项目都手动发现API/URL/字段问题
 */
const store = require('../../store');
const { resolveGenreFromProject } = require('../../services/genreConfig');
const logger = require('../../shared/logger');

const STYLE_PROFILE_REQUIRED_FIELDS = [
    'povRule', 'dialogueRule', 'behaviorRule', 'toneRule', 'titleRule'
];

async function verifyProject(projectId) {
    const issues = [];

    // 1. PG持久化验证：写后立即读
    const saved = await store.getItem('projects', projectId);
    if (!saved) {
        issues.push({ level: 'critical', field: 'persistence', message: '项目创建后PG读取为空，持久化失败' });
        return { valid: false, issues };
    }

    // 2. genre解析验证
    const genre = resolveGenreFromProject(saved);
    if (!genre) {
        // Bug#3修复：用JSON.stringify避免null被模板字符串转为"null"字符串
        issues.push({ level: 'critical', field: 'genre', message: `genre解析失败: genre=${JSON.stringify(saved.genre)}, subGenre=${JSON.stringify(saved.subGenre)}` });
    } else if (!genre.id) {
        issues.push({ level: 'warning', field: 'genre', message: `genre解析结果缺少id: ${JSON.stringify(genre).substring(0, 100)}` });
    }

    // 3. styleProfile完整性验证
    const sp = saved.styleProfile;
    if (!sp) {
        issues.push({ level: 'critical', field: 'styleProfile', message: 'styleProfile为null' });
    } else {
        for (const field of STYLE_PROFILE_REQUIRED_FIELDS) {
            if (!sp[field] && sp[field] !== '') {
                issues.push({ level: 'warning', field: `styleProfile.${field}`, message: `styleProfile.${field}缺失` });
            }
        }
        if (!sp.povRule) {
            issues.push({ level: 'critical', field: 'styleProfile.povRule', message: 'povRule为空，视角约束将无法注入' });
        }
    }

    // 4. subGenre验证
    if (!saved.subGenre && genre) {
        issues.push({ level: 'warning', field: 'subGenre', message: `subGenre为空，已自动解析为"${genre.id}"` });
    }

    // 5. mode验证
    if (saved.mode !== 'novel') {
        issues.push({ level: 'warning', field: 'mode', message: `mode="${saved.mode}"，系统仅支持novel模式` });
    }

    const valid = issues.filter(i => i.level === 'critical').length === 0;
    if (issues.length > 0) {
        const level = valid ? 'warn' : 'error';
        logger[level]('projectVerify', `项目${projectId}验证发现${issues.length}个问题: ${issues.map(i => `[${i.level}]${i.field}: ${i.message}`).join('; ')}`);
    }

    return { valid, issues };
}

module.exports = { verifyProject, STYLE_PROFILE_REQUIRED_FIELDS };
