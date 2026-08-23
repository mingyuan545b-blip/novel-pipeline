/**
 * 约束传递链路一致性校验脚本
 * 防止视角违规反复打回问题再次出现
 *
 * SOP校验逻辑链：
 * 1. 大纲/意图层有没有视角约束？（styleProfile.povRule）
 * 2. 执笔有没有收到povRule？（writer的slots包含style-profile）
 * 3. 审核员有没有收到povRule？（review的slots包含style-profile + user prompt有povSection）
 * 4. 审核员依据的约束和执笔收到的约束是否一致？（povRule来源统一）
 *
 * 用法：node scripts/verifyConstraintChain.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');

let errorCount = 0;
let warnCount = 0;

function error(msg) {
    console.error(`[ERROR] ${msg}`);
    errorCount++;
}

function warn(msg) {
    console.warn(`[WARN]  ${msg}`);
    warnCount++;
}

function ok(msg) {
    console.log(`[OK]    ${msg}`);
}

function readFile(relPath) {
    const fullPath = path.join(SERVER, relPath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath, 'utf8');
}

/** 校验1：所有题材的styleProfile.povRule是否存在 */
function checkAllGenresPovRule() {
    console.log('\n=== 校验1：所有题材的styleProfile.povRule ===');
    const genresDir = path.join(SERVER, 'services', 'genres');
    const genres = fs.readdirSync(genresDir).filter(d => {
        const stat = fs.statSync(path.join(genresDir, d));
        return stat.isDirectory() && !d.startsWith('.');
    });

    for (const genre of genres) {
        const stylePath = path.join(genresDir, genre, 'styleProfile.js');
        if (!fs.existsSync(stylePath)) {
            warn(`题材 ${genre} 没有 styleProfile.js`);
            continue;
        }
        const content = fs.readFileSync(stylePath, 'utf8');
        if (!content.includes('povRule')) {
            warn(`题材 ${genre} 的 styleProfile.js 没有定义 povRule`);
        } else {
            ok(`题材 ${genre} 的 povRule 已定义`);
        }
    }
}

/** 校验2：writer的slots是否包含style-profile */
function checkWriterSlots() {
    console.log('\n=== 校验2：writer的slots是否包含style-profile ===');
    const content = readFile('services/prompts/agentJobTemplates.js');
    if (!content) { error('无法读取 agentJobTemplates.js'); return; }

    const writerMatch = content.match(/'writer':\s*\{[^}]*slots:\s*\[([^\]]*)\]/s);
    if (!writerMatch) { error('无法找到 writer 的 slots 定义'); return; }

    if (writerMatch[1].includes("'style-profile'")) {
        ok('writer 的 slots 包含 style-profile');
    } else {
        error('writer 的 slots 不包含 style-profile — 执笔将收不到 povRule！');
    }
}

/** 校验3：所有审核员的slots是否包含style-profile */
function checkReviewSlots() {
    console.log('\n=== 校验3：所有审核员的slots是否包含style-profile ===');
    const content = readFile('services/prompts/agentJobTemplates.js');
    if (!content) { error('无法读取 agentJobTemplates.js'); return; }

    const reviewAgents = ['first-review', 'second-review', 'fast-review', 'final-editor'];
    for (const agent of reviewAgents) {
        const regex = new RegExp(`'${agent}':\\s*\\{[^}]*slots:\\s*\\[([^\\]]*)\\]`, 's');
        const match = content.match(regex);
        if (!match) { error(`无法找到 ${agent} 的 slots 定义`); continue; }

        if (match[1].includes("'style-profile'")) {
            ok(`${agent} 的 slots 包含 style-profile`);
        } else {
            error(`${agent} 的 slots 不包含 style-profile — 审核员将收不到 povRule！`);
        }
    }
}

/** 校验4：所有审核员的user prompt是否包含povSection */
function checkReviewPovSection() {
    console.log('\n=== 校验4：所有审核员的user prompt是否包含povSection ===');
    const reviewFiles = [
        'services/pipeline/steps/review/firstReview.js',
        'services/pipeline/steps/review/secondReview.js',
        'services/pipeline/steps/review/fastReview.js',
        'services/pipeline/steps/finalEditor.js',
    ];

    for (const relPath of reviewFiles) {
        const content = readFile(relPath);
        if (!content) { error(`无法读取 ${relPath}`); continue; }

        const fileName = path.basename(relPath);
        if (content.includes('PovSection') || content.includes('povSection') || content.includes('_fePovSection')) {
            ok(`${fileName} 包含 povSection 注入`);
        } else {
            error(`${fileName} 不包含 povSection 注入 — 审核员user prompt缺少povRule明确引用！`);
        }
    }
}

/** 校验5：final-editor的perspectiveRule来源是否正确 */
function checkFinalEditorPerspectiveSource() {
    console.log('\n=== 校验5：final-editor的perspectiveRule来源 ===');
    const content = readFile('services/pipeline/steps/finalEditor.js');
    if (!content) { error('无法读取 finalEditor.js'); return; }

    // 检查是否优先使用 styleProfile.povRule
    if (content.includes('_feStyleProfile.povRule') || content.includes('styleProfile?.povRule')) {
        ok('final-editor 优先使用 styleProfile.povRule');
    } else {
        error('final-editor 没有优先使用 styleProfile.povRule — 可能导致perspectiveRule为空！');
    }

    // 检查是否还有旧的 getGenreReviewRules 单独来源
    if (content.includes("getGenreReviewRules(resolveGenreFromProject(_feProject))?.finalEditor?.perspectiveRule") &&
        !content.includes('_feStyleProfile.povRule')) {
        error('final-editor 仍然单独依赖 getGenreReviewRules — 甜宠等无reviewRules的题材会perspectiveRule为空！');
    }
}

/** 校验6：限知约束段措辞（迁移到characterSectionBuilders.js后）
 *  Phase 3将限知约束措辞从reviewShared.js迁移到characterSectionBuilders.js的buildKnowledgeAccessSection
 *  此校验确保迁移后措辞仍存在且完整 */
function checkReviewSharedKnowledgeAccess() {
    console.log('\n=== 校验6：限知约束段措辞（characterSectionBuilders.js） ===');

    // 检查characterSectionBuilders.js是否包含"视角切换本身不是违规"
    const charBuildersContent = readFile('services/pipeline/characterSectionBuilders.js');
    if (!charBuildersContent) {
        error('无法读取 characterSectionBuilders.js — 限知约束段构建函数丢失！');
        return;
    }

    if (charBuildersContent.includes('视角切换本身不是违规')) {
        ok('characterSectionBuilders.js 包含"视角切换本身不是违规"明确说明');
    } else {
        error('characterSectionBuilders.js 缺少"视角切换本身不是违规"明确说明 — 审核员可能误判视角切换为违规！');
    }

    // 检查reviewShared.js是否还残留旧的"叙事视角是否无意泄露"措辞
    const reviewSharedContent = readFile('services/pipeline/steps/review/reviewShared.js');
    if (reviewSharedContent && reviewSharedContent.includes('叙事视角是否无意泄露')) {
        error('reviewShared.js 仍包含"叙事视角是否无意泄露"旧措辞 — 会导致审核员误判！');
    } else {
        ok('reviewShared.js 已移除"叙事视角是否无意泄露"旧措辞');
    }

    // 检查reviewShared.js是否正确调用buildKnowledgeAccessSection
    if (reviewSharedContent && reviewSharedContent.includes('buildKnowledgeAccessSection')) {
        ok('reviewShared.js 调用 buildKnowledgeAccessSection 统一构建限知约束段');
    } else {
        error('reviewShared.js 未调用 buildKnowledgeAccessSection — 限知约束段可能自己拼装！');
    }
}

/** 校验7：constraintDedupe.js的character-consistency覆盖检查 */
function checkCharacterConsistencyDedupe() {
    console.log('\n=== 校验7：character-consistency约束去重检查 ===');
    const content = readFile('services/prompts/constraintDedupe.js');
    if (!content) { error('无法读取 constraintDedupe.js'); return; }

    // 检查character-consistency的keywords是否会导致误去重
    const ccMatch = content.match(/'character-consistency':\s*\{[^}]*keywords:\s*\[([^\]]*)\]/s);
    if (ccMatch) {
        const keywords = ccMatch[1];
        if (keywords.includes("'角色'") && keywords.includes("'称呼'")) {
            warn('character-consistency 的去重keywords包含"角色/称呼" — 可能被povRule/dialogueRule误覆盖');
        }
    }
}

/** 校验8：constraintInjector.js的character-consistency描述 */
function checkCharacterConsistencyDesc() {
    console.log('\n=== 校验8：character-consistency约束描述 ===');
    const content = readFile('services/prompts/constraintInjector.js');
    if (!content) { error('无法读取 constraintInjector.js'); return; }

    if (content.includes('越权行为视为OOC崩坏')) {
        ok('character-consistency 约束包含"越权行为视为OOC崩坏"明确说明');
    } else {
        warn('character-consistency 约束缺少"越权行为"明确说明 — OOC问题可能反复出现');
    }
}

// 主函数
function main() {
    console.log('========================================');
    console.log('约束传递链路一致性校验');
    console.log('========================================');

    checkAllGenresPovRule();
    checkWriterSlots();
    checkReviewSlots();
    checkReviewPovSection();
    checkFinalEditorPerspectiveSource();
    checkReviewSharedKnowledgeAccess();
    checkCharacterConsistencyDedupe();
    checkCharacterConsistencyDesc();

    console.log('\n========================================');
    console.log(`校验完成: ${errorCount} errors, ${warnCount} warnings`);
    console.log('========================================');

    if (errorCount > 0) {
        console.error('\n❌ 校验失败 — 约束传递链路存在断裂点！');
        process.exit(1);
    } else {
        console.log('\n✅ 校验通过 — 约束传递链路一致性正常');
        process.exit(0);
    }
}

main();
