'use strict';

/**
 * genreConfig.js 覆盖率补测（P1-2）
 * 覆盖：分支缓存机制（72-80）、clearBranchCache（90）、getGenrePlugin Proxy（100-112）、validateNewMaterial（127-146）
 */

jest.mock('../../server/services/genreLoader', () => ({
    getRegistry: jest.fn(),
    getMap: jest.fn(),
    reloadGenres: jest.fn(),
    getGenreDir: jest.fn()
}));

jest.mock('../../server/services/rulesLoader', () => ({
    getGenreRules: jest.fn()
}));

jest.mock('../../server/shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
}));

const { getRegistry, getMap } = require('../../server/services/genreLoader');
const rulesLoader = require('../../server/services/rulesLoader');
const logger = require('../../server/shared/logger');
const gc = require('../../server/services/genreConfig');

const applyBranch = jest.fn();
const MOCK_GENRE = {
    id: 'branch-genre',
    label: '分支题材',
    genreProfileIds: [],
    isMatch: () => false,
    branches: { applyBranch }
};

beforeEach(() => {
    jest.clearAllMocks();
    getRegistry.mockReturnValue([MOCK_GENRE]);
    getMap.mockReturnValue({ 'branch-genre': MOCK_GENRE });
    gc.clearBranchCache();
});

describe('genreConfig.resolveGenreFromProject - 分支机制', () => {
    test('无 branchKey 时直接返回基础题材', () => {
        const result = gc.resolveGenreFromProject({ subGenre: 'branch-genre' });
        expect(result).toBe(MOCK_GENRE);
        expect(applyBranch).not.toHaveBeenCalled();
    });

    test('branchKey 有效时应用分支并命中缓存', () => {
        const branched = { id: 'branch-genre', branchKey: 'dark' };
        applyBranch.mockReturnValue(branched);
        const project = { subGenre: 'branch-genre', branchKey: 'dark' };

        const first = gc.resolveGenreFromProject(project);
        const second = gc.resolveGenreFromProject(project);

        expect(first).toBe(branched);
        expect(second).toBe(branched);
        expect(applyBranch).toHaveBeenCalledTimes(1); // 第二次命中缓存，不重复深拷贝
    });

    test('applyBranch 抛错时降级返回基础题材并告警', () => {
        applyBranch.mockImplementation(() => { throw new Error('branch broken'); });
        const result = gc.resolveGenreFromProject({ subGenre: 'branch-genre', branchKey: 'bad' });
        expect(result).toBe(MOCK_GENRE);
        expect(logger.warn).toHaveBeenCalled();
    });

    test('clearBranchCache 清缓存后重新应用分支', () => {
        const branched = { id: 'branch-genre', branchKey: 'dark' };
        applyBranch.mockReturnValue(branched);
        const project = { subGenre: 'branch-genre', branchKey: 'dark' };

        gc.resolveGenreFromProject(project);
        gc.clearBranchCache();
        gc.resolveGenreFromProject(project);

        expect(applyBranch).toHaveBeenCalledTimes(2);
    });

    test('有 branchKey 但题材无 branches 配置时返回基础题材', () => {
        const plain = { id: 'branch-genre', isMatch: () => false };
        getMap.mockReturnValue({ 'branch-genre': plain });
        getRegistry.mockReturnValue([plain]);
        const result = gc.resolveGenreFromProject({ subGenre: 'branch-genre', branchKey: 'dark' });
        expect(result).toBe(plain);
        expect(applyBranch).not.toHaveBeenCalled();
    });
});

describe('genreConfig.getGenrePlugin - Proxy 覆盖路径', () => {
    test('dataRules 存在时六类字段被覆盖，其余透传', () => {
        rulesLoader.getGenreRules.mockReturnValue({
            reviewRules: { overridden: true },
            foundation: { depth: 'deep' },
            constraintPresets: { extra: 1 },
            dedupRules: { threshold: 0.9 },
            materialTemplates: { character: 'tpl' },
            newContentValidation: { strict: true }
        });
        const plugin = gc.getGenrePlugin({ key: 'branch-genre' });
        expect(plugin.reviewRules).toEqual({ overridden: true });
        expect(plugin.foundation).toMatchObject({ depth: 'deep' });
        expect(plugin.constraintPresets).toMatchObject({ extra: 1 });
        expect(plugin.dedupRules).toEqual({ threshold: 0.9 });
        expect(plugin.materialTemplates).toEqual({ character: 'tpl' });
        expect(plugin.newContentValidation).toMatchObject({ strict: true });
        expect(plugin.label).toBe('分支题材'); // 未覆盖字段透传
    });

    test('dataRules 部分存在时未覆盖字段透传原值', () => {
        rulesLoader.getGenreRules.mockReturnValue({ reviewRules: { only: true } });
        const plugin = gc.getGenrePlugin({ key: 'branch-genre' });
        expect(plugin.reviewRules).toEqual({ only: true });
        expect(plugin.foundation).toBe(MOCK_GENRE.foundation);
    });

    test('dataRules 为空时返回原题材', () => {
        rulesLoader.getGenreRules.mockReturnValue(null);
        const plugin = gc.getGenrePlugin({ key: 'branch-genre' });
        expect(plugin).toBe(MOCK_GENRE);
    });

    test('rulesLoader 抛错时降级返回原题材并告警', () => {
        rulesLoader.getGenreRules.mockImplementation(() => { throw new Error('loader broken'); });
        const plugin = gc.getGenrePlugin({ key: 'branch-genre' });
        expect(plugin).toBe(MOCK_GENRE);
        expect(logger.warn).toHaveBeenCalled();
    });
});

describe('genreConfig.validateNewMaterial - 双签名与错误收集', () => {
    test('签名1(type,name,content)：合法素材通过', () => {
        const result = gc.validateNewMaterial('character', '主角', '内容');
        expect(result).toEqual({ valid: true, reason: '', errors: [] });
    });

    test('签名1：类型空/类型无效/名称空/内容空分别报错', () => {
        expect(gc.validateNewMaterial('', '名', '内容').errors).toContain('素材类型不能为空');
        expect(gc.validateNewMaterial('unknown-type', '名', '内容').errors).toEqual(['无效素材类型: unknown-type']);
        expect(gc.validateNewMaterial('character', '  ', '内容').reason).toBe('素材名称不能为空');
        expect(gc.validateNewMaterial('character', '名', ' ').valid).toBe(false);
    });

    test('签名2(materialObj)：读取 currentContent/initialContent', () => {
        expect(gc.validateNewMaterial({ type: 'character', name: '主角', currentContent: '内容' }).valid).toBe(true);
        expect(gc.validateNewMaterial({ type: 'character', name: '主角', initialContent: '内容' }).valid).toBe(true);
        const bad = gc.validateNewMaterial({});
        expect(bad.valid).toBe(false);
        expect(bad.errors.length).toBe(3);
        expect(bad.reason).toBe('素材类型不能为空');
    });
});
