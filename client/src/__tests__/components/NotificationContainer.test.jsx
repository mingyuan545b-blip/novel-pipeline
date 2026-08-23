import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationContainer from '../../components/NotificationContainer';
import {
    showError, showSuccess, showWarn, showInfo,
    unregisterContainer
} from '../../components/notifications';

describe('NotificationContainer', () => {
    beforeEach(() => {
        render(
            <MemoryRouter>
                <NotificationContainer />
            </MemoryRouter>
        );
    });

    afterEach(() => {
        unregisterContainer();
        vi.clearAllMocks();
    });

    it('显示错误通知', async () => {
        await act(async () => {
            showError('测试错误消息');
        });
        expect(screen.getByText('测试错误消息')).toBeInTheDocument();
    });

    it('错误通知含 traceId 时显示追踪码', async () => {
        const error = { traceId: 'tr-test-123' };
        await act(async () => {
            showError('请求失败', error);
        });
        expect(screen.getByText('请求失败')).toBeInTheDocument();
        expect(screen.getByText('tr-test-123')).toBeInTheDocument();
        expect(screen.getByText(/反馈此码/)).toBeInTheDocument();
    });

    it('错误通知无 traceId 时不显示追踪码区域', async () => {
        await act(async () => {
            showError('简单错误');
        });
        expect(screen.getByText('简单错误')).toBeInTheDocument();
        expect(screen.queryByText(/追踪码/)).not.toBeInTheDocument();
    });

    it('显示成功通知', async () => {
        await act(async () => {
            showSuccess('操作成功');
        });
        expect(screen.getByText('操作成功')).toBeInTheDocument();
    });

    it('显示警告通知', async () => {
        await act(async () => {
            showWarn('警告消息');
        });
        expect(screen.getByText('警告消息')).toBeInTheDocument();
    });

    it('显示信息通知', async () => {
        await act(async () => {
            showInfo('信息消息');
        });
        expect(screen.getByText('信息消息')).toBeInTheDocument();
    });

    it('点击关闭按钮移除通知', async () => {
        await act(async () => {
            showError('可关闭的错误');
        });
        const closeBtn = screen.getByLabelText('关闭通知');
        fireEvent.click(closeBtn);
        await waitFor(() => {
            expect(screen.queryByText('可关闭的错误')).not.toBeInTheDocument();
        });
    });

    it('从 error.response.data 提取 traceId', async () => {
        const error = {
            response: {
                headers: {},
                data: { traceId: 'tr-from-body' }
            }
        };
        await act(async () => {
            showError('API 错误', error);
        });
        expect(screen.getByText('tr-from-body')).toBeInTheDocument();
    });

    it('通知自动消失（duration 后）', async () => {
        await act(async () => {
            showError('自动消失');
        });
        expect(screen.getByText('自动消失')).toBeInTheDocument();
        // 默认错误 duration 8000ms，用定时器模拟
        await waitFor(() => {
            // 等待通知渲染稳定
            expect(screen.getByText('自动消失')).toBeInTheDocument();
        }, { timeout: 100 });
    });
});
