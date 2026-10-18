'use strict';

/**
 * modelBakeoff.js — 模型写作对比评测（bake-off）
 *
 * 用同一写作任务对比候选模型在网文写作上的质量与成本，
 * 用项目自己的检测器（M1-M5元约束）打分，而不是拍脑袋选模型。
 *
 * 用法:
 *   node scripts/modelBakeoff.js --models qwen3.6-plus,qwen3.8-max
 *
 * 选项:
 *   --models a,b,c      候选模型列表，逗号分隔（必填）
 *   --provider X        LLM供应商（默认取env LLM_PROVIDER或aliyunCoding）
 *   --base-url URL      覆盖API地址（如token plan端点）
 *   --api-key-env NAME  从哪个环境变量读key（默认跟随供应商配置）
 *   --outline-file P    大纲文件路径（注入任务，缺省用内置样例任务）
 *   --max-tokens N      每模型最大输出（默认8192）
 *   --temperature T     默认0.8（writer档，见systemConfig AGENT_DEFAULTS）
 *   --words N           要求字数（默认3000，写入任务要求）
 *   --dry-run           只显示将使用的配置，不调用API
 *
 * 输出: 控制台对比表 + output/model-bakeoff-<时间戳>.json（含全文与指标）
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env'), override: true });

function parseArgs(argv) {
    const args = { maxTokens: 8192, temperature: 0.8, words: 3000 };
    for (let i = 2; i < argv.length; i++) {
        const k = argv[i];
        const next = argv[i + 1];
        if (k === '--models') { args.models = next.split(',').map(s => s.trim()).filter(Boolean); i++; }
        else if (k === '--provider') { args.provider = next; i++; }
        else if (k === '--base-url') { args.baseUrl = next; i++; }
        else if (k === '--api-key-env') { args.apiKeyEnv = next; i++; }
        else if (k === '--outline-file') { args.outlineFile = next; i++; }
        else if (k === '--max-tokens') { args.maxTokens = parseInt(next, 10); i++; }
        else if (k === '--temperature') { args.temperature = parseFloat(next); i++; }
        else if (k === '--words') { args.words = parseInt(next, 10); i++; }
        else if (k === '--dry-run') { args.dryRun = true; }
        else if (k === '--blind') { args.blind = true; }
        else if (k === '--seed') { args.seed = next; i++; }
    }
    return args;
}

function buildTaskPrompt(args) {
    let outline = null;
    if (args.outlineFile) {
        outline = fs.readFileSync(path.resolve(PROJECT_ROOT, args.outlineFile), 'utf8');
    }
    const system = '你是一位资深中文网文作家，擅长长篇连载。写作要求：' +
        '场景具体、动作连贯、对白有性格区分度；避免比喻替换式套话（仿佛/似乎+抽象名词堆砌）；' +
        '避免抽象抒情（时间静止/命运齿轮类）；配角必须有独立动机，不得只作应答工具。';
    const user = (outline ? ('【本章大纲】\n' + outline + '\n\n') : '') +
        '【任务】基于以上设定撰写正文一章，约' + args.words + '字。' +
        '要求：有明确的场景推进与至少一个冲突转折；结尾留钩子。直接输出正文，不要标题和解释。';
    return { system, user };
}

async function scoreContent(content) {
    const metrics = { chars: content.length, paragraphs: content.split(/\n+/).filter(p => p.trim()).length };
    // M1-M5元约束检测器（项目自有质量门禁，防御性调用：失败记n/a）
    try {
        const { runAllMetaConstraintDetections } = require(path.join(
            PROJECT_ROOT, 'server/services/prompts/constraintDetectionRegistry'));
        const results = await runAllMetaConstraintDetections({ content, prevContent: '' });
        metrics.metaConstraints = {};
        for (const [id, r] of Object.entries(results)) {
            metrics.metaConstraints[id] = {
                violated: !!r.violated,
                violations: Array.isArray(r.violations) ? r.violations.length : 0,
                reason: r.reason || null
            };
        }
    } catch (e) {
        metrics.metaConstraints = { error: e.message };
    }
    return metrics;
}

async function runOneModel(model, args, messages) {
    const { chat } = require(path.join(PROJECT_ROOT, 'server/services/llm.js'));
    const apiConfig = { model };
    if (args.provider) apiConfig.provider = args.provider;
    if (args.baseUrl) apiConfig.baseURL = args.baseUrl;
    if (args.apiKeyEnv) apiConfig.apiKey = process.env[args.apiKeyEnv] || '';

    const t0 = Date.now();
    let content = null;
    let usage = {};
    let error = null;
    try {
        const res = await chat(messages, {
            apiConfig,
            maxTokens: args.maxTokens,
            temperature: args.temperature,
            maxRetries: 1
        });
        content = res.choices && res.choices[0] && res.choices[0].message
            ? res.choices[0].message.content : null;
        usage = res.usage || {};
        if (!content) error = 'empty response';
    } catch (e) {
        error = e.message;
    }
    const elapsedMs = Date.now() - t0;

    const record = { model, elapsedMs, error, content, usage, metrics: null };
    if (content) record.metrics = await scoreContent(content);
    return record;
}

async function main() {
    const args = parseArgs(process.argv);
    if (!args.models || !args.models.length) {
        console.log('用法: node scripts/modelBakeoff.js --models 模型A,模型B [--provider X] ' +
            '[--base-url URL] [--api-key-env NAME] [--outline-file P] [--words N] [--dry-run] [--blind] [--seed S]');
        process.exit(1);
    }
    const { system, user } = buildTaskPrompt(args);
    const messages = [
        { role: 'system', content: system },
        { role: 'user', content: user }
    ];
    const providerNote = args.provider || process.env.LLM_PROVIDER || 'aliyunCoding';
    console.log('provider=' + providerNote +
        (args.baseUrl ? ' baseURL=' + args.baseUrl : ' baseURL=供应商默认') +
        ' maxTokens=' + args.maxTokens + ' temperature=' + args.temperature);

    if (args.dryRun) {
        console.log('[dry-run] 任务user prompt长度:', user.length, '字符；候选:', args.models.join(','));
        process.exit(0);
    }

    const results = [];
    for (const model of args.models) {
        console.log('\n>>> 测试模型: ' + model);
        const record = await runOneModel(model, args, messages);
        if (record.error) console.log('    失败: ' + record.error);
        else console.log('    完成: ' + record.metrics.chars + '字, ' + (record.elapsedMs / 1000).toFixed(1) + 's');
        results.push(record);
    }

    const { buildReport } = require(path.join(PROJECT_ROOT, 'server/services/bakeoffReport'));
    const rep = buildReport(results, { blind: args.blind, seed: args.seed || '' });
    console.log('\n===== 对比结果' + (args.blind ? '（双盲：仅显示代号）' : '') + ' =====');
    console.log(rep.tableLines.join('\n'));
    console.log('提示: violations=元约束检测命中总数（越低越好）；成本对比以tokens为准，单价请按套餐自行折算。');

    const outDir = path.join(PROJECT_ROOT, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outFile = path.join(outDir, 'model-bakeoff-' + stamp + '.json');
    fs.writeFileSync(outFile, JSON.stringify({
        at: new Date().toISOString(), blind: rep.report.blind,
        args: { ...args, apiKeyEnv: args.apiKeyEnv || null }, results: rep.report.results
    }, null, 2), 'utf8');
    console.log('\n完整报告(含全文): ' + path.relative(PROJECT_ROOT, outFile));
    if (rep.mapping) {
        const mapFile = path.join(outDir, 'model-bakeoff-' + stamp + '-mapping.json');
        fs.writeFileSync(mapFile, JSON.stringify(rep.mapping, null, 2), 'utf8');
        console.log('盲评映射(揭盲用，勿给评判者): ' + path.relative(PROJECT_ROOT, mapFile));
    }
}

main().catch(e => { console.error('bakeoff失败: ' + e.message); process.exit(1); });
