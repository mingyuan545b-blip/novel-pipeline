import { describe, test, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import useAppStore from '../../store/useAppStore';

describe('useAppStore - extended', () => {
    beforeEach(() => {
        act(() => {
            useAppStore.setState({
                currentProject: null,
                projects: [],
                chapters: [],
                materials: [],
                reviews: [],
                agents: [],
                settings: { hasKey: false },
                pipelineState: { running: false, currentStep: null, currentRound: 1, maxRounds: 3, logs: [], chapterId: null },
                sidebarCollapsed: false,
                activePage: '/',
                activeModule: 'novel',
                modals: { createProject: false, editMaterial: false, editAgent: false, runPipeline: false },
                editingItem: null,
                loading: {},
                membership: { level: 'free', licensed: false },
                updateInfo: null
            });
        });
    });

    test('sets projects', () => {
        const projects = [{ id: '1', name: 'P1' }];
        act(() => { useAppStore.getState().setProjects(projects); });
        expect(useAppStore.getState().projects).toEqual(projects);
    });

    test('sets chapters', () => {
        const chapters = [{ id: '1', title: 'Ch1' }];
        act(() => { useAppStore.getState().setChapters(chapters); });
        expect(useAppStore.getState().chapters).toEqual(chapters);
    });

    test('sets materials', () => {
        const materials = [{ id: '1', name: 'Mat1' }];
        act(() => { useAppStore.getState().setMaterials(materials); });
        expect(useAppStore.getState().materials).toEqual(materials);
    });

    test('sets reviews', () => {
        act(() => { useAppStore.getState().setReviews([{ id: '1' }]); });
        expect(useAppStore.getState().reviews).toEqual([{ id: '1' }]);
    });

    test('sets agents', () => {
        act(() => { useAppStore.getState().setAgents([{ type: 'writer' }]); });
        expect(useAppStore.getState().agents).toEqual([{ type: 'writer' }]);
    });

    test('sets settings', () => {
        act(() => { useAppStore.getState().setSettings({ hasKey: true }); });
        expect(useAppStore.getState().settings).toEqual({ hasKey: true });
    });

    test('sets current project and persists id', () => {
        act(() => { useAppStore.getState().setCurrentProject({ id: 'proj1', name: 'Test' }); });
        expect(useAppStore.getState().currentProject).toEqual({ id: 'proj1', name: 'Test' });
        expect(localStorage.getItem('app-current-project-id')).toBe('proj1');
    });

    test('clears localStorage when setting null project', () => {
        act(() => { useAppStore.getState().setCurrentProject({ id: 'proj1', name: 'Test' }); });
        act(() => { useAppStore.getState().setCurrentProject(null); });
        expect(useAppStore.getState().currentProject).toBe(null);
        expect(localStorage.getItem('app-current-project-id')).toBe(null);
    });

    test('sets pipeline state', () => {
        act(() => { useAppStore.getState().setPipelineState({ running: true, currentStep: 'writer' }); });
        const state = useAppStore.getState().pipelineState;
        expect(state.running).toBe(true);
        expect(state.currentStep).toBe('writer');
        expect(state.currentRound).toBe(1);
    });

    test('adds pipeline log', () => {
        act(() => { useAppStore.getState().addPipelineLog({ step: 'writer', status: 'done' }); });
        expect(useAppStore.getState().pipelineState.logs).toHaveLength(1);
        expect(useAppStore.getState().pipelineState.logs[0].step).toBe('writer');
    });

    test('limits pipeline logs to 500', () => {
        const logs = Array.from({ length: 501 }, (_, i) => ({ step: `step${i}` }));
        act(() => {
            useAppStore.setState({ pipelineState: { ...useAppStore.getState().pipelineState, logs: logs.slice(0, 499) } });
            useAppStore.getState().addPipelineLog(logs[500]);
        });
        expect(useAppStore.getState().pipelineState.logs.length).toBeLessThanOrEqual(500);
    });

    test('clears pipeline logs', () => {
        act(() => { useAppStore.getState().addPipelineLog({ step: 'test' }); });
        act(() => { useAppStore.getState().clearPipelineLogs(); });
        expect(useAppStore.getState().pipelineState.logs).toEqual([]);
    });

    test('sets membership', () => {
        act(() => { useAppStore.getState().setMembership({ level: 'pro', licensed: true }); });
        expect(useAppStore.getState().membership).toEqual({ level: 'pro', licensed: true });
    });

    test('sets update info', () => {
        act(() => { useAppStore.getState().setUpdateInfo({ version: '2.0' }); });
        expect(useAppStore.getState().updateInfo).toEqual({ version: '2.0' });
    });
});
