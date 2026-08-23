import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../../components/Header';
import useAppStore from '../../store/useAppStore';
import { act } from '@testing-library/react';

function renderWithRouter(ui, { initialEntries = ['/'] } = {}) {
    return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

describe('Header', () => {
    beforeEach(() => {
        act(() => {
            useAppStore.setState({
                currentProject: null,
                pipelineState: { running: false, currentStep: null, currentRound: 1, maxRounds: 3, logs: [], chapterId: null }
            });
        });
    });

    test('renders page title for known path', () => {
        renderWithRouter(<Header />, { initialEntries: ['/pipeline'] });
        expect(screen.getByText('流水线控制台')).toBeInTheDocument();
    });

    test('renders default title for unknown path', () => {
        renderWithRouter(<Header />, { initialEntries: ['/unknown'] });
        expect(screen.getByText('NOVEL PIPELINE')).toBeInTheDocument();
    });

    test('shows project name when currentProject is set', () => {
        act(() => {
            useAppStore.setState({ currentProject: { id: '1', name: 'My Novel' } });
        });
        renderWithRouter(<Header />);
        expect(screen.getByText(/My Novel/)).toBeInTheDocument();
    });

    test('shows pipeline running indicator', () => {
        act(() => {
            useAppStore.setState({
                pipelineState: { running: true, currentStep: 'writer', currentRound: 2, maxRounds: 3, logs: [], chapterId: null }
            });
        });
        renderWithRouter(<Header />);
        expect(screen.getByText(/流水线运行中/)).toBeInTheDocument();
    });

    test('renders guide and pipeline buttons', () => {
        renderWithRouter(<Header />);
        expect(screen.getByText('操作指南')).toBeInTheDocument();
        expect(screen.getByText('启动流水线')).toBeInTheDocument();
    });
});
