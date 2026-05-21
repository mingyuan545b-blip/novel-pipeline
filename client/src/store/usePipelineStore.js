import { create } from 'zustand';

const usePipelineStore = create((set) => ({
    pipelineState: {
        running: false,
        currentStep: null,
        currentRound: 1,
        maxRounds: 3,
        logs: [],
        chapterId: null
    },

    setPipelineState: (state) => set((prev) => ({
        pipelineState: { ...prev.pipelineState, ...state }
    })),

    addPipelineLog: (log) => set((prev) => ({
        pipelineState: {
            ...prev.pipelineState,
            logs: [...prev.pipelineState.logs, log]
        }
    })),

    clearPipelineLogs: () => set((prev) => ({
        pipelineState: { ...prev.pipelineState, logs: [] }
    }))
}));

export default usePipelineStore;
