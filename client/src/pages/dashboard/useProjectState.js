import { useState, useCallback } from 'react';
import useAppStore from '../../store/useAppStore';
import { projectsApi, chaptersApi, materialsApi } from '../../services/api';
import logger from '../../shared/logger';
import { STATUS_VALUES } from '../pipeline/pipelineConstants';

export default function useProjectState() {
    const projects = useAppStore(s => s.projects) || [];
    const setProjects = useAppStore(s => s.setProjects);
    const setCurrentProject = useAppStore(s => s.setCurrentProject);
    const currentProject = useAppStore(s => s.currentProject);
    const setChapters = useAppStore(s => s.setChapters);
    const setMaterials = useAppStore(s => s.setMaterials);
    const chapters = useAppStore(s => s.chapters) || [];
    const materials = useAppStore(s => s.materials) || [];
    const activeModule = useAppStore(s => s.activeModule);
    const setActiveModule = useAppStore(s => s.setActiveModule);

    const [errorMsg, setErrorMsg] = useState(null);

    const showError = useCallback((msg, duration = 5000) => {
        setErrorMsg(msg);
        setTimeout(() => setErrorMsg(null), duration);
    }, []);

    const selectProject = useCallback(async (project) => {
        try {
            const freshRes = await projectsApi.get(project.id);
            setCurrentProject(freshRes.data);
            setActiveModule('novel');
        } catch {
            setCurrentProject(project);
            setActiveModule('novel');
        }
        try {
            const [chRes, matRes] = await Promise.all([
                chaptersApi.list({ projectId: project.id }).catch(() => ({ data: [] })),
                materialsApi.list({ projectId: project.id }).catch(() => ({ data: [] }))
            ]);
            setChapters(chRes.data || []);
            setMaterials(matRes.data || []);
        } catch (e) { logger.error('Project', 'Load chapters/materials failed:', e.message); }
    }, [setCurrentProject, setActiveModule, setChapters, setMaterials]);

    const loadProjects = useCallback(async () => {
        try {
            const res = await projectsApi.list();
            const list = res.data || [];
            setProjects(list);
            // 自动选中：当currentProject为null且项目列表非空时，选中第一个项目
            if (!useAppStore.getState().currentProject && list.length > 0) {
                selectProject(list[0]);
            }
            // 陷阱#19修复：项目列表为空时必须告警，区分"真空"和"读取失败"
            // 之前 catch 静默吞错 + 空数组不提示，导致 PG 降级后前端无任何告警
            if (list.length === 0) {
                showError('项目列表为空 — 可能是数据库降级或读取失败，请检查 /api/health 的 degraded 字段', 8000);
            }
        } catch (e) {
            // 陷阱#19修复：loadProjects 失败必须显示给用户，不能只 logger.error
            // 之前只打日志，用户在 UI 上完全看不到错误
            logger.error('Project', 'Load projects failed:', e.message);
            showError('加载项目列表失败: ' + (e.message || '未知错误') + ' — 请检查后端服务状态', 8000);
        }
    }, [setProjects, selectProject, showError]);

    const deleteProject = useCallback(async (e, id) => {
        e.stopPropagation();
        if (!confirm('确定删除此产品？')) return;
        try {
            await projectsApi.delete(id);
            if (currentProject?.id === id) setCurrentProject(null);
            loadProjects();
        } catch (err) {
            showError('删除失败: ' + (err.message || '未知错误'));
        }
    }, [currentProject, setCurrentProject, loadProjects, showError]);

    const totalChapters = chapters.length;
    const approvedChapters = chapters.filter(c => c.status === STATUS_VALUES.MATERIAL_UPDATED).length;
    const totalMaterials = materials.length;

    const modeFilteredProjects = activeModule === 'comic'
        ? projects
        : projects;

    const standaloneProjects = modeFilteredProjects.filter(p => !p.franchiseId);
    const franchiseProjects = modeFilteredProjects.filter(p => p.franchiseId);

    return {
        projects, currentProject, chapters, materials, activeModule,
        errorMsg, showError, setErrorMsg,
        loadProjects, selectProject, deleteProject,
        totalChapters, approvedChapters, totalMaterials,
        modeFilteredProjects, standaloneProjects, franchiseProjects,
        setProjects, setCurrentProject, setChapters, setMaterials
    };
}
