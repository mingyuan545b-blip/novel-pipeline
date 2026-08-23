import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import useAppStore from '../../store/useAppStore';
import { act } from '@testing-library/react';

vi.mock('../../services/api', () => ({
    settingsApi: { get: vi.fn(() => Promise.resolve({ data: { hasKey: true } })) },
    comicApi: { getComfyUIStatus: vi.fn(() => Promise.resolve({ data: { running: false } })) },
}));

function renderWithRouter(ui, { initialEntries = ['/'] } = {}) {
    return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('Sidebar', () => {
    beforeEach(() => {
        act(() => {
            useAppStore.setState({
                currentProject: null,
                activeModule: 'novel',
                sidebarCollapsed: false
            });
        });
        vi.clearAllMocks();
    });

    test('renders logo text', () => {
        renderWithRouter(<Sidebar />);
        expect(screen.getByText('NOVEL PIPELINE')).toBeInTheDocument();
    });

    test('renders novel nav items by default', () => {
        renderWithRouter(<Sidebar />);
        expect(screen.getByText('仪表盘')).toBeInTheDocument();
        expect(screen.getByText('流水线')).toBeInTheDocument();
        expect(screen.getByText('素材库')).toBeInTheDocument();
    });

    test('renders system nav items', () => {
        renderWithRouter(<Sidebar />);
        expect(screen.getByText('系统设置')).toBeInTheDocument();
        expect(screen.getByText('Agent配置')).toBeInTheDocument();
    });

    test('renders module switch buttons', () => {
        renderWithRouter(<Sidebar />);
        expect(screen.getByText('长篇')).toBeInTheDocument();
    });

    test('shows LLM status', async () => {
        renderWithRouter(<Sidebar />);
        expect(screen.getByText(/LLM/)).toBeInTheDocument();
    });

    test('shows project name when currentProject is set', () => {
        act(() => {
            useAppStore.setState({ currentProject: { id: '1', name: 'Test Novel' } });
        });
        renderWithRouter(<Sidebar />);
        expect(screen.getByText(/Test Novel/)).toBeInTheDocument();
    });
});
