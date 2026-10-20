/**
 * failopenSites — fail-open（只 log 不处理）站点的抽取与判定
 *
 * 背景（R4/G1）：`audit-failopen.js` 原来只做**全仓计数**（257 / pipeline 141）并与基线比"不上升"。
 * 计数口径有两个盲区：
 *   1) 新增一处 fail-open 只要别处少一处，计数就不再上升 → 抓不到；
 *   2) 无法表达"这一处降级是否可接受"。
 * 本模块把口径下沉到**站点（file:line + 代码片段）**，并支持**声明式降级**：
 *   在 catch 前后一行写 `// DEGRADE: 影响=… 可见性=…` 即视为"已声明"。
 * 配合基线站点清单：新站点未声明 = ERROR（源头拦截）；存量未声明 = WARN（待收敛）。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const BS = String.fromCharCode(92);
const CATCH_LINE = new RegExp('catch' + BS + 's*' + BS + '(');
const FAILOPEN_RE = new RegExp(
    'catch' + BS + 's*' + BS + '([^)]*' + BS + ')' + BS + 's*' + BS + '{'
    + '[^}]*logger' + BS + '.' + '(warn|debug)[^}]*' + BS + '}'
);
const DEGRADE_MARK = 'DEGRADE:';

function listJsFiles(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) listJsFiles(full, out);
        else if (entry.name.endsWith('.js')) out.push(full);
    }
    return out;
}

/** 抽取所有 fail-open 站点：{ file, line, snippet, declared } */
function collectSites(serverDir) {
    const sites = [];
    for (const f of listJsFiles(serverDir)) {
        const lines = fs.readFileSync(f, 'utf8').split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (!FAILOPEN_RE.test(lines[i])) continue;
            const rel = path.relative(path.dirname(serverDir), f).split(path.sep).join('/');
            // "已声明"：本行或上一行含 DEGRADE 标记
            const declared = lines[i].includes(DEGRADE_MARK) || (lines[i - 1] || '').includes(DEGRADE_MARK);
            sites.push({ file: rel, line: i + 1, snippet: lines[i].trim().slice(0, 120), declared });
        }
    }
    return sites;
}

const siteKey = (s) => `${s.file}:${s.line}`;

module.exports = { collectSites, siteKey, CATCH_LINE, FAILOPEN_RE, DEGRADE_MARK };
