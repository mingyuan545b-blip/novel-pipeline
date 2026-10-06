/**
 * 实体中心重设计冒烟：信息密度分级 / 阶段寻址 / 摘要折叠与运行态分离
 */
import { render, screen, fireEvent } from '@testing-library/react';
import {
    densitiesOf, defaultDensityKey, stagesOf, resolveStageKey, hasGrowthData,
} from '../../pages/entitycenter/definitionLevels';
import { groupKeyOfField, previewFields, countRuntime } from '../../pages/entitycenter/summaryGroups';
import DefinitionDensityPanel from '../../pages/entitycenter/DefinitionDensityPanel';
import DefinitionMetaColumn from '../../pages/entitycenter/DefinitionMetaColumn';
import CharSummaryCard from '../../pages/entitycenter/CharSummaryCard';

const item = {
    id: 'x1',
    name: '玄铁剑',
    briefDesc: '一柄玄铁重剑。',
    detailDesc: '完整设定……',
    propertiesJson: {
        currentStage: '二阶',
        attributes: { 攻击: '+12' },
        stages: [
            { key: '一阶', label: '一阶', chapter: 3, attributes: { 攻击: '+4' }, effects: ['微光'] },
            { key: '二阶', label: '二阶', chapter: 12, attributes: { 攻击: '+12' }, effects: ['罡气外放'] },
        ],
    },
};

describe('definitionLevels', () => {
    test('densitiesOf 标记可用层级，默认取概要', () => {
        const ds = densitiesOf(item, null);
        expect(ds.find(d => d.key === 'brief').available).toBe(true);
        expect(ds.find(d => d.key === 'summary').available).toBe(false);
        expect(defaultDensityKey(ds)).toBe('brief');
    });
    test('stagesOf 规范化阶段，resolveStageKey 依 currentStage', () => {
        const stages = stagesOf(item);
        expect(stages).toHaveLength(2);
        expect(resolveStageKey(item, stages, 99)).toBe('二阶');
        expect(hasGrowthData(item)).toBe(true);
    });
    test('无 currentStage 时按章节落到最近阶段', () => {
        const noCur = { propertiesJson: { stages: item.propertiesJson.stages } };
        expect(resolveStageKey(noCur, stagesOf(noCur), 5)).toBe('一阶');
    });
});

describe('summaryGroups', () => {
    test('运行态字段与核心设定分离', () => {
        expect(groupKeyOfField('职位/身份')).toBe('core');
        expect(groupKeyOfField('生命值')).toBe('runtime');
        expect(groupKeyOfField('战力')).toBe('runtime');
        const fields = { '职位/身份': '账房先生', 生命值: '90%', 战力: 12, 阵营: '苍生局' };
        expect(previewFields(fields).map(([k]) => k)).not.toContain('生命值');
        expect(countRuntime(fields)).toBe(2);
    });
});

describe('DefinitionDensityPanel', () => {
    test('默认概要，点击阶段载入该阶段属性', () => {
        render(<DefinitionDensityPanel item={item} material={null} currentChapter={20} />);
        expect(screen.getByText('一柄玄铁重剑。')).toBeInTheDocument();
        expect(screen.getByText('+12')).toBeInTheDocument();      // 当前(二阶)属性
        fireEvent.click(screen.getByText('一阶'));
        expect(screen.getByText('+4')).toBeInTheDocument();
        expect(screen.getByText('微光')).toBeInTheDocument();
    });
});

describe('DefinitionMetaColumn', () => {
    test('标签中文化', () => {
        render(<DefinitionMetaColumn item={{ rarity: 'rare', sourceChapter: 20, tags: ['auto-generated'] }} material={null} />);
        expect(screen.getByText('稀有')).toBeInTheDocument();
        expect(screen.getByText('第20章')).toBeInTheDocument();
        expect(screen.getByText('自动生成')).toBeInTheDocument();
    });
});

describe('CharSummaryCard', () => {
    test('默认折叠只给概要，展开后显示运行态分组', () => {
        const block = { name: '沈砚', fields: { '职位/身份': '账房先生', 生命值: '90%', 战力: 12 } };
        render(<CharSummaryCard block={block} index={0} chapter={15} source="kv" />);
        expect(screen.getByText('账房先生')).toBeInTheDocument();
        expect(screen.queryByText('90%')).not.toBeInTheDocument();
        expect(screen.getByText(/引用 状态库 · 第15章/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('沈砚'));
        expect(screen.getByText('90%')).toBeInTheDocument();
        expect(screen.getByText('运行时状态')).toBeInTheDocument();
    });
});
