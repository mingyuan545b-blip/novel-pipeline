/**
 * T3 验收：material-manager 输出的**结构校验 + 定向修复**
 *
 * 验收标准（硬断言）：
 *  1. 历史静默丢弃路径必须被拦下并可见：action="新增" / type 非法 / name 空 / content 空
 *  2. 全部合规时 **0 次额外 LLM 调用**（省 token 的硬指标）
 *  3. 定向修复只回喂**不合规的那些条目**（合规条目不得出现在修复 prompt 里）
 *  4. 修复后合并落库，合规条目**不重复处理**
 *  5. 修复最多 1 次（不允许无限烧 token）
 *  6. 修复也救不回来 → dropped 计数可见；全丢 → ok=false（交给 T1 失败链路）
 *  7. 无 runAgent 时不崩，明确报告原因
 */
jest.mock('../../server/services/pipeline/steps/materialUpdateProcessor', () => ({ processUpdates: jest.fn() }));
jest.mock('../../server/services/pipeline/steps/materialMarkdownExtractor', () => ({ extractFromMarkdown: jest.fn() }));
jest.mock('../../server/shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { processUpdates } = require('../../server/services/pipeline/steps/materialUpdateProcessor');
const { applyUpdatesWithFallback } = require('../../server/services/pipeline/steps/materialUpdateApplier');
const { repairInvalidUpdates } = require('../../server/services/pipeline/steps/materialUpdateRepair');
const { validateMaterialUpdates, buildRepairPrompt } = require('../../server/services/pipeline/steps/materialOutputSchema');

const base = () => ({ chapter: { chapterNumber: 5 }, projectId: 'p1', materials: [], styleProfile: {}, runAgent: jest.fn() });

beforeEach(() => jest.clearAllMocks());

describe('T3-1 结构校验（拦下历史静默丢弃路径）', () => {
    test('action 写成“新增” → 判定不合规（旧代码三个分支都不匹配，什么都不做）', () => {
        const r = validateMaterialUpdates([{ type: 'equipment', name: '断刃', action: '新增', content: 'x' }]);
        expect(r.ok).toBe(false);
        expect(r.errors.some(e => e.code === 'MS-BAD-ACTION')).toBe(true);
    });

    test('非法 type / 空 name / 空 content 全部被拦', () => {
        const r = validateMaterialUpdates([{ type: '不是类型', name: '', content: '' }]);
        const codes = r.errors.map(e => e.code);
        expect(codes).toContain('MS-BAD-TYPE');
        expect(codes).toContain('MS-BAD-NAME');
        expect(codes).toContain('MS-NO-CONTENT');
    });

    test('合法 action 集合与 processUpdates 分支对齐', () => {
        for (const action of ['create', 'update', 'retire', 'deprecate', 'recycle', 'import']) {
            expect(validateMaterialUpdates([{ type: 'equipment', name: 'x', action, content: 'c' }]).ok).toBe(true);
        }
    });

    test('缺省 action 不算错（由 determineAction 推断）', () => {
        expect(validateMaterialUpdates([{ type: 'equipment', name: 'x', content: 'c' }]).ok).toBe(true);
    });

    test('content 是对象 → 不算错（normalizeContent 会转文本，不误杀）', () => {
        expect(validateMaterialUpdates([{ type: 'character', name: '林婉', content: { 身份: '弟子' } }]).ok).toBe(true);
    });
});

describe('T3-2/3/5 定向修复（省 token + 最多一次）', () => {
    test('2. 全部合规 → 0 次额外 LLM 调用', async () => {
        processUpdates.mockResolvedValue([{ action: 'create', type: 'equipment', name: '断刃' }]);
        const runAgent = jest.fn();
        const r = await applyUpdatesWithFallback({
            ...base(), runAgent,
            repairFn: (invalid, errors) => repairInvalidUpdates({ invalid, errors, runAgent }),
            response: JSON.stringify({ updates: [{ type: 'equipment', name: '断刃', action: 'create', content: '缺口短刀' }] }),
        });
        expect(r.ok).toBe(true);
        expect(runAgent).not.toHaveBeenCalled();
        expect(r.stats).toMatchObject({ total: 1, valid: 1, invalid: 0, repaired: 0, dropped: 0 });
    });

    test('3. 修复 prompt 只包含不合规条目（合规条目不得出现）', () => {
        const prompt = buildRepairPrompt([{ update: { type: 'bad', name: '坏条目' }, errors: [{ field: 'type', message: '非法素材类型' }] }]);
        expect(prompt).toContain('坏条目');
        expect(prompt).not.toContain('好条目');
    });

    test('4. 修复成功后：合规条目直通 + 修好的同一条目合并（改 type 也是同一素材）', async () => {
        processUpdates.mockImplementation(async (updates) => updates.map(() => ({ action: 'update', type: 'equipment', name: 'x' })));
        const runAgent = jest.fn().mockResolvedValue({
            response: JSON.stringify({ updates: [{ type: 'mechanism', name: '违规', action: 'create', content: '修好的内容' }] }),
        });
        const r = await applyUpdatesWithFallback({
            ...base(), runAgent,
            repairFn: (invalid, errors) => repairInvalidUpdates({ invalid, errors, runAgent }),
            response: JSON.stringify({ updates: [
                { type: 'equipment', name: '断刃', action: 'create', content: '合规' },
                { type: 'bad-type', name: '违规', action: 'create', content: '需修复' },
            ] }),
        });
        expect(r.ok).toBe(true);
        expect(runAgent).toHaveBeenCalledTimes(1);
        const sent = runAgent.mock.calls[0][1].content;
        expect(sent).toContain('违规');
        expect(sent).not.toContain('断刃');
        expect(processUpdates.mock.calls[0][0]).toHaveLength(2);
        expect(r.stats).toMatchObject({ total: 2, valid: 2, invalid: 1, repaired: 1, rejectedExtra: 0, dropped: 0 });
    });

    test('4b. 修复响应若“换个素材交差”（name 对不上）→ 拒绝，不绕过新增限制', async () => {
        processUpdates.mockResolvedValue([{ action: 'create', type: 'equipment', name: '断刃' }]);
        const runAgent = jest.fn().mockResolvedValue({
            response: JSON.stringify({ updates: [{ type: 'catchphrase', name: '另外一个新素材', action: 'create', content: '模型自作主张' }] }),
        });
        const r = await applyUpdatesWithFallback({
            ...base(), runAgent,
            repairFn: (invalid, errors) => repairInvalidUpdates({ invalid, errors, runAgent }),
            response: JSON.stringify({ updates: [
                { type: 'equipment', name: '断刃', action: 'create', content: '合规' },
                { type: 'bad-type', name: '违规', action: 'create', content: '需修复' },
            ] }),
        });
        const processed = processUpdates.mock.calls[0][0];
        expect(processed.map(u => u.name)).toEqual(['断刃']);       // 越权新增被拒绝
        expect(r.stats).toMatchObject({ invalid: 1, repaired: 0, rejectedExtra: 1, dropped: 1 });
    });

    test('5. 修复最多调用 1 次（禁无限重试）', async () => {
        const runAgent = jest.fn().mockResolvedValue({ response: JSON.stringify({ updates: [{ type: 'still-bad', name: '还是坏', content: 'x' }] }) });
        processUpdates.mockResolvedValue([{ action: 'update', type: 'equipment', name: 'ok' }]);
        await applyUpdatesWithFallback({
            ...base(), runAgent,
            repairFn: (invalid, errors) => repairInvalidUpdates({ invalid, errors, runAgent, maxAttempts: 1 }),
            response: JSON.stringify({ updates: [
                { type: 'equipment', name: '好条目', action: 'create', content: 'ok' },
                { type: 'bad', name: '坏条目', action: 'create', content: 'x' },
            ] }),
        });
        expect(runAgent).toHaveBeenCalledTimes(1);
    });

    test('6a. 修复救不回来 → dropped 计数可见（不是静默）', async () => {
        processUpdates.mockResolvedValue([{ action: 'create', type: 'equipment', name: '好条目' }]);
        const runAgent = jest.fn().mockResolvedValue({ response: '模型还是乱答' });
        const r = await applyUpdatesWithFallback({
            ...base(), runAgent,
            repairFn: (invalid, errors) => repairInvalidUpdates({ invalid, errors, runAgent }),
            response: JSON.stringify({ updates: [
                { type: 'equipment', name: '好条目', action: 'create', content: 'ok' },
                { type: 'bad', name: '坏条目', action: 'create', content: 'x' },
            ] }),
        });
        expect(r.ok).toBe(true);
        expect(r.stats).toMatchObject({ total: 2, valid: 1, invalid: 1, repaired: 0, dropped: 1 });
    });

    test('6b. 全部不合规且修复失败 → ok=false（进入 T1 失败链路，不假装成功）', async () => {
        const runAgent = jest.fn().mockResolvedValue({ response: '模型还是乱答' });
        const r = await applyUpdatesWithFallback({
            ...base(), runAgent,
            repairFn: (invalid, errors) => repairInvalidUpdates({ invalid, errors, runAgent }),
            response: JSON.stringify({ updates: [{ type: 'bad', name: '坏', action: 'create', content: 'x' }] }),
        });
        expect(r.ok).toBe(false);
        expect(r.stats).toMatchObject({ total: 1, valid: 0, dropped: 1 });
        expect(processUpdates).not.toHaveBeenCalled();
    });

    test('7. 无 runAgent → 不崩，明确报告 no-runAgent', async () => {
        const r = await repairInvalidUpdates({ invalid: [{ update: {}, errors: [] }] });
        expect(r.attempts).toBe(0);
        expect(r.reason).toBe('no-runAgent');
    });

    test('8. 修复响应重复回喂已合规条目 → 不重复落库（同一素材只处理一次）', async () => {
        processUpdates.mockImplementation(async (updates) => updates.map(() => ({ action: 'update', type: 'equipment', name: '断刃' })));
        const runAgent = jest.fn().mockResolvedValue({
            response: JSON.stringify({ updates: [
                { type: 'equipment', name: '断刃', action: 'create', content: '合规（重复回喂）' },
                { type: 'catchphrase', name: '再算一遍', action: 'create', content: '自作主张' },
            ] }),
        });
        const r = await applyUpdatesWithFallback({
            ...base(), runAgent,
            repairFn: (invalid, errors) => repairInvalidUpdates({ invalid, errors, runAgent }),
            response: JSON.stringify({ updates: [
                { type: 'equipment', name: '断刃', action: 'create', content: '合规' },
                { type: 'bad-type', name: '违规', action: 'create', content: '需修复' },
            ] }),
        });
        const processed = processUpdates.mock.calls[0][0];
        expect(processed.map(u => u.name)).toEqual(['断刃']);    // 断刃只落库一次
        expect(r.stats.dropped).toBe(1);                        // 违规条目确实没修回来
    });
});
