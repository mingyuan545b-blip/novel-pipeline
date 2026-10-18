/**
 * 门禁"数据侧覆盖"回归（G14 / E2c）
 *
 * 修复前：S2/W4 只读 data/projects/*.json（PG 化后为空），恒报「0 个项目」并打 ✅ —— 空绿。
 * 修复后：读不到数据必须**显式**报"未被覆盖"，且不得输出 ✅。
 * 说明：用子进程跑，避免依赖当前进程是否已连 PG（CI 无 PG 也能跑）。
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function runVerifier(relScript, env) {
    return spawnSync(process.execPath, [path.join(ROOT, relScript)], {
        cwd: ROOT,
        env: { ...process.env, ...env },
        encoding: 'utf8',
        timeout: 120000,
    });
}

describe.each([
    ['scripts/verifyStyleProfileSchema.js', 'S2'],
    ['scripts/verifyWordConfigSchema.js', 'W4'],
])('%s 的数据侧覆盖', (script, tag) => {
    test(`${tag}: 无数据源时必须显式声明未被覆盖，且不得打 ✅`, () => {
        const out = runVerifier(script, { USE_PG: 'false', DATABASE_URL: '' });
        const text = `${out.stdout}${out.stderr}`;
        expect(text).toContain(`${tag}:`);
        expect(text).toContain('未被覆盖');
        expect(text).not.toMatch(/✅ 数据源=/);
    });
});
