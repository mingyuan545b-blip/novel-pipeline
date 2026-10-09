/**
 * kuaijieRegression.test.js — 2026-10-09「跨界副本博弈」建项会话根因修复的回归测试
 * 覆盖：契约/路径类静默失效（require 路径错、未导入函数、作用域 ReferenceError）+ 只查不写红线。
 * 依据：docs/worklog/2026-10-09-跨界副本博弈-新项目20章-问题溯源.md
 */
const fs = require('fs');
const path = require('path');

jest.mock('../../server/shared/logger', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('问题#1 大纲解析：outlineGenerator 必须导入并使用 parseJsonResponse（防回退）', () => {
    test('outlineGenerator.js 同时 require 与调用 parseJsonResponse', () => {
        const src = read('server/services/pipeline/outlineGenerator.js');
        expect(src).toMatch(/require\(['"]\.\/outlineResponseParser['"]\)/);
        expect(src).toMatch(/\{\s*[^}]*parseJsonResponse[^}]*\}\s*=\s*require\(['"]\.\/outlineResponseParser['"]\)/);
        expect(src).toMatch(/parseJsonResponse\(responseText\)/);
    });
    test('parseJsonResponse 能解析 ```json 代码块数组', () => {
        const { parseJsonResponse } = require('../../server/services/pipeline/outlineResponseParser');
        const arr = parseJsonResponse('```json\n[{"chapterNumber":1,"title":"t","outline":"o"}]\n```');
        expect(Array.isArray(arr)).toBe(true);
        expect(arr[0].chapterNumber).toBe(1);
    });
});

describe('问题#6 深度漂移校验：require 路径必须指向 pipeline/materialDepthEnforcer（防回退）', () => {
    test('pipelineDepthDriftCheck.js 使用 ../materialDepthEnforcer', () => {
        const src = read('server/services/pipeline/pipelineHelpers/pipelineDepthDriftCheck.js');
        expect(src).toMatch(/require\(['"]\.\.\/materialDepthEnforcer['"]\)/);
        expect(src).not.toMatch(/require\(['"]\.\.\/\.\.\/materialDepthEnforcer['"]\)/);
    });
    test('目标模块真实存在且导出 enforceChapterDrift', () => {
        const mod = require('../../server/services/pipeline/materialDepthEnforcer');
        expect(typeof mod.enforceChapterDrift).toBe('function');
    });
});

describe('问题#10 first-review：relationshipStageGuard require 路径（防回退）', () => {
    test('firstReviewParser.js 使用 ../../relationshipStageGuard（不是 ../../../）', () => {
        const src = read('server/services/pipeline/steps/review/firstReviewParser.js');
        expect(src).toMatch(/require\(['"]\.\.\/\.\.\/relationshipStageGuard['"]\)/);
        expect(src).not.toMatch(/require\(['"]\.\.\/\.\.\/\.\.\/relationshipStageGuard['"]\)/);
    });
});

describe('问题#7 战力一致性：有规则素材时 checkPowerConsistency 不应抛错', () => {
    test('存在 power-system 素材且含规则 → 返回数组而非 ReferenceError', async () => {
        jest.resetModules();
        jest.doMock('../../server/store', () => ({
            queryItems: jest.fn(async (coll) => {
                if (coll === 'materials') return [
                    { id: 'ps1', projectId: 'p1', type: 'power-system', name: '等级体系', currentContent: '铁律：禁止凭空升级，等级提升需积累经验值。' }
                ];
                return [];
            })
        }));
        jest.doMock('../../server/services/stateSnapshot', () => ({
            getSnapshot: jest.fn(async () => ({ characterStates: {} }))
        }));
        const eng = require('../../server/services/consistencyEngine');
        const res = await eng.checkPowerConsistency('p1', 2, '齐越按下了F7键，等级没有变化。');
        expect(Array.isArray(res)).toBe(true);
    });
});

describe('问题#9 只查不写：写作红线构建器必须声明元叙事章回引用红线', () => {
    test('buildWritingGuardSection 含「元叙事章回引用」段，且导出 buildMetaNarrativeSection', () => {
        const mod = require('../../server/services/pipeline/writingGuardSectionBuilder');
        expect(typeof mod.buildMetaNarrativeSection).toBe('function');
        const section = mod.buildWritingGuardSection();
        expect(section).toContain('元叙事章回引用');
        expect(section).toMatch(/上一章|前一章|第X章/);
    });
});

describe('问题#12 存储层形状不变量必须"总是"生效（不能只在超限时）', () => {
    test('storeCommon.trimItemData 对"未超限"的素材也要补 provenance', () => {
        const { trimItemData } = require('../../server/db/storeCommon');
        const small = { id: 'x', type: 'other', name: '小素材', currentContent: '短内容', changeLog: [], createdAt: new Date().toISOString() };
        trimItemData('materials', small);
        expect(small.provenance).toBeTruthy();
        expect(typeof small.provenance.createdAt).toBe('string');
        const { checkMaterialShape } = require('../../server/config/materialShape');
        expect(checkMaterialShape(small).ok).toBe(true);
    });
    test('storeTrim.trimItemData（JSON后端）与 storeCommon 行为一致', () => {
        const a = require('../../server/db/storeCommon');
        const b = require('../../server/db/storeTrim');
        const mk = () => ({ id: 'x', type: 'other', name: '小素材', currentContent: '短内容', changeLog: [], createdAt: new Date().toISOString() });
        const o1 = mk(); a.trimItemData('materials', o1);
        const o2 = mk(); b.trimItemData('materials', o2);
        expect(Boolean(o1.provenance)).toBe(Boolean(o2.provenance));
        expect(Boolean(o1.provenance)).toBe(true);
    });
});
