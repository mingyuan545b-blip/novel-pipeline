import { create } from 'zustand';

const savedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('app-theme') || 'aurora' : 'aurora';
const savedBgImage = typeof localStorage !== 'undefined' ? localStorage.getItem('app-bg-image') || '' : '';
const savedBgOpacity = typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem('app-bg-opacity') || '1') : 1;
const savedBgBlur = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('app-bg-blur') || '0') : 0;

const useUIStore = create((set) => ({
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

    setActivePage: (page) => set({ activePage: page }),
    setActiveModule: (mod) => set({ activeModule: mod }),
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
    toggleModal: (modalName, open, item = null) => set((prev) => ({
        modals: { ...prev.modals, [modalName]: open },
        editingItem: item
    })),
    setLoading: (key, value) => set((prev) => ({
        loading: { ...prev.loading, [key]: value }
    })),
    toggleSidebar: () => set((prev) => ({ sidebarCollapsed: !prev.sidebarCollapsed }))
}));

export default useUIStore;
