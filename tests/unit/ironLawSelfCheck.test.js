/**
 * 铁律 --self-check 回归（E5）
 *
 * 修复前：判定要求 core.hooksPath === prepare 目标，未认 husky 9 的 `<dir>/_` 委托布局，
 * 仓库恒报"钩子翻转风险" exit 1 —— 而 CLAUDE.md 要求改规则前先跑它（狼来了）。
 * 修复后：接受 husky 委托布局，并改为**实质判定**（钩子链 pre-commit 必须真实存在）。
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');

function selfCheck() {
    return spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'audit-iron-law.js'), '--self-check'], {
        cwd: ROOT, encoding: 'utf8', timeout: 60000
    });
}

describe('audit-iron-law --self-check', () => {
    test('不得再误报"钩子翻转风险"，且自检通过（exit 0）', () => {
        const out = selfCheck();
        const text = `${out.stdout}${out.stderr}`;
        expect(text).not.toContain('钩子翻转风险');
        expect(text).not.toContain('场景ID重复');
        expect(text).not.toContain('非法动作');
        expect(out.status).toBe(0);
    });

    test('钩子链是实质存在的（pre-commit 可执行入口）', () => {
        const hooksPath = spawnSync('git', ['config', 'core.hooksPath'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
        expect(hooksPath).toBeTruthy();
        expect(fs.existsSync(path.join(ROOT, hooksPath, 'pre-commit'))).toBe(true);
    });
});
