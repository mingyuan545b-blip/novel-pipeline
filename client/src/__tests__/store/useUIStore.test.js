import { describe, test, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import useUIStore from '../../store/useUIStore';

describe('useUIStore', () => {
    beforeEach(() => {
        act(() => {
            useUIStore.setState({
                sidebarCollapsed: false,
                activePage: '/',
                activeModule: 'novel',
                theme: 'aurora',
                bgImage: '',
                bgOpacity: 1,
                bgBlur: 0,
                modals: { createProject: false, editMaterial: false, editAgent: false, runPipeline: false },
                editingItem: null,
                loading: {}
            });
        });
    });

    test('has correct initial state', () => {
        const state = useUIStore.getState();
        expect(state.sidebarCollapsed).toBe(false);
        expect(state.activePage).toBe('/');
        expect(state.activeModule).toBe('novel');
        expect(state.theme).toBe('aurora');
    });

    test('sets active page', () => {
        act(() => { useUIStore.getState().setActivePage('/settings'); });
        expect(useUIStore.getState().activePage).toBe('/settings');
    });

    test('sets active module', () => {
        act(() => { useUIStore.getState().setActiveModule('comic'); });
        expect(useUIStore.getState().activeModule).toBe('comic');
    });

    test('toggles sidebar', () => {
        expect(useUIStore.getState().sidebarCollapsed).toBe(false);
        act(() => { useUIStore.getState().toggleSidebar(); });
        expect(useUIStore.getState().sidebarCollapsed).toBe(true);
        act(() => { useUIStore.getState().toggleSidebar(); });
        expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });

    test('sets theme and persists to localStorage', () => {
        act(() => { useUIStore.getState().setTheme('glass'); });
        expect(useUIStore.getState().theme).toBe('glass');
        expect(localStorage.getItem('app-theme')).toBe('glass');
    });

    test('toggles modal with editing item', () => {
        const item = { id: '1', name: 'Test' };
        act(() => { useUIStore.getState().toggleModal('editMaterial', true, item); });
        expect(useUIStore.getState().modals.editMaterial).toBe(true);
        expect(useUIStore.getState().editingItem).toEqual(item);
    });

    test('sets loading state', () => {
        act(() => { useUIStore.getState().setLoading('pipeline', true); });
        expect(useUIStore.getState().loading.pipeline).toBe(true);
    });

    test('sets bg image and persists', () => {
        act(() => { useUIStore.getState().setBgImage('test.jpg'); });
        expect(useUIStore.getState().bgImage).toBe('test.jpg');
        expect(localStorage.getItem('app-bg-image')).toBe('test.jpg');
    });

    test('sets bg opacity and persists', () => {
        act(() => { useUIStore.getState().setBgOpacity(0.5); });
        expect(useUIStore.getState().bgOpacity).toBe(0.5);
        expect(localStorage.getItem('app-bg-opacity')).toBe('0.5');
    });

    test('sets bg blur and persists', () => {
        act(() => { useUIStore.getState().setBgBlur(10); });
        expect(useUIStore.getState().bgBlur).toBe(10);
        expect(localStorage.getItem('app-bg-blur')).toBe('10');
    });
});
