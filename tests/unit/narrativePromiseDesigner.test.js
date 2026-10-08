/**
 * narrativePromiseDesigner 单元测试 — 立项四件解析与齐备判定
 */
jest.mock('../../server/services/llm', () => ({ chat: jest.fn() }));
jest.mock('../../server/store', () => ({ getItem: jest.fn(), queryItems: jest.fn(), setItem: jest.fn() }));

const { isComplete, parsePromise } = require('../../server/services/narrativePromiseDesigner');

describe('isComplete', () => {
    test('四件齐备才算完成', () => {
        expect(isComplete({ readerPromise: '看规则漏洞翻盘', sellingPoint: '民俗志怪职场', mainLoop: '三章一委托', emotionRecipe: '憋屈→翻盘' })).toBe(true);
        expect(isComplete({ readerPromise: '看规则漏洞翻盘' })).toBe(false);
        expect(isComplete(null)).toBe(false);
    });
});

describe('parsePromise', () => {
    test('解析 fenced JSON', () => {
        const raw = '好的\n```json\n{"readerPromise":"a1b2","sellingPoint":"b1c2","mainLoop":"c1d2","emotionRecipe":"d1e2"}\n```';
        expect(parsePromise(raw)).toMatchObject({ readerPromise: 'a1b2' });
    });
    test('不齐备或非 JSON → null', () => {
        expect(parsePromise('{"readerPromise":"a1b2"}')).toBeNull();
        expect(parsePromise('没有 JSON')).toBeNull();
    });
});
