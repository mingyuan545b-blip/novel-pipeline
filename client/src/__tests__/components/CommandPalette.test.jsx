import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommandPalette from '../../components/CommandPalette';
import useAppStore from '../../store/useAppStore';

function renderPalette() {
    return render(
        <MemoryRouter initialEntries={['/']}>
            <CommandPalette />
        </MemoryRouter>
    );
}

describe('CommandPalette', () => {
    beforeEach(() => {
        act(() => {
            useAppStore.setState({ paletteOpen: false, theme: 'aurora', sidebarCollapsed: false });
        });
    });

    test('hidden when paletteOpen is false', () => {
        renderPalette();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('shows nav items and filters by query', () => {
        act(() => { useAppStore.setState({ paletteOpen: true }); });
        renderPalette();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('章节管理')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox'), { target: { value: '皮肤' } });
        expect(screen.queryByText('章节管理')).not.toBeInTheDocument();
        expect(screen.getByText('切换皮肤：马里奥')).toBeInTheDocument();
    });

    test('clicking theme action switches theme', () => {
        act(() => { useAppStore.setState({ paletteOpen: true }); });
        renderPalette();
        fireEvent.click(screen.getByText('切换皮肤：马里奥'));
        expect(useAppStore.getState().theme).toBe('mario');
        expect(useAppStore.getState().paletteOpen).toBe(false);
    });

    test('escape closes palette', () => {
        act(() => { useAppStore.setState({ paletteOpen: true }); });
        renderPalette();
        fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
        expect(useAppStore.getState().paletteOpen).toBe(false);
    });
});
