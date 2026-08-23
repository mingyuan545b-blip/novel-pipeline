import useAppStore from '../store/useAppStore';
import { act } from '@testing-library/react';

describe('useAppStore', () => {
    beforeEach(() => {
        act(() => {
            useAppStore.setState({
                currentProject: null,
                sidebarCollapsed: false,
                activePage: '/',
                activeModule: 'novel',
                modals: {
                    createProject: false,
                    editMaterial: false,
                    editAgent: false,
                    runPipeline: false
                },
                editingItem: null,
                loading: {}
            });
        });
    });

    test('should have correct initial state', () => {
        const state = useAppStore.getState();
        expect(state.currentProject).toBe(null);
        expect(state.sidebarCollapsed).toBe(false);
        expect(state.activePage).toBe('/');
        expect(state.activeModule).toBe('novel');
    });

    test('should set current project', () => {
        act(() => {
            useAppStore.getState().setCurrentProject({ id: 'proj1', name: 'Test Project' });
        });
        expect(useAppStore.getState().currentProject).toEqual({ id: 'proj1', name: 'Test Project' });
    });

    test('should set active page', () => {
        act(() => {
            useAppStore.getState().setActivePage('/pipeline');
        });
        expect(useAppStore.getState().activePage).toBe('/pipeline');
    });

    test('should set active module', () => {
        act(() => {
            useAppStore.getState().setActiveModule('comic');
        });
        expect(useAppStore.getState().activeModule).toBe('comic');
    });

    test('should toggle sidebar', () => {
        expect(useAppStore.getState().sidebarCollapsed).toBe(false);
        act(() => {
            useAppStore.getState().toggleSidebar();
        });
        expect(useAppStore.getState().sidebarCollapsed).toBe(true);
        act(() => {
            useAppStore.getState().toggleSidebar();
        });
        expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    });

    test('should toggle modal', () => {
        act(() => {
            useAppStore.getState().toggleModal('createProject', true);
        });
        expect(useAppStore.getState().modals.createProject).toBe(true);
        act(() => {
            useAppStore.getState().toggleModal('createProject', false);
        });
        expect(useAppStore.getState().modals.createProject).toBe(false);
    });

    test('should set editing item with modal', () => {
        const item = { id: 'mat1', name: 'Test Material' };
        act(() => {
            useAppStore.getState().toggleModal('editMaterial', true, item);
        });
        expect(useAppStore.getState().modals.editMaterial).toBe(true);
        expect(useAppStore.getState().editingItem).toEqual(item);
    });

    test('should set loading state', () => {
        act(() => {
            useAppStore.getState().setLoading('pipeline', true);
        });
        expect(useAppStore.getState().loading.pipeline).toBe(true);
        act(() => {
            useAppStore.getState().setLoading('pipeline', false);
        });
        expect(useAppStore.getState().loading.pipeline).toBe(false);
    });
});
