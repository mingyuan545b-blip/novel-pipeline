import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn().mockReturnValue({ data: null, isLoading: false }),
    useMutation: vi.fn((_opts) => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isLoading: false })),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../services/api', () => ({
    projectsApi: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        get: vi.fn().mockResolvedValue({ data: {} }),
        create: vi.fn().mockResolvedValue({ data: {} }),
        update: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        getConstraints: vi.fn().mockResolvedValue({ data: {} }),
        getRemediationStatus: vi.fn().mockResolvedValue({ data: {} }),
        getCleanupStats: vi.fn().mockResolvedValue({ data: {} }),
        getAgentModelConfig: vi.fn().mockResolvedValue({ data: {} }),
        saveAgentModelConfig: vi.fn().mockResolvedValue({ data: {} }),
        cleanup: vi.fn().mockResolvedValue({ data: {} }),
        updateStyleGuidance: vi.fn().mockResolvedValue({ data: {} }),
        remediate: vi.fn().mockResolvedValue({ data: {} }),
        deleteRemediation: vi.fn().mockResolvedValue({ data: {} }),
        analyzeStyle: vi.fn().mockResolvedValue({ data: {} }),
    },
}));

describe('useProjects hooks', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('PROJECT_KEYS has expected structure', async () => {
        const { PROJECT_KEYS } = await import('../../hooks/queries/useProjects');
        expect(PROJECT_KEYS.all).toEqual(['projects']);
        expect(PROJECT_KEYS.lists()).toContain('list');
        expect(PROJECT_KEYS.detail('p1')).toContain('p1');
        expect(PROJECT_KEYS.constraints()).toContain('constraints');
    });

    test('useProjects returns query result', async () => {
        const { useProjects } = await import('../../hooks/queries/useProjects');
        const result = useProjects();
        expect(result).toHaveProperty('data');
    });

    test('useProject returns query result', async () => {
        const { useProject } = await import('../../hooks/queries/useProjects');
        const result = useProject('p1');
        expect(result).toHaveProperty('data');
    });

    test('useCreateProject returns mutation', async () => {
        const { useCreateProject } = await import('../../hooks/queries/useProjects');
        const result = useCreateProject();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useUpdateProject returns mutation', async () => {
        const { useUpdateProject } = await import('../../hooks/queries/useProjects');
        const result = useUpdateProject('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useDeleteProject returns mutation', async () => {
        const { useDeleteProject } = await import('../../hooks/queries/useProjects');
        const result = useDeleteProject();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useProjectConstraints returns query', async () => {
        const { useProjectConstraints } = await import('../../hooks/queries/useProjects');
        const result = useProjectConstraints();
        expect(result).toHaveProperty('data');
    });

    test('useProjectRemediationStatus returns query', async () => {
        const { useProjectRemediationStatus } = await import('../../hooks/queries/useProjects');
        const result = useProjectRemediationStatus('p1');
        expect(result).toHaveProperty('data');
    });

    test('useProjectCleanupStats returns query', async () => {
        const { useProjectCleanupStats } = await import('../../hooks/queries/useProjects');
        const result = useProjectCleanupStats('p1');
        expect(result).toHaveProperty('data');
    });

    test('useProjectAgentModelConfig returns query', async () => {
        const { useProjectAgentModelConfig } = await import('../../hooks/queries/useProjects');
        const result = useProjectAgentModelConfig('p1');
        expect(result).toHaveProperty('data');
    });

    test('useSaveAgentModelConfig returns mutation', async () => {
        const { useSaveAgentModelConfig } = await import('../../hooks/queries/useProjects');
        const result = useSaveAgentModelConfig('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useProjectCleanup returns mutation', async () => {
        const { useProjectCleanup } = await import('../../hooks/queries/useProjects');
        const result = useProjectCleanup('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useProjectStyleGuidance returns mutation', async () => {
        const { useProjectStyleGuidance } = await import('../../hooks/queries/useProjects');
        const result = useProjectStyleGuidance('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useProjectRemediate returns mutation', async () => {
        const { useProjectRemediate } = await import('../../hooks/queries/useProjects');
        const result = useProjectRemediate('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useDeleteProjectRemediation returns mutation', async () => {
        const { useDeleteProjectRemediation } = await import('../../hooks/queries/useProjects');
        const result = useDeleteProjectRemediation('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useAnalyzeStyle returns mutation', async () => {
        const { useAnalyzeStyle } = await import('../../hooks/queries/useProjects');
        const result = useAnalyzeStyle();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useRemediate returns mutation', async () => {
        const { useRemediate } = await import('../../hooks/queries/useProjects');
        const result = useRemediate();
        expect(result.mutateAsync).toBeTypeOf('function');
    });
});
