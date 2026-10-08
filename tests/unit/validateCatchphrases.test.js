/**
 * validateCatchphrases 单元测试 — 口头禅三问
 */
const {
    normalizeCatchphrase, catchphraseKey, validateCatchphrase, validateCatchphrases, dedupeCatchphrases
} = require('../../server/services/validateCatchphrases');

const good = { text: '这账，平了才叫结', trigger: '面对赖账的人时', why: '因为他是记账人，所以宁可当恶人，也不肯留一笔糊涂账' };

describe('validateCatchphrase', () => {
    test('三要素齐备通过', () => {
        expect(validateCatchphrase(good).valid).toBe(true);
    });
    test('过场句被拦', () => {
        expect(validateCatchphrase({ ...good, text: '上车。' }).issues.join()).toContain('过场');
    });
    test('现代网络梗被拦', () => {
        expect(validateCatchphrase({ ...good, text: 'yyds' }).issues.join()).toContain('网络梗');
    });
    test('评论腔 why 被拦', () => {
        expect(validateCatchphrase({ ...good, why: '体现了他的性格' }).issues.join()).toContain('评论腔');
    });
    test('过长被拦（口头禅要短）', () => {
        expect(validateCatchphrase({ ...good, text: 'x'.repeat(40) }).issues.join()).toContain('过长');
    });
    test('兼容纯字符串', () => {
        expect(normalizeCatchphrase('路子野')).toMatchObject({ text: '路子野', trigger: '', why: '' });
    });
});

describe('validateCatchphrases / dedupeCatchphrases', () => {
    test('批量区分通过/失败', () => {
        const r = validateCatchphrases([good, { text: 'x' }]);
        expect(r.passed).toBe(1);
        expect(r.failed).toHaveLength(1);
    });
    test('去重忽略标点', () => {
        const { merged, added } = dedupeCatchphrases([{ ...good, text: good.text + '。' }], [good]);
        expect(merged).toHaveLength(1);
        expect(added).toHaveLength(0);
        expect(catchphraseKey(good)).toBe(catchphraseKey({ ...good, text: good.text + '。' }));
    });
});
