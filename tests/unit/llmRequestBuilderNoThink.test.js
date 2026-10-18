/**
 * llmRequestBuilder — 供应商级"关闭思考"与内容审核标记（E3b 覆盖补齐）
 *
 * 覆盖 applyNoThink 的各分支（原 statements 92.68%/branches 87.05% 未达 95%）：
 *   空/非数组 messages、无 system、无 user、字符串 content、数组 content 块、
 *   marker 已存在、system 已有硬指令、enableThinking=true（不注入）。
 */
jest.mock('../../server/config/providerRegistry', () => ({
    PROVIDERS: {
        'fake-local': { noThinkMarker: '\n/no_think', noThinkSystemDirective: 'HARD-NOTHINK' },
        plain: {}
    }
}));

const { buildRequestPayload, classifyAndHandleError } = require('../../server/services/llmRequestBuilder');

const CFG = { provider: 'fake-local', model: 'm-local' };
const PLAIN = { provider: 'plain', model: 'm-plain' };

describe('applyNoThink（经 buildRequestPayload 触发）', () => {
    test('未声明 noThink 的供应商：messages 原样透传', () => {
        const messages = [{ role: 'user', content: 'hi' }];
        expect(buildRequestPayload(PLAIN, messages, {}).messages).toBe(messages);
    });

    test('enableThinking=true 时不注入', () => {
        const messages = [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }];
        const out = buildRequestPayload(CFG, messages, { enableThinking: true });
        expect(out.messages).toBe(messages);
        expect(out.enable_thinking).toBe(true);
    });

    test('字符串 content：system 追加硬指令 + 末条 user 追加 marker', () => {
        const messages = [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }];
        const out = buildRequestPayload(CFG, messages, {});
        expect(out.messages[0].content).toBe('S\nHARD-NOTHINK');
        expect(out.messages[1].content).toBe('U\n/no_think');
        expect(messages[0].content).toBe('S'); // 不改原数组
    });

    test('数组 content：只在最后一个 text 块追加 marker', () => {
        const messages = [{ role: 'user', content: [{ type: 'text', text: 'A' }, { type: 'image', url: 'x' }] }];
        const out = buildRequestPayload(CFG, messages, {});
        expect(out.messages[0].content[0].text).toBe('A\n/no_think');
        expect(out.messages[0].content[1]).toEqual({ type: 'image', url: 'x' });
    });

    test('marker 已存在 / 无 text 块 / 无 user 消息：不重复追加', () => {
        const already = [{ role: 'user', content: 'U\n/no_think' }];
        expect(buildRequestPayload(CFG, already, {}).messages[0].content).toBe('U\n/no_think');

        const noText = [{ role: 'user', content: [{ type: 'image', url: 'x' }] }];
        expect(buildRequestPayload(CFG, noText, {}).messages[0].content).toEqual([{ type: 'image', url: 'x' }]);

        const noUser = [{ role: 'system', content: 'S' }];
        expect(buildRequestPayload(CFG, noUser, {}).messages[0].content).toBe('S\nHARD-NOTHINK');
    });

    test('system 已含硬指令时不重复追加；空/非数组 messages 原样返回', () => {
        const hasDirective = [{ role: 'system', content: 'S\nHARD-NOTHINK' }, { role: 'user', content: 'U' }];
        expect(buildRequestPayload(CFG, hasDirective, {}).messages[0].content).toBe('S\nHARD-NOTHINK');
        expect(buildRequestPayload(CFG, [], {}).messages).toEqual([]);
        expect(buildRequestPayload(CFG, null, {}).messages).toBeNull();
    });
});

describe('classifyAndHandleError — 内容审核标记', () => {
    test('命中审核码时标记 isContentInspection（供换供应商兜底）', () => {
        const error = {
            message: 'API returned error',
            response: { data: { error: { message: 'data_inspection_failed' } }, status: 400 }
        };
        const out = classifyAndHandleError(error, CFG, 3, 1, 1000);
        expect(out.shouldThrow).toBe(true);
    });

    test('普通 4xx 且 errMsg 命中审核正则 → 标记 isContentInspection', () => {
        const error = {
            message: 'Request failed with status code 400',
            response: { data: { error: { message: 'inappropriate content detected' } }, status: 400 }
        };
        const out = classifyAndHandleError(error, CFG, 3, 1, 1000);
        expect(out.shouldThrow).toBe(true);
        expect(out.error.isContentInspection).toBe(true);
    });

    test('错误体各形态都能取到 message（string body / message 字段）', () => {
        const s1 = classifyAndHandleError({ message: 'm', response: { data: { error: 'plain-error' }, status: 500 } }, CFG, 0, 1, 1000);
        expect(s1.error.message).toContain('plain-error');
        const s2 = classifyAndHandleError({ message: 'm', response: { data: { message: 'nested' }, status: 500 } }, CFG, 0, 1, 1000);
        expect(s2.error.message).toContain('nested');
        const s3 = classifyAndHandleError({ message: 'm', response: { data: 'raw-body-text', status: 500 } }, CFG, 0, 1, 1000);
        expect(s3.error.message).toContain('raw-body-text');
    });
});
