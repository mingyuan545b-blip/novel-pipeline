/**
 * worldScopeModule 关键路径测试
 * 覆盖：世界颜色、项目世界配置、串台检测
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    queryItems: jest.fn()
}));

jest.mock('../../server/services/entityCenter', () => ({
    getEntitiesForProject: jest.fn(() => Promise.resolve([]))
}));

jest.mock('../../server/services/worldScopeExtractor', () => ({
    extractWorldScopeFromChapter: jest.fn()
}));

const store = require('../../server/store');
const worldScopeModule = require('../../server/services/worldScopeModule');

describe('worldScopeModule - getProjectWorlds', () => {
    beforeEach(() => jest.clearAllMocks());

    test('项目有自定义世界配置时返回配置', async () => {
        store.getItem.mockResolvedValue({
            id: 'proj-1',
            settings: {
                worlds: [
                    { id: 'main-world', name: '主世界', type: 'main', color: '#00c8ff', isDefault: true },
                    { id: 'dungeon-1', name: '幽暗地牢', type: 'sub', color: '#a29bfe' }
                ]
            }
        });

        const worlds = await worldScopeModule.getProjectWorlds('proj-1');
        expect(worlds).toHaveLength(2);
        expect(worlds[1].name).toBe('幽暗地牢');
    });

    test('项目无世界配置时返回默认主世界', async () => {
        store.getItem.mockResolvedValue({ id: 'proj-1', settings: {} });

        const worlds = await worldScopeModule.getProjectWorlds('proj-1');
        expect(worlds).toHaveLength(1);
        expect(worlds[0].id).toBe('main-world');
        expect(worlds[0].isDefault).toBe(true);
    });

    test('项目不存在时返回默认主世界', async () => {
        store.getItem.mockResolvedValue(null);

        const worlds = await worldScopeModule.getProjectWorlds('nonexistent');
        expect(worlds).toHaveLength(1);
        expect(worlds[0].id).toBe('main-world');
    });
});

describe('worldScopeModule - saveProjectWorlds', () => {
    beforeEach(() => jest.clearAllMocks());

    test('保存世界配置到项目settings', async () => {
        store.getItem.mockResolvedValue({ id: 'proj-1', settings: {} });
        store.setItem.mockResolvedValue(true);

        const newWorlds = [
            { id: 'main-world', name: '主世界', type: 'main', color: '#00c8ff', isDefault: true },
            { id: 'dream-1', name: '梦境', type: 'dream', color: '#ff6b9d' }
        ];

        const result = await worldScopeModule.saveProjectWorlds('proj-1', newWorlds);
        expect(store.setItem).toHaveBeenCalledWith('projects', 'proj-1',
            expect.objectContaining({
                settings: expect.objectContaining({ worlds: newWorlds })
            })
        );
    });

    test('项目不存在时不保存', async () => {
        store.getItem.mockResolvedValue(null);

        const result = await worldScopeModule.saveProjectWorlds('nonexistent', []);
        expect(store.setItem).not.toHaveBeenCalled();
    });
});

describe('worldScopeModule - extractAndSave', () => {
    const { extractWorldScopeFromChapter } = require('../../server/services/worldScopeExtractor');

    beforeEach(() => jest.clearAllMocks());

    test('无提取结果时直接返回', async () => {
        extractWorldScopeFromChapter.mockResolvedValue({
            entities: [], transitions: [], crossWorldViolations: []
        });

        const result = await worldScopeModule.extractAndSave('proj-1', 1, '内容', 'basic');
        expect(result.entities).toHaveLength(0);
    });
});
