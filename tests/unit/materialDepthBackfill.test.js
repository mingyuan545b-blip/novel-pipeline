/**
 * T6 验收：深度键多来源确定性回填
 *
 * 验收标准（硬断言）：
 *  1. 素材正文【标签】能派生深度键（别名表覆盖，含 fieldRegistry 兜底）
 *  2. **绝不覆盖已有值**（历史 P0：把人设冲掉）
 *  3. **没有真实来源就不产生键**（不许编一句假的内在矛盾）
 *  4. 占位词（"无"/"无 | 无"/"暂无"）不算深度
 *  5. 与契约口径一致：hasAnyDepthKey 命中契约的 anyOf 判据
 *  6. 端到端：契约素材富化后，深度键真的能被判定为"有深度"
 *  7. 深度缺口可见：organizer 出场角色无深度字段 → 被 collectDepthGaps 抓到
 */
jest.mock('../../server/services/entityCenter', () => ({ getEntitiesForProject: jest.fn() }));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const entityCenter = require('../../server/services/entityCenter');
const bf = require('../../server/services/pipeline/materialDepthBackfill');
const { enrichMaterialsForContract } = require('../../server/services/pipeline/contractMaterialEnricher');
const { collectDepthGaps, DEPTH_NOTE_FIELDS } = require('../../server/services/pipeline/steps/materialOrganizerGuards');
const { CHARACTER_DEPTH_KEYS } = require('../../server/services/pipeline/contracts/_registry');

beforeEach(() => jest.clearAllMocks());

describe('T6-1/2/3/4 派生规则', () => {
    test('1. 素材正文【标签】→ 深度键（别名）', () => {
        const d = bf.deriveDepthFromContent('【身份】外门弟子\n【内在矛盾】想活命又怕连累同伴\n【成长弧光】从自私到担当');
        expect(d.innerConflict).toBe('想活命又怕连累同伴');
        expect(d.fateArc).toBe('从自私到担当');
        expect(d.independentStance).toBeUndefined();
    });

    test('1b. 别名表来自 fieldRegistry（改标签表这里自动跟随）', () => {
        expect(bf.stateKeyOfLabel('内在矛盾')).toBe('innerConflict');
        expect(bf.stateKeyOfLabel('成长弧光')).toBe('fateArc');
        expect(bf.stateKeyOfLabel('不存在的标签')).toBeNull();
    });

    test('2. 绝不覆盖已有值（实体/KV/正文都不行）', () => {
        const r = bf.backfillDepthKeys({
            stateJson: { innerConflict: '实体里的原值' },
            entity: { profile: { innerConflict: '另一个值' } },
            materialContent: '【内在矛盾】正文里的值',
        });
        expect(r.merged.innerConflict).toBe('实体里的原值');
        expect(r.filled).not.toContain('innerConflict');
    });

    test('3. 没有真实来源 → 不产生键（不臆造）', () => {
        const r = bf.backfillDepthKeys({ materialContent: '【身份】外门弟子' });
        for (const k of CHARACTER_DEPTH_KEYS) expect(r.merged[k]).toBeUndefined();
        expect(r.filled).toEqual([]);
    });

    test('4. 占位词不算深度（"无 | 无"这种垃圾值必须被识破）', () => {
        for (const junk of ['无', '暂无', '未知', '无 | 无', '—', 'n/a', '无变化']) {
            expect([junk, bf.hasDepth(junk)]).toEqual([junk, false]);
        }
        expect(bf.hasDepth('想活命又怕连累同伴')).toBe(true);
    });

    test('4c. 【标签】落在非深度键上时不得混入（身份/性格之外的字段不越界）', () => {
        const r = bf.backfillDepthKeys({ materialContent: '【性格】沉默' });
        expect(r.filled).toEqual(['personality']);           // 性格→personality，是契约 anyOf 内的合法深度键
        expect(r.merged.innerConflict).toBeUndefined();
    });

    test('4b. 素材库里已存在的垃圾深度值 → 会被真实来源覆盖为可用值', () => {
        const r = bf.backfillDepthKeys({
            stateJson: { innerConflict: '无 | 无' },
            materialContent: '【内在矛盾】想活命又怕连累同伴',
        });
        expect(r.merged.innerConflict).toBe('想活命又怕连累同伴');
        expect(r.filled).toContain('innerConflict');
    });

    test('5. 与契约口径一致（任一深度键即算有深度）', () => {
        expect(bf.hasAnyDepthKey({ innerConflict: '不甘心做棋子' })).toBe(true);
        expect(bf.hasAnyDepthKey({ personality: '沉默' })).toBe(true);   // personality 也在契约 anyOf 里
        expect(bf.hasAnyDepthKey({ hp: 100 })).toBe(false);
        expect(bf.hasAnyDepthKey({})).toBe(false);
    });
});

describe('T6-6 端到端：契约富化后深度键可判定', () => {
    test('实体无深度键但素材正文有【内在矛盾】→ 富化后判定为有深度（原本会断链 CRITICAL）', async () => {
        entityCenter.getEntitiesForProject.mockResolvedValue([
            { id: 'e1', name: '林婉', roleLevel: 'supporting', position: '外门弟子', personality: '沉默' },
        ]);
        const materials = [{
            id: 'm1', projectId: 'p1', type: 'character', name: '林婉', archived: false,
            currentContent: '【身份】外门弟子\n【内在矛盾】想活命又怕连累同伴',
            stateJson: {},
        }];
        const out = await enrichMaterialsForContract(materials, 'p1');
        expect(bf.hasAnyDepthKey(out[0].stateJson)).toBe(true);
        expect(out[0].stateJson.innerConflict).toBe('想活命又怕连累同伴');
    });

    test('素材带着垃圾深度值 → 富化时被真实来源修正', async () => {
        entityCenter.getEntitiesForProject.mockResolvedValue([
            { id: 'e2', name: '沈砚', roleLevel: 'protagonist', profile: {} },
        ]);
        const materials = [{
            id: 'm2', projectId: 'p1', type: 'character', name: '沈砚', archived: false,
            currentContent: '【内在矛盾】不甘心做棋子', stateJson: { innerConflict: '无 | 无' },
        }];
        const out = await enrichMaterialsForContract(materials, 'p1');
        expect(out[0].stateJson.innerConflict).toBe('不甘心做棋子');
    });
});

describe('T6-7 深度缺口可见', () => {
    test('出场角色无任何深度字段 → 被抓出（不静默）', () => {
        const plan = {
            characters: [
                { name: '林婉', appeared: true, personalityNote: '沉默' },
                { name: '沈砚', appeared: true, innerConflictNote: '不甘心做棋子' },
                { name: '路人甲', appeared: false },
                { name: '老陈', appeared: true, innerConflictNote: '无变化' },   // 显式声明无变化 → 不算缺口
            ],
        };
        const { gaps, total, covered } = collectDepthGaps(plan);
        expect(gaps.map(g => g.name)).toEqual(['林婉']);
        expect(total).toBe(3);
        expect(covered).toBe(2);
    });

    test('深度字段清单与契约 anyOf 覆盖同一批语义词', () => {
        expect(DEPTH_NOTE_FIELDS).toContain('innerConflictNote');
        expect(DEPTH_NOTE_FIELDS).toContain('fateArcNote');
        expect(CHARACTER_DEPTH_KEYS).toContain('innerConflict');
    });
});
