import { create } from 'zustand';

const savedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('app-theme') || 'aurora' : 'aurora';
const savedBgImage = typeof localStorage !== 'undefined' ? localStorage.getItem('app-bg-image') || '' : '';
const savedBgOpacity = typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('app-bg-opacity') || '1') : 1;
const savedBgBlur = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('app-bg-blur') || '0') : 0;

const useAppStore = create((set, get) => ({
    currentProject: null,
    projects: [],
    chapters: [],
    materials: [],
    reviews: [],
    agents: [],
    settings: { hasKey: false },
    pipelineState: {
        running: false,
        currentStep: null,
        currentRound: 1,
        maxRounds: 3,
        logs: [],
        chapterId: null
    },
    sidebarCollapsed: false,
    activePage: '/',
    activeModule: 'novel',
    theme: savedTheme,
    bgImage: savedBgImage,
    bgOpacity: savedBgOpacity,
    bgBlur: savedBgBlur,
    modals: {
        createProject: false,
        editMaterial: false,
        editAgent: false,
        runPipeline: false
    },
    editingItem: null,
    loading: {},

    comicConfig: null,
    comicWorkflows: [],
    comicStoryboards: [],
    comicRenderQueue: [],
    membership: { level: 'free', licensed: false },
    updateInfo: null,

    setCurrentProject: (project) => set({ currentProject: project }),
    setProjects: (projects) => set({ projects }),
    setChapters: (chapters) => set({ chapters }),
    setMaterials: (materials) => set({ materials }),
    setReviews: (reviews) => set({ reviews }),
    setAgents: (agents) => set({ agents }),
    setSettings: (settings) => set({ settings }),
    setActivePage: (page) => set({ activePage: page }),
    setActiveModule: (mod) => set({ activeModule: mod }),

    setComicConfig: (config) => set({ comicConfig: config }),
    setComicWorkflows: (workflows) => set({ comicWorkflows: workflows }),
    setComicStoryboards: (storyboards) => set({ comicStoryboards: storyboards }),
    setComicRenderQueue: (queue) => set({ comicRenderQueue: queue }),

    setMembership: (membership) => set({ membership }),
    setUpdateInfo: (info) => set({ updateInfo: info }),

    setTheme: (theme) => {
        localStorage.setItem('app-theme', theme);
        set({ theme });
    },

    setBgImage: (bgImage) => {
        localStorage.setItem('app-bg-image', bgImage);
        set({ bgImage });
    },

    setBgOpacity: (bgOpacity) => {
        localStorage.setItem('app-bg-opacity', String(bgOpacity));
        set({ bgOpacity });
    },

    setBgBlur: (bgBlur) => {
        localStorage.setItem('app-bg-blur', String(bgBlur));
        set({ bgBlur });
    },

    setPipelineState: (state) => set((prev) => ({
        pipelineState: { ...prev.pipelineState, ...state }
    })),

    addPipelineLog: (log) => set((prev) => {
        const logs = [...prev.pipelineState.logs, log];
        return {
            pipelineState: {
                ...prev.pipelineState,
                logs: logs.length > 500 ? logs.slice(-500) : logs
            }
        };
    }),

    clearPipelineLogs: () => set((prev) => ({
        pipelineState: { ...prev.pipelineState, logs: [] }
    })),

    toggleModal: (modalName, open, item = null) => set((prev) => ({
        modals: { ...prev.modals, [modalName]: open },
        editingItem: item
    })),

    setLoading: (key, value) => set((prev) => ({
        loading: { ...prev.loading, [key]: value }
    })),

    toggleSidebar: () => set((prev) => ({ sidebarCollapsed: !prev.sidebarCollapsed }))
}));

export default useAppStore;
