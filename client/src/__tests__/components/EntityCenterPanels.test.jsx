/**
 * 实体中心新一轮组件冒烟：限知紧凑行 + 定义双栏
 */
import { render, screen, fireEvent } from '@testing-library/react';
import KnowledgeRecordRow from '../../pages/entitycenter/KnowledgeRecordRow';
import DefinitionSplitView from '../../pages/entitycenter/DefinitionSplitView';

describe('KnowledgeRecordRow', () => {
    const record = { id: 'r1', factText: '身份:沈砚-销籍状态', entityId: 'e1', confidence: 'certain', sourceHow: 'witnessed', sinceChapter: 3, notes: '档案已改' };
    test('renders fact, source, chapter and notes', () => {
        render(<KnowledgeRecordRow record={record} nameOf={id => (id === 'e1' ? '沈砚' : id)}
            showEntity showConfidence={false} onDelete={() => {}} />);
        expect(screen.getByText('身份:沈砚-销籍状态')).toBeInTheDocument();
        expect(screen.getByText('沈砚')).toBeInTheDocument();
        expect(screen.getByText('Ch3')).toBeInTheDocument();
        expect(screen.getByText('档案已改')).toBeInTheDocument();
    });
    test('confirm-then-delete fires onDelete with id', () => {
        const onDelete = vi.fn();
        render(<KnowledgeRecordRow record={record} nameOf={id => id} showEntity={false} showConfidence onDelete={onDelete} />);
        const btn = screen.getByRole('button');
        fireEvent.click(btn);
        fireEvent.click(screen.getByRole('button'));
        expect(onDelete).toHaveBeenCalledWith('r1');
    });
});

describe('DefinitionSplitView', () => {
    const items = [{ id: 'a', name: '折扇' }, { id: 'b', name: '令牌' }];
    test('shows empty hint, then detail after selecting', () => {
        render(<DefinitionSplitView items={items}
            browserOf={({ onSelect }) => (
                <div>
                    {items.map(i => <button key={i.id} onClick={() => onSelect(i.id)}>{i.name}</button>)}
                </div>
            )}
            detailOf={i => <div>详情：{i.name}</div>} />);
        expect(screen.getByText('点左侧卡片查看定义详情')).toBeInTheDocument();
        fireEvent.click(screen.getByText('令牌'));
        expect(screen.getByText('详情：令牌')).toBeInTheDocument();
    });
});
