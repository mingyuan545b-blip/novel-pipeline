import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn().mockReturnValue({ data: null, isLoading: false }),
    useMutation: vi.fn((_opts) => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isLoading: false })),
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../services/api', () => ({
    pipelineApi: {
        getAgents: vi.fn().mockResolvedValue({ data: [] }),
        getOutputPaths: vi.fn().mockResolvedValue({ data: {} }),
        getChapterImages: vi.fn().mockResolvedValue({ data: [] }),
        getContextBudget: vi.fn().mockResolvedValue({ data: {} }),
        getInjectionMap: vi.fn().mockResolvedValue({ data: {} }),
        getHookBudget: vi.fn().mockResolvedValue({ data: {} }),
        getRuleStack: vi.fn().mockResolvedValue({ data: {} }),
        getChapterIntent: vi.fn().mockResolvedValue({ data: {} }),
        getPromptAudit: vi.fn().mockResolvedValue({ data: {} }),
        getAgentModelConfig: vi.fn().mockResolvedValue({ data: {} }),
        saveAgentModelConfig: vi.fn().mockResolvedValue({ data: {} }),
        getChapterAuditData: vi.fn().mockResolvedValue({ data: {} }),
        getRepairModels: vi.fn().mockResolvedValue({ data: [] }),
        getContextTrace: vi.fn().mockResolvedValue({ data: {} }),
        getLatestPromptAudit: vi.fn().mockResolvedValue({ data: {} }),
    },
    optimizerApi: {
        report: vi.fn().mockResolvedValue({ data: {} }),
        apply: vi.fn().mockResolvedValue({ data: {} }),
        suggestion: vi.fn().mockResolvedValue({ data: {} }),
    },
    projectsApi: {
        getAgentModelConfig: vi.fn().mockResolvedValue({ data: {} }),
        saveAgentModelConfig: vi.fn().mockResolvedValue({ data: {} }),
    },
}));

vi.mock('./usePipelineStatus', () => ({
    PIPELINE_KEYS: {
        all: ['pipeline'],
        agents: vi.fn().mockReturnValue(['pipeline', 'agents']),
        outputPaths: vi.fn().mockReturnValue(['pipeline', 'output-paths']),
        chapterImages: vi.fn().mockReturnValue(['pipeline', 'chapter-images']),
        contextBudget: vi.fn().mockReturnValue(['pipeline', 'context-budget']),
        injectionMap: vi.fn().mockReturnValue(['pipeline', 'injection-map']),
        hookBudget: vi.fn().mockReturnValue(['pipeline', 'hook-budget']),
        ruleStack: vi.fn().mockReturnValue(['pipeline', 'rule-stack']),
        chapterIntent: vi.fn().mockReturnValue(['pipeline', 'chapter-intent']),
        promptAudit: vi.fn().mockReturnValue(['pipeline', 'prompt-audit']),
        optimizer: vi.fn().mockReturnValue(['pipeline', 'optimizer']),
        agentModelConfig: vi.fn().mockReturnValue(['pipeline', 'agent-model-config']),
        auditData: vi.fn().mockReturnValue(['pipeline', 'audit-data']),
        repairModels: vi.fn().mockReturnValue(['pipeline', 'repair-models']),
    },
}));

describe('usePipelineTools', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    test('usePipelineAgents returns query', async () => {
        const { usePipelineAgents } = await import('../../hooks/queries/usePipelineTools');
        const result = usePipelineAgents();
        expect(result).toHaveProperty('data');
    });

    test('usePipelineOutputPaths returns query', async () => {
        const { usePipelineOutputPaths } = await import('../../hooks/queries/usePipelineTools');
        const result = usePipelineOutputPaths('p1');
        expect(result).toHaveProperty('data');
    });

    test('useChapterImages returns query', async () => {
        const { useChapterImages } = await import('../../hooks/queries/usePipelineTools');
        const result = useChapterImages('p1', 'ch1');
        expect(result).toHaveProperty('data');
    });

    test('usePipelineContextBudget returns query', async () => {
        const { usePipelineContextBudget } = await import('../../hooks/queries/usePipelineTools');
        const result = usePipelineContextBudget('p1');
        expect(result).toHaveProperty('data');
    });

    test('usePipelineInjectionMap returns query', async () => {
        const { usePipelineInjectionMap } = await import('../../hooks/queries/usePipelineTools');
        const result = usePipelineInjectionMap('p1');
        expect(result).toHaveProperty('data');
    });

    test('usePipelineHookBudget returns query', async () => {
        const { usePipelineHookBudget } = await import('../../hooks/queries/usePipelineTools');
        const result = usePipelineHookBudget('p1');
        expect(result).toHaveProperty('data');
    });

    test('usePipelineRuleStack returns query', async () => {
        const { usePipelineRuleStack } = await import('../../hooks/queries/usePipelineTools');
        const result = usePipelineRuleStack('p1');
        expect(result).toHaveProperty('data');
    });

    test('usePipelineChapterIntent returns query', async () => {
        const { usePipelineChapterIntent } = await import('../../hooks/queries/usePipelineTools');
        const result = usePipelineChapterIntent('p1', 1);
        expect(result).toHaveProperty('data');
    });

    test('usePipelinePromptAudit returns query', async () => {
        const { usePipelinePromptAudit } = await import('../../hooks/queries/usePipelineTools');
        const result = usePipelinePromptAudit('p1');
        expect(result).toHaveProperty('data');
    });

    test('usePipelineOptimizer returns query', async () => {
        const { usePipelineOptimizer } = await import('../../hooks/queries/usePipelineTools');
        const result = usePipelineOptimizer('p1');
        expect(result).toHaveProperty('data');
    });

    test('usePipelineApplyOptimizer returns mutation', async () => {
        const { usePipelineApplyOptimizer } = await import('../../hooks/queries/usePipelineTools');
        const result = usePipelineApplyOptimizer();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('usePipelineAgentModelConfig returns query', async () => {
        const { usePipelineAgentModelConfig } = await import('../../hooks/queries/usePipelineTools');
        const result = usePipelineAgentModelConfig('p1');
        expect(result).toHaveProperty('data');
    });

    test('useSaveAgentModelConfig returns mutation', async () => {
        const { useSaveAgentModelConfig } = await import('../../hooks/queries/usePipelineTools');
        const result = useSaveAgentModelConfig('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useChapterAuditData returns query', async () => {
        const { useChapterAuditData } = await import('../../hooks/queries/usePipelineTools');
        const result = useChapterAuditData('p1');
        expect(result).toHaveProperty('data');
    });

    test('useRepairModels returns query', async () => {
        const { useRepairModels } = await import('../../hooks/queries/usePipelineTools');
        const result = useRepairModels();
        expect(result).toHaveProperty('data');
    });

    test('useGetAgentModelConfig returns query', async () => {
        const { useGetAgentModelConfig } = await import('../../hooks/queries/usePipelineTools');
        const result = useGetAgentModelConfig('p1');
        expect(result).toHaveProperty('data');
    });

    test('useSaveAgentModelConfigFromProjects returns mutation', async () => {
        const { useSaveAgentModelConfigFromProjects } = await import('../../hooks/queries/usePipelineTools');
        const result = useSaveAgentModelConfigFromProjects('p1');
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useGetContextTrace returns query', async () => {
        const { useGetContextTrace } = await import('../../hooks/queries/usePipelineTools');
        const result = useGetContextTrace('p1', 1);
        expect(result).toHaveProperty('data');
    });

    test('useGetLatestPromptAudit returns query', async () => {
        const { useGetLatestPromptAudit } = await import('../../hooks/queries/usePipelineTools');
        const result = useGetLatestPromptAudit();
        expect(result).toHaveProperty('data');
    });

    test('useRunOptimizerReport returns mutation', async () => {
        const { useRunOptimizerReport } = await import('../../hooks/queries/usePipelineTools');
        const result = useRunOptimizerReport();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useApplyOptimizerPattern returns mutation', async () => {
        const { useApplyOptimizerPattern } = await import('../../hooks/queries/usePipelineTools');
        const result = useApplyOptimizerPattern();
        expect(result.mutateAsync).toBeTypeOf('function');
    });

    test('useOptimizerSuggestion returns query', async () => {
        const { useOptimizerSuggestion } = await import('../../hooks/queries/usePipelineTools');
        const result = useOptimizerSuggestion('p1', 'pat1');
        expect(result).toHaveProperty('data');
    });
});
