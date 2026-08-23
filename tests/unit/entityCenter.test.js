/**
 * entityCenter tests - 角色实体中心
 */
jest.mock('../../server/store', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    deleteItem: jest.fn(),
    queryItems: jest.fn(),
    listItems: jest.fn(),
    updateItem: jest.fn()
}));

const store = require('../../server/store');
const entityCenter = require('../../server/services/entityCenter');

describe('entityCenter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('saveStateSnapshot', () => {
        it('should return null if entity not found', async () => {
            store.getItem.mockResolvedValue(null);
            const result = await entityCenter.saveStateSnapshot('e1', 1, {}, []);
            expect(result).toBeNull();
        });

        it('should create snapshot for entity with delta', async () => {
            const entity = {
                id: 'e1', projectId: 'p1', hp: 100, combatPower: 50,
                position: '京城', factionName: '天机阁', personality: '沉稳',
                speakingTone: '温和', signatureDetail: '剑眉',
                genreState: { level: '筑基' }, bindsSummary: ['绑定1'],
                relationsSummary: ['关系1'], briefText: '简介', summaryText: '摘要',
                detailText: '详情', behaviorRules: '规则1'
            };
            store.getItem.mockImplementation(async (type, id) => {
                if (type === 'entities') return entity;
                return null;
            });
            store.setItem.mockResolvedValue({ id: 'snap-e1-ch1' });

            const result = await entityCenter.saveStateSnapshot('e1', 1, { level: '金丹' }, ['level']);
            expect(store.setItem).toHaveBeenCalled();
            expect(result.id).toBe('snap-e1-ch1');
        });

        it('should skip snapshot if no changes from previous', async () => {
            const entity = {
                id: 'e1', projectId: 'p1', hp: 100, genreState: {},
                bindsSummary: [], relationsSummary: [], briefText: '',
                summaryText: '', detailText: '', behaviorRules: 'rule1'
            };
            const prevSnapshot = {
                id: 'snap-e1-ch1', data: { behaviorRules: 'rule1' }
            };
            store.getItem.mockImplementation(async (type, id) => {
                if (type === 'entities') return entity;
                if (type === 'entity-state-history') return prevSnapshot;
                return null;
            });

            const result = await entityCenter.saveStateSnapshot('e1', 1, {}, []);
            expect(result.id).toBe('snap-e1-ch1');
            expect(store.setItem).not.toHaveBeenCalled();
        });
    });

    describe('getStateSnapshot', () => {
        it('should retrieve snapshot by entityId and chapterNumber', async () => {
            const snapshot = { id: 'snap-e1-ch3', entityId: 'e1', chapterNumber: 3 };
            store.getItem.mockResolvedValue(snapshot);

            const result = await entityCenter.getStateSnapshot('e1', 3);
            expect(store.getItem).toHaveBeenCalledWith('entity-state-history', 'snap-e1-ch3');
            expect(result.chapterNumber).toBe(3);
        });
    });

    describe('getLatestSnapshot', () => {
        it('should return null when no snapshots exist', async () => {
            store.queryItems.mockResolvedValue([]);
            const result = await entityCenter.getLatestSnapshot('e1');
            expect(result).toBeNull();
        });

        it('should return the latest snapshot by chapterNumber', async () => {
            const snapshots = [
                { entityId: 'e1', chapterNumber: 1, isValid: true },
                { entityId: 'e1', chapterNumber: 5, isValid: true },
                { entityId: 'e1', chapterNumber: 3, isValid: true }
            ];
            store.queryItems.mockResolvedValue(snapshots);
            const result = await entityCenter.getLatestSnapshot('e1');
            expect(result.chapterNumber).toBe(5);
        });
    });

    describe('invalidateForProject', () => {
        it('should not throw', async () => {
            await expect(entityCenter.invalidateForProject('p1')).resolves.toBeUndefined();
        });
    });
});
