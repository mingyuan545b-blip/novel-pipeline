/**
 * entityWriteGateWiring — 验证工艺门禁**真的接在唯一写入点**（不是只在纯函数里成立）
 *
 * M1 根因：设计期解析/素材管理员增量绕过校验直写实体。门禁必须在
 * entityCRUD.updateEntity / getOrCreateEntity 上生效，否则等于没接。
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(), setItem: jest.fn(), queryItems: jest.fn(),
    deleteItem: jest.fn(), listItems: jest.fn(), updateItem: jest.fn()
}));

const store = require('../../server/store');
const { updateEntity } = require('../../server/services/entityCenter/entityCRUD');

const baseEntity = () => ({
    id: 'char-1', projectId: 'p1', entityType: 'character', name: '陆行舟',
    roleLevel: 'protagonist', genreId: null, version: 1, data: {},
    quoteLibrary: [], highlightScenes: [], catchphrases: [],
    charisma: '', philosophy: '', entranceDesign: '', tags: [],
    briefText: '', summaryText: '', detailText: '', profile: {}, genreState: {}
});

describe('craftWriteGate 接线（entityCRUD.updateEntity）', () => {
    beforeEach(() => jest.clearAllMocks());

    test('不合格工艺字段不落库，其余字段正常写入', async () => {
        store.getItem.mockResolvedValue(baseEntity());
        store.setItem.mockResolvedValue(true);

        await updateEntity('char-1', {
            roleLevel: 'key-supporting',
            quoteLibrary: [{ scene: '通用场景', quote: '面对新人：“路就在脚下”', why: '记忆点：强调理性' }],
            catchphrases: ['清理完毕。'],
            charisma: '智勇双全、游走灰色地带',
        });

        const written = store.setItem.mock.calls.find(c => c[0] === "entities")[2];
        expect(written.roleLevel).toBe('key-supporting');
        expect(written.quoteLibrary).toEqual([]);
        expect(written.catchphrases).toEqual([]);
        expect(written.charisma).toBe('');
    });

    test('合格工艺字段正常落库', async () => {
        store.getItem.mockResolvedValue(baseEntity());
        store.setItem.mockResolvedValue(true);

        const goodQuote = { scene: '对账时发现有人做假账', quote: '这笔账不平', why: '因为他把账当命根子，所以宁可掀桌也不放过一笔糊涂账' };
        await updateEntity('char-1', { quoteLibrary: [goodQuote] });

        const written = store.setItem.mock.calls.find(c => c[0] === "entities")[2];
        expect(written.quoteLibrary).toHaveLength(1);
        expect(written.quoteLibrary[0].quote).toBe('这笔账不平');
    });
});
