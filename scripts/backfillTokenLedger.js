#!/usr/bin/env node
/**
 * backfillTokenLedger.js — 用历史执行日志回填 Token 账本
 *
 * 背景：Token 面板上线前的项目没有 token-ledger 记录，但 pipeline-logs 的每条
 * entries[].result 里已包含 usage（真实 token）与 contextReport（各提示词分段占用，
 * 含截断信息）。本脚本把它反规范化成账本记录，让历史项目立刻能看"token 去哪了"。
 *
 * 用法：
 *   node scripts/backfillTokenLedger.js                     # 干跑（默认，只统计不写）
 *   node scripts/backfillTokenLedger.js --apply             # 实际写入
 *   node scripts/backfillTokenLedger.js --project <id> --apply
 *   node scripts/backfillTokenLedger.js --json
 *
 * 幂等：记录 id 由日志内容派生，重复执行不会产生重复账本。
 */
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const AS_JSON = argv.includes('--json');
const pIdx = argv.indexOf('--project');
const PROJECT_ID = pIdx >= 0 ? argv[pIdx + 1] : null;

function deterministicId(projectId, chKey, step, round, seed) {
    const h = crypto.createHash('md5').update(String(seed)).digest('hex').substring(0, 10);
    return `${projectId}_${chKey}_${step}_r${round || 1}_bf${h}`;
}

(async () => {
    const { initPgPool } = require('../server/db/pgPool');
    await initPgPool(process.env.DATABASE_URL);

    const store = require('../server/store');
    const { LEDGER_STORE, chapterKey, normalizeUsage, extractPromptSections } = require('../server/services/pipeline/tokenLedger');

    const projects = PROJECT_ID
        ? [{ id: PROJECT_ID }]
        : (await store.queryItems('projects', {})).map(p => ({ id: p.id }));

    const summary = { projects: 0, scanned: 0, created: 0, skipped: 0 };
    const details = [];

    for (const project of projects) {
        const logs = await store.queryItems('pipeline-logs', { projectId: project.id });
        if (!logs.length) continue;
        summary.projects += 1;
        const existing = new Set((await store.queryItems(LEDGER_STORE, { projectId: project.id })).map(r => r.id));
        let created = 0, skipped = 0;

        for (const log of logs) {
            let logData = log;
            if (typeof logData.entries === 'string') { try { logData = JSON.parse(logData.entries); } catch { continue; } }
            const entries = Array.isArray(logData.entries) ? logData.entries : [];
            for (let i = 0; i < entries.length; i++) {
                const e = entries[i];
                const result = e.result || {};
                if (!e.step || !result.usage || !result.usage.total_tokens) continue;
                summary.scanned += 1;
                const chapter = e.chapterNumber || 0;
                const id = deterministicId(project.id, chapterKey(chapter), e.step, e.round, `${log.id}|${e.timestamp}|${e.step}|${e.round}|${i}`);
                if (existing.has(id)) { skipped++; continue; }
                if (APPLY) {
                    const sections = extractPromptSections(result.contextReport);
                    await store.setItem(LEDGER_STORE, id, {
                        id,
                        projectId: project.id,
                        chapter,
                        chapterKey: chapterKey(chapter),
                        step: e.step,
                        round: e.round ?? null,
                        runRound: e.runRound ?? null,
                        model: result.contextReport?.model || null,
                        usage: normalizeUsage(result.usage),
                        promptSections: sections,
                        truncatedSlots: sections.filter(s => s.wasTruncated)
                            .map(s => ({ slot: s.slot, tokens: s.tokens, originalTokens: s.originalTokens, lostTokens: s.lostTokens })),
                        budget: result.contextReport ? {
                            totalBudget: result.contextReport.totalBudget || 0,
                            inputBudget: result.contextReport.inputBudget || 0,
                            outputReserve: result.contextReport.outputReserve || 0,
                            allocated: result.contextReport.allocated || 0,
                            utilization: result.contextReport.utilization || null,
                        } : null,
                        outputChars: (result.response || '').length,
                        backfilled: true,
                        recordedAt: e.timestamp || new Date().toISOString(),
                    });
                }
                created++;
            }
        }
        summary.created += created;
        summary.skipped += skipped;
        details.push({ projectId: project.id, logs: logs.length, created, skipped });
    }

    if (AS_JSON) { console.log(JSON.stringify({ apply: APPLY, summary, details }, null, 2)); return; }
    console.log(`=== Token 账本回填${APPLY ? '' : '（干跑，加 --apply 才写入）'} ===`);
    for (const d of details) {
        console.log(`  ${d.projectId.slice(0, 8)}…  日志${d.logs}份  新增${d.created}  已存在${d.skipped}`);
    }
    console.log(`  合计：项目${summary.projects} / 扫描条目${summary.scanned} / 新增${summary.created} / 跳过${summary.skipped}`);
})().catch(e => { console.error('回填失败:', e.message); process.exit(1); });
