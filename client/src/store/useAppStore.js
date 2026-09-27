/**
 * Zustand 全局状态 Store
 *
 * 架构说明：
 * - React Query 接管服务端数据（项目/章节/素材/Pipeline状态等）
 * - Zustand 保留 UI 状态（theme/modals/sidebar/membership/bgImage）
 * - 双写兼容期：React Query 获取数据后通过 getState().setXxx(data) 同步到 Zustand
 *
 * 存储的状态：
 * - currentProject: 当前选中的项目对象
 * - projects: 项目列表（双写，React Query 为主）
 * - chapters: 章节列表（双写，React Query 为主）
 * - materials: 素材列表（双写，React Query 为主）
 * - theme: 主题皮肤（aurora/glass/liquid/mario/ripple）
 * - bgImage/bgOpacity/bgBlur: 背景图片配置（localStorage 持久化）
 * - membership: 会员状态
 *
 * 文件位置：client/src/store/useAppStore.js
 * 依赖：zustand
 */
import { create } from 'zustand';

const savedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('app-theme') || 'aurora' : 'aurora';
const savedBgImage = typeof localStorage !== 'undefined' ? localStorage.getItem('app-bg-image') || '' : '';
const savedBgOpacity = typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('app-bg-opacity') || '1') : 1;
const savedBgBlur = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('app-bg-blur') || '0') : 0;
const _savedProjectId = typeof localStorage !== 'undefined' ? localStorage.getItem('app-current-project-id') || '' : '';

const useAppStore = create((set, _get) => ({
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
    sidebarCollapsed: typeof localStorage !== 'undefined' ? localStorage.getItem('app-sidebar-collapsed') === '1' : false,
    paletteOpen: false,
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

    setCurrentProject: (project) => {
        if (project?.id) {
            localStorage.setItem('app-current-project-id', project.id);
        } else {
            localStorage.removeItem('app-current-project-id');
        }
        set({ currentProject: project });
    },
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

    setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

    toggleSidebar: () => set((prev) => {
        const sidebarCollapsed = !prev.sidebarCollapsed;
        localStorage.setItem('app-sidebar-collapsed', sidebarCollapsed ? '1' : '0');
        return { sidebarCollapsed };
    })
}));

export default useAppStore;
