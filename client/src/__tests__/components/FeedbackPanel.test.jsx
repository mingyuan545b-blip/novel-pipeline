import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeedbackPanel from '../../pages/library/FeedbackPanel';

vi.mock('../../services/api', () => ({
    libraryApi: { deleteFeedback: vi.fn(() => Promise.resolve({ data: {} })) },
}));
vi.mock('../../shared/logger', () => ({
    default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const feedback = (techniques) => ({ totalRecords: techniques.length, techniques });

describe('FeedbackPanel（回归：此前显示裸ID，用户无法阅读）', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('无项目时提示选择项目', () => {
        render(<FeedbackPanel feedbackData={null} projectId={null} />);
        expect(screen.getByText('选择项目后查看技法反馈')).toBeInTheDocument();
    });

    test('无数据时给出空态', () => {
        render(<FeedbackPanel feedbackData={feedback([])} projectId="p1" />);
        expect(screen.getByText('暂无反馈数据')).toBeInTheDocument();
    });

    test('显示技法名而非ID，并提供ID tooltip', () => {
        render(<FeedbackPanel projectId="p1" feedbackData={feedback([
            { techniqueId: '02-06-003', name: '压力可见化刻度', department: '02_情节引擎部', successRate: '80.0', total: 5, passed: 4, failed: 1 },
        ])} />);
        expect(screen.getByText('压力可见化刻度')).toBeInTheDocument();
        expect(screen.queryByText('02-06-003')).not.toBeInTheDocument();
        expect(screen.getByTitle('压力可见化刻度（02-06-003）')).toBeInTheDocument();
    });

    test('技法已删除（无name）时回落显示ID，不渲染空行', () => {
        render(<FeedbackPanel projectId="p1" feedbackData={feedback([
            { techniqueId: 'ghost-01', name: '', department: '', successRate: '0.0', total: 1, passed: 0, failed: 1 },
        ])} />);
        expect(screen.getByText('ghost-01')).toBeInTheDocument();
    });

    test('技法数不足时Top与Bottom不重复展示同一条', () => {
        const items = [
            { techniqueId: 'a', name: '技法A', department: '02_情节引擎部', successRate: '90.0', total: 2, passed: 2, failed: 0 },
            { techniqueId: 'b', name: '技法B', department: '03_人物熔炉部', successRate: '10.0', total: 2, passed: 0, failed: 2 },
        ];
        render(<FeedbackPanel projectId="p1" feedbackData={feedback(items)} />);
        expect(screen.getAllByText('技法A')).toHaveLength(1);
        expect(screen.getAllByText('技法B')).toHaveLength(1);
        expect(screen.queryByText(/Bottom/)).not.toBeInTheDocument();
    });
});
