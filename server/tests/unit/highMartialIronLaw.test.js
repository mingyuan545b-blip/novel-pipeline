'use strict';

/**
 * 高武题材"铁律"定义完备性 + 审稿器误报回归
 * 背景：interceptors.js 引用了"铁律一/二/三"，但 foundation.js 从未定义（幽灵规则，只查不写）。
 */

const fs = require('fs');
const path = require('path');
const foundation = require('../../services/genres/high-martial-crossplane/foundation');
const interceptors = require('../../services/genres/high-martial-crossplane/interceptors');

const RULES_TEXT = foundation.additionalFoundationRules.join('\n');

describe('铁律编号单一源：审稿器引用的铁律必须在 foundation 有定义', () => {
    const interceptorSrc = fs.readFileSync(path.join(__dirname, '../../services/genres/high-martial-crossplane/interceptors.js'), 'utf8');
    const referenced = [...new Set((interceptorSrc.match(/违反铁律[一二三四五六七八九十零点五]*/g) || []))];

    it('interceptors 至少引用了铁律一/二/三', () => {
        expect(referenced.some(r => r.includes('铁律三'))).toBe(true);
    });

    it.each(referenced)('%s 在 foundation.additionalFoundationRules 中有定义', (ref) => {
        const lawName = ref.replace('违反', '');
        expect(RULES_TEXT).toContain(lawName);
    });
});

describe('审稿器不再误报：否定语境/剧情化HUD', () => {
    const cases = [
        { name: '否定式"不是系统提示"', content: '不是系统提示，而是直接烙印在他的视网膜投影底层日志里。' },
        { name: '剧情化HUD"粘贴到状态栏"', content: '他把防御代码剪切下来，粘贴到了自己的当前状态栏中。' },
    ];
    it.each(cases)('$name → 不产生元数据泄露 hardBlock', ({ content }) => {
        const out = interceptors.secondReview(content, {}, {});
        const leak = out.hardBlockIssues.find(i => i.title === '元数据泄露');
        expect(leak).toBeUndefined();
    });
});
