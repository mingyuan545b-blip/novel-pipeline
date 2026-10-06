/**
 * normalizeWorldScopeRefs.js — 归一已有 world-scopes 的世界引用（名称→项目配置 id）
 *
 * 用法: node scripts/normalizeWorldScopeRefs.js [projectId] [--apply]
 * 默认干跑。修复 #17（世界名↔id 未归一）对**存量**数据的影响。
 */
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: true });
const store = require('../server/store');
const { resolveWorldRef } = require('../server/services/worldRefResolve');
const { getProjectWorlds } = require('../server/services/worldScopeCrud');

async function main() {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const pidArg = args.find(a => !a.startsWith('--'));
    await store.ensureBackend();
    const projects = pidArg ? [{ id: pidArg }] : await store.queryItems('projects', {});
    let total = 0, changed = 0;
    for (const proj of projects) {
        const worlds = await getProjectWorlds(proj.id);
        const rows = await store.queryItems('world-scopes', { projectId: proj.id });
        for (const r of rows) {
            total++;
            const before = r.worldId;
            let after = before;
            if (r.type === 'entity-scope' || r.type === 'world-info') {
                after = resolveWorldRef(r.worldId && r.worldId !== 'main-world' ? r.worldId : (r.worldName || r.worldId), worlds);
            }
            if (r.type === 'transition') {
                const f = resolveWorldRef(r.fromWorld, worlds), t = resolveWorldRef(r.toWorld, worlds);
                if (f !== r.fromWorld || t !== r.toWorld) {
                    if (apply) { r.fromWorld = f; r.toWorld = t; r.updatedAt = new Date().toISOString(); await store.setItem('world-scopes', r.id, r); }
                    changed++; continue;
                }
            }
            if (after !== before) {
                if (apply) { r.worldId = after; r.updatedAt = new Date().toISOString(); await store.setItem('world-scopes', r.id, r); }
                changed++;
            }
        }
    }
    console.log(`${apply ? '[APPLY]' : '[DRY-RUN]'} 扫描 ${total} 条，可归一 ${changed} 条`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
