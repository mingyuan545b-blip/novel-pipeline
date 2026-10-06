/**
 * knowledgeTreeBuild — 限知树（人物轴 / 事件轴）
 */
import { buildEntityTree, buildEventTree, buildKnowledgeTree, sourceHowLabel, TREE_AXES } from '../../pages/entitycenter/knowledgeTreeBuild';

const rec = (id, { confidence = 'certain', factText = 'F', entityId = 'e1', sourceHow = 'witnessed', sinceChapter = 1 } = {}) =>
    ({ id, confidence, factText, entityId, sourceHow, sinceChapter });

describe('TREE_AXES', () => {
    test('暴露人物 / 事件两条轴', () => {
        expect(TREE_AXES.map(a => a.key)).toEqual(['entity', 'event']);
    });
});

describe('sourceHowLabel', () => {
    test('规范渠道中文化，别名亦中文化', () => {
        expect(sourceHowLabel('witnessed')).toBe('亲眼');
        expect(sourceHowLabel('read')).toBe('阅读');
    });
    test('未知渠道不裸露英文 key', () => {
        expect(sourceHowLabel('telepathy')).toBe('telepathy');
        expect(sourceHowLabel('')).toBe('未知渠道');
    });
});

describe('buildEntityTree（人物轴）', () => {
    const records = [
        rec('a', { entityId: 'e1', confidence: 'certain', factText: '身份:沈砚' }),
        rec('b', { entityId: 'e1', confidence: 'suspect', factText: '秘密:漏洞' }),
        rec('c', { entityId: 'e2', confidence: 'certain', factText: '秘密:漏洞' }),
        rec('d', { entityId: 'e1', confidence: 'weird', factText: '物品:算珠' }),
    ];
    const tree = buildEntityTree(records, id => ({ e1: '沈砚', e2: '柳三娘' }[id]));

    test('一级=人物，按条数降序', () => {
        expect(tree.map(n => n.label)).toEqual(['沈砚', '柳三娘']);
        expect(tree[0].count).toBe(3);
    });
    test('二级=确信/怀疑/未知，叶子=单条记录', () => {
        expect(tree[0].children.map(c => c.key)).toEqual(['e:e1::certain', 'e:e1::suspect', 'e:e1::unknown']);
        for (const c of tree[0].children) expect(c.records).toHaveLength(1);
    });
    test('二级标签中文化且带颜色', () => {
        const suspect = tree[0].children.find(c => c.key === 'e:e1::suspect');
        expect(suspect.label).toBe('怀疑');
        expect(suspect.color).toBeTruthy();
    });
});

describe('buildEventTree（事件轴）', () => {
    const records = [
        rec('a', { factText: '秘密:漏洞', sourceHow: 'witnessed', entityId: 'e1' }),
        rec('b', { factText: '秘密:漏洞', sourceHow: 'told', entityId: 'e2' }),
        rec('c', { factText: '秘密:漏洞', sourceHow: 'witnessed', entityId: 'e2' }),
        rec('d', { factText: '身份:沈砚', sourceHow: 'read', entityId: 'e1' }),
    ];
    const tree = buildEventTree(records);

    test('一级=事实，按知情人数降序', () => {
        expect(tree.map(n => n.label)).toEqual(['秘密:漏洞', '身份:沈砚']);
        expect(tree[0].count).toBe(3);
    });
    test('二级=获知渠道，规范渠道优先排序', () => {
        expect(tree[0].children.map(c => c.label)).toEqual(['亲眼', '听说']);
        expect(tree[1].children.map(c => c.label)).toEqual(['阅读']);
    });
    test('叶子=通过该渠道知情的人（含确信度）', () => {
        const witnessed = tree[0].children.find(c => c.label === '亲眼');
        expect(witnessed.records.map(r => r.entityId).sort()).toEqual(['e1', 'e2']);
        expect(witnessed.records.every(r => r.confidence === 'certain')).toBe(true);
    });
    test('一级带分类色与分类名', () => {
        expect(tree[1].categoryLabel).toBe('身份');
        expect(tree[1].color).toBeTruthy();
    });
});

describe('buildKnowledgeTree 分派', () => {
    test('默认人物轴，event 走事件轴', () => {
        expect(buildKnowledgeTree([rec('a')], undefined, null)[0].key).toBe('e:e1');
        expect(buildKnowledgeTree([rec('a')], 'event', null)[0].key).toBe('f:F');
    });
});
