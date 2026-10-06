/**
 * S3：registrar errors/warnings 分诊
 * 告警（类型降级保留 / 深度缺字段 / 未过类型校验降级落库）不得把登记判为失败；
 * 只有真·写库失败才计 errors。
 */
jest.mock('../../server/store', () => ({ queryItems: jest.fn(async () => []), setItem: jest.fn(async () => {}), getItem: jest.fn(async () => null) }));
jest.mock('../../server/services/entityCenter', () => ({
    findEntityByName: jest.fn(async () => null), getOrCreateEntity: jest.fn(async () => ({ id: 'e1' }))
}));
jest.mock('../../server/services/materialValidator', () => ({ validateMaterial: jest.fn(async () => ({ valid: true, missing: [] })) }));
jest.mock('../../server/services/materialDepthValidator', () => ({ validateMaterialDepth: jest.fn(() => ({ issues: [], valid: true, depthLevel: 'basic', message: '' })) }));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const store = require('../../server/store');
const { validateMaterial } = require('../../server/services/materialValidator');
const { validateMaterialDepth } = require('../../server/services/materialDepthValidator');
const { processNewMaterials } = require('../../server/services/pipeline/steps/materialItemProcessor');

const planWith = (newMaterials) => ({ newMaterials });
const chapter = { chapterNumber: 2 };

describe('S3 processNewMaterials 分诊', () => {
    beforeEach(() => jest.clearAllMocks());
    const baseMock = () => {
        store.queryItems.mockResolvedValue([]);
        store.setItem.mockResolvedValue(undefined);
        validateMaterial.mockResolvedValue({ valid: true, missing: [] });
        validateMaterialDepth.mockReturnValue({ issues: [], valid: true, depthLevel: 'basic', message: '' });
    };

    test('未过类型校验 → 降级落库(unvalidated) 且只记 warning', async () => {
        baseMock();
        validateMaterial.mockResolvedValue({ valid: false, missing: ['parentFaction'], message: '缺 parentFaction' });
        const operations = [], errors = [], warnings = [];
        await processNewMaterials(planWith([{ name: '赵四', type: 'character', description: '一个路人' }]), chapter, 'p1', [], {}, operations, errors, warnings);
        expect(errors).toEqual([]);
        expect(warnings).toHaveLength(1);
        expect(operations.some(o => o.type === 'createMaterial')).toBe(true);
        const saved = store.setItem.mock.calls.find(c => c[0] === 'materials')[2];
        expect(saved.unvalidated).toBe(true);
    });

    test('深度缺字段 → warning，不阻断', async () => {
        baseMock();
        validateMaterialDepth.mockReturnValue({ issues: [{ field: 'x' }], valid: false, missing: ['标志性细节'], depthLevel: 'deep', message: '缺字段' });
        const operations = [], errors = [], warnings = [];
        await processNewMaterials(planWith([{ name: '某物', type: 'worldview', description: '世界设定内容足够长' }]), chapter, 'p1', [], {}, operations, errors, warnings);
        expect(errors).toEqual([]);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatch(/depth validation failed/);
    });

    test('未知类型 → 降级保留 warning', async () => {
        baseMock();
        const operations = [], errors = [], warnings = [];
        await processNewMaterials(planWith([{ name: '顺通号案', type: 'case', description: '一桩沉船案' }]), chapter, 'p1', [], {}, operations, errors, warnings);
        expect(errors).toEqual([]);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatch(/类型未知/);
    });

    test('真·写库失败 → errors（passed 判负）', async () => {
        baseMock();
        store.setItem.mockRejectedValue(new Error('db down'));
        const operations = [], errors = [], warnings = [];
        await processNewMaterials(planWith([{ name: '某物', type: 'worldview', description: '世界设定内容足够长' }]), chapter, 'p1', [], {}, operations, errors, warnings);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/Failed to create material/);
        expect(warnings).toEqual([]);
    });
});
