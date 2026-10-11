#!/usr/bin/env node
/**
 * 词汇表一致性闸门（P2-A）
 * 根治"消费端各自维护词汇表 → 漂移 → 点状打补丁"的结构性缺陷。
 *
 * 本闸门当前覆盖（后续步骤继续扩展）：
 *   #4 章节状态：代码写入的 status ⊆ chapterStatus.ALL_STATUSES
 *      4a statusMap / *statusMap* 对象字面量的值
 *      4b 章节流程范围内 `.status = '字面量'` 的赋值
 *      4c 状态机迁移表引用（VALID_TRANSITIONS）
 *      4d 前端生成常量与后端单一源一致（chapterStatusConstants.js）
 *      4e 前端状态展示表 CHAPTER_STATUS_META 的键
 * 用法：node scripts/audit-vocabulary-consistency.js [--json] [--warn]
 *   默认有违规 exit 1；--warn 只提示不失败。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const status = require('../server/services/chapterStatus');
const { VALID_TRANSITIONS, ALL_STATUSES } = status;

const ROOT = path.join(__dirname, '..');
const VALID = new Set(ALL_STATUSES);

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p, out);
        else if (p.endsWith('.js') && !p.includes('.test.') && !p.includes('/__tests__/')) out.push(p);
    }
    return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// ---- 4a: statusMap 值 ----
/** 纯函数：抽取 statusMap 对象字面量的"值"（键是步骤名，不算状态） */
function extractStatusMapValues(src) {
    const out = [];
    const re = /\b\w*statusMap\w*\s*[:=]\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(src))) {
        out.push(...[...m[1].matchAll(/:\s*['"]([a-z][a-z0-9-]*)['"]/g)].map(x => x[1]));
    }
    return out;
}

function checkStatusMap() {
    const v = [];
    const files = [...walk(path.join(ROOT, 'server')), ...walk(path.join(ROOT, 'client', 'src'))];
    for (const f of files) {
        for (const val of extractStatusMapValues(fs.readFileSync(f, 'utf8'))) {
            if (!VALID.has(val)) v.push({ check: '4a', file: rel(f), detail: `statusMap 值 "${val}" 不在 ALL_STATUSES` });
        }
    }
    return v;
}

// ---- 4b: 章节流程范围内 .status = '字面量' ----
const CHAPTER_SCOPES = ['server/core/pipeline', 'server/services/pipeline', 'server/services/chapterStateMachine.js'];
function checkChapterStatusAssignments() {
    const v = [];
    for (const scope of CHAPTER_SCOPES) {
        const p = path.join(ROOT, scope);
        const files = fs.existsSync(p) && fs.statSync(p).isDirectory() ? walk(p) : (fs.existsSync(p) ? [p] : []);
        for (const f of files) {
            const src = fs.readFileSync(f, 'utf8');
            const re = /\.status\s*=\s*['"]([a-z][a-z0-9-]*)['"]/g;
            let m;
            while ((m = re.exec(src))) {
                if (!VALID.has(m[1])) v.push({ check: '4b', file: rel(f), detail: `.status 赋值 "${m[1]}" 不在 ALL_STATUSES` });
            }
        }
    }
    return v;
}

// ---- 4c: 迁移表引用 ----
function checkStateMachineRefs() {
    const v = [];
    for (const [from, tos] of Object.entries(VALID_TRANSITIONS)) {
        if (!VALID.has(from)) v.push({ check: '4c', file: 'server/services/chapterStatus.js', detail: `迁移表 from "${from}" 非法` });
        for (const to of tos) if (!VALID.has(to)) v.push({ check: '4c', file: 'server/services/chapterStatus.js', detail: `迁移表 to "${to}" 非法` });
    }
    return v;
}

// ---- 4d: 前端生成常量同步 ----
function checkClientConstantsSync() {
    try {
        execFileSync('node', [path.join(__dirname, 'generateChapterStatusConstants.js'), '--check'], { stdio: 'pipe' });
        return [];
    } catch (e) {
        return [{ check: '4d', file: 'client/src/shared/chapterStatusConstants.js', detail: '与后端单一源不一致（运行 node scripts/generateChapterStatusConstants.js）' }];
    }
}

// ---- 4e: 前端状态展示表键 ----
const CLIENT_STATUS_MAP_FILES = ['client/src/pages/progress/progressConstants.js'];
function checkClientStatusMaps() {
    const v = [];
    for (const rf of CLIENT_STATUS_MAP_FILES) {
        const f = path.join(ROOT, rf);
        if (!fs.existsSync(f)) continue;
        const src = fs.readFileSync(f, 'utf8');
        const re = /CHAPTER_STATUS_META\s*=\s*\{([\s\S]*?)\n\};/g;
        let m;
        while ((m = re.exec(src))) {
            const keys = [...m[1].matchAll(/^\s*['"]?([a-z][a-z0-9-]*)['"]?\s*:/gm)].map(x => x[1]);
            for (const k of keys) if (!VALID.has(k)) v.push({ check: '4e', file: rf, detail: `状态键 "${k}" 不在 ALL_STATUSES` });
        }
    }
    return v;
}

// ---- 5: 契约 @ref 引用可解析（深度键单一源，防 7 份手抄漂移） ----
function walkYamlStrings(node, cb) {
    if (typeof node === 'string') return cb(node);
    if (Array.isArray(node)) return node.forEach(n => walkYamlStrings(n, cb));
    if (node && typeof node === 'object') return Object.values(node).forEach(v => walkYamlStrings(v, cb));
}
function checkContractRefs() {
    const v = [];
    const yaml = require('js-yaml');
    const { resolveRef } = require('../server/services/pipeline/contracts/_registry');
    const dir = path.join(ROOT, 'server', 'services', 'pipeline', 'contracts');
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.contract.yml'))) {
        let doc;
        try { doc = yaml.load(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { v.push({ check: '5', file: f, detail: `YAML 解析失败: ${e.message}` }); continue; }
        walkYamlStrings(doc, (s) => {
            if (s.startsWith('@')) {
                const resolved = resolveRef(s);
                if (!Array.isArray(resolved) || resolved.length === 0) v.push({ check: '5', file: f, detail: `引用 "${s}" 无法解析` });
            }
            if (s === 'innerConflict') v.push({ check: '5', file: f, detail: '深度键应引用 "@characterDepthKeys"，禁止手写字面量' });
        });
    }
    return v;
}

// ========== R1 字段词汇表（生成端/校验端/提取端/落点 对齐） ==========

// ---- 1: 校验端 requiredFields 必须被生成端 prompt tags 覆盖 ----
function checkPromptCoverage() {
    const v = [];
    const registry = require('../server/config/fieldRegistry');
    for (const [role, depth] of Object.entries(registry.ROLE_LEVEL_TO_DEPTH)) {
        const required = registry.requiredLabels('character', depth);
        const advertised = new Set(registry.promptFieldTags(role).map(t => (t.match(/【([^】]+)】/) || [])[1]));
        for (const label of required) {
            if (!advertised.has(label)) v.push({ check: '1', file: 'server/config/fieldRegistry.js', detail: `角色${role}(${depth}) 必填【${label}】未进入生成端 prompt tags` });
        }
    }
    // 非角色类型：必填标签必须已在 FIELD_SPECS 注册（词汇表已知）
    for (const [type, depths] of Object.entries(registry.DEPTH_REQUIREMENTS)) {
        for (const [depth, req] of Object.entries(depths)) {
            for (const label of req.requiredFields || []) {
                if (!registry.FIELD_SPECS[label]) v.push({ check: '1', file: 'server/config/materialDepthSpec.js', detail: `${type}/${depth} 必填【${label}】未在 FIELD_SPECS 注册` });
            }
        }
    }
    return v;
}

// ---- 2: 校验标签必须能被提取正则命中（读写同口径） ----
// 金句库由 characterStateExtractor 单独提取（多句多场景），不在单行 LABELED_PATTERNS 内
const EXTRACT_ELSEWHERE = new Set(['金句库']);
function checkExtractionCoverage() {
    const v = [];
    const registry = require('../server/config/fieldRegistry');
    const { extractLabeledFields } = require('../server/services/pipeline/characterStateLabeledFields');
    for (const [label] of Object.entries(registry.FIELD_MAPPINGS)) {
        const probe = `【${label}】示例内容文本若干`;
        const extracted = Object.keys(extractLabeledFields(probe)).length > 0;
        if (!extracted && !EXTRACT_ELSEWHERE.has(label)) {
            v.push({ check: '2', file: 'server/services/pipeline/characterStateLabeledFields.js', detail: `校验标签【${label}】无法被提取正则命中` });
        }
        // 别名也必须可提取（否则校验认、提取不认）
        if (EXTRACT_ELSEWHERE.has(label)) continue;
        for (const alias of registry.FIELD_ALIASES[label] || []) {
            if (Object.keys(extractLabeledFields(`【${alias}】示例内容文本若干`)).length === 0) {
                v.push({ check: '2', file: 'server/services/pipeline/characterStateLabeledFields.js', detail: `字段【${label}】别名「${alias}」无法被提取正则命中` });
            }
        }
    }
    return v;
}

// ---- 3: 落点映射三方齐全（entityKey/stateJsonKey；pgColumn 若给出必须是真实列） ----
function checkFieldMappings() {
    const v = [];
    const registry = require('../server/config/fieldRegistry');
    const entitySchema = require('../server/db/fieldRegistryEntity');
    const entityColumns = new Set(Object.keys(entitySchema.entities.columns));
    for (const [label, map] of Object.entries(registry.FIELD_MAPPINGS)) {
        if (!map.entityKey || !map.stateJsonKey) v.push({ check: '3', file: 'server/config/fieldRegistry.js', detail: `字段【${label}】缺少 entityKey/stateJsonKey` });
        if (map.pgColumn && !entityColumns.has(map.pgColumn)) v.push({ check: '3', file: 'server/db/fieldRegistryEntity.js', detail: `字段【${label}】pgColumn "${map.pgColumn}" 不是 entities 表真实列` });
    }
    return v;
}

// ---- 6: dataFlowSpec 与真实步骤比对（规范不得漂移） ----
function checkDataFlowSpec() {
    const v = [];
    const { DATA_FLOW_SPEC, KNOWN_STEP_KEYS } = require('../server/services/pipeline/dataFlowSpec');
    const known = new Set(KNOWN_STEP_KEYS);
    let registered = [];
    try { registered = require('../server/core/pipeline/steps/StepRegistry').getMigratedSteps(); } catch (_) { registered = []; }
    // 契约 STEP_ORDER 也是权威步骤来源（intent-planner/consistency-constraint 等未必在 StepRegistry）
    let contractOrder = [];
    try { contractOrder = require('../server/services/pipeline/pipelineContractDefs').PIPELINE_CONTRACT.STEP_ORDER || []; } catch (_) { contractOrder = []; }
    // 权威步骤集 = KNOWN_STEP_KEYS ∪ StepRegistry 已迁移 ∪ 契约 STEP_ORDER。
    // 根因修复 2026-10-11：此前只校验 registered（已迁移步骤），未迁移步骤不在集合内 → 规范缺条目不报警。
    const authoritative = new Set([...known, ...registered, ...contractOrder]);
    for (const step of authoritative) {
        if (!known.has(step)) v.push({ check: '6', file: 'dataFlowSpec.js', detail: `真实步骤 "${step}" 未登记 KNOWN_STEP_KEYS` });
        if (!DATA_FLOW_SPEC[step]) v.push({ check: '6', file: 'dataFlowSpec.js', detail: `真实步骤 "${step}" 缺少数据流规范条目` });
    }
    for (const [step, spec] of Object.entries(DATA_FLOW_SPEC)) {
        if (!known.has(step)) v.push({ check: '6', file: 'dataFlowSpec.js', detail: `规范含未知步骤 "${step}"` });
        for (const d of spec.downstream || []) {
            if (!known.has(d)) v.push({ check: '6', file: 'dataFlowSpec.js', detail: `${step}.downstream 指向未知步骤 "${d}"` });
        }
    }
    return v;
}

const CHECKS = [checkStatusMap, checkChapterStatusAssignments, checkStateMachineRefs, checkClientConstantsSync, checkClientStatusMaps, checkContractRefs, checkPromptCoverage, checkExtractionCoverage, checkFieldMappings, checkDataFlowSpec];

function main() {
    const json = process.argv.includes('--json');
    const warn = process.argv.includes('--warn');
    let violations = [];
    for (const c of CHECKS) violations = violations.concat(c());
    if (json) { console.log(JSON.stringify({ ok: violations.length === 0, violations }, null, 2)); }
    else if (violations.length === 0) { console.log('✓ 词汇表一致性：0 违规（章节状态词汇表单一源）'); }
    else {
        console.error(`✗ 词汇表一致性：${violations.length} 处违规`);
        for (const x of violations) console.error(`  [${x.check}] ${x.file} — ${x.detail}`);
    }
    if (violations.length > 0 && !warn) process.exit(1);
}

if (require.main === module) main();
module.exports = {
    extractStatusMapValues, checkStatusMap, checkChapterStatusAssignments, checkStateMachineRefs,
    checkClientConstantsSync, checkClientStatusMaps, checkContractRefs,
    checkPromptCoverage, checkExtractionCoverage, checkFieldMappings, checkDataFlowSpec, CHECKS
};
