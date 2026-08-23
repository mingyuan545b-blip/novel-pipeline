import { useState, useEffect, useCallback } from 'react';
import { pipelineApi, chaptersApi, materialsApi } from '../../services/api';
import useProjectState from './useProjectState';
import useFranchiseState from './useFranchiseState';
import useFlavorState from './useFlavorState';
import useLayoutState from './useLayoutState';
import useStyleAndConstraintsState from './useStyleAndConstraintsState';
import useWorldviewProfileState from './useWorldviewProfileState';

export default function useDashboardState() {
    const project = useProjectState();
    const franchise = useFranchiseState({
        loadProjects: project.loadProjects,
        selectProject: project.selectProject,
        showError: project.showError,
        setProjects: project.setProjects
    });
    const flavor = useFlavorState({
        currentProject: project.currentProject,
        setProjects: project.setProjects,
        showError: project.showError
    });
    const layout = useLayoutState();
    const styleConstraints = useStyleAndConstraintsState({
        currentProject: project.currentProject,
        setProjects: project.setProjects,
        showError: project.showError
    });
    const worldviewProfile = useWorldviewProfileState({
        currentProject: project.currentProject,
        setProjects: project.setProjects,
        showError: project.showError
    });

    const [showCreate, setShowCreate] = useState(false);
    const [genLoading, setGenLoading] = useState({ materials: false, outlines: false });
    const [prompt, setPrompt] = useState('');

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        project.loadProjects();
        franchise.loadFranchises();
        styleConstraints.loadConstraintPresets();
        flavor.loadFlavorOptions();
    }, []);

    useEffect(() => {
        styleConstraints.loadStyleTemplate();
    }, [project.currentProject?.styleTemplateId]);
    /* eslint-enable react-hooks/exhaustive-deps */

    const generateMaterials = useCallback(async () => {
        if (!project.currentProject) return;
        setGenLoading(prev => ({ ...prev, materials: true }));
        project.setErrorMsg(null);
        try {
            await pipelineApi.generateMaterials({
                projectId: project.currentProject.id,
                prompt: prompt || `请为《${project.currentProject.name}》生成完整的素材库，包括世界观、主要人物、装备、战力体系、人物关系等。类型：${project.currentProject.genre}，描述：${project.currentProject.description}`
            });
            const matRes = await materialsApi.list({ projectId: project.currentProject.id }).catch(() => ({ data: project.materials }));
            project.setMaterials(matRes.data || []);
        } catch (e) {
            project.showError('素材生成失败: ' + (e.message || '未知错误'));
        } finally { setGenLoading(prev => ({ ...prev, materials: false })); }
    }, [project.currentProject, prompt, project.materials, project.setMaterials, project.showError, project.setErrorMsg]); // eslint-disable-line react-hooks/exhaustive-deps

    const generateOutlines = useCallback(async () => {
        if (!project.currentProject) return;
        setGenLoading(prev => ({ ...prev, outlines: true }));
        project.setErrorMsg(null);
        try {
            const res = await pipelineApi.generateOutlines({
                projectId: project.currentProject.id,
                prompt: prompt || `请为《${project.currentProject.name}》规划章节大纲，共${project.currentProject.targetChapters}章。`
            });
            if (res.data && res.data.error && res.data.count === 0) {
                project.showError('大纲生成失败: ' + res.data.error + (res.data.raw ? '\n\nAI原始输出: ' + res.data.raw.substring(0, 300) : ''));
            } else {
                const chRes = await chaptersApi.list({ projectId: project.currentProject.id }).catch(() => ({ data: project.chapters }));
                project.setChapters(chRes.data || []);
            }
        } catch (e) { project.showError('大纲生成失败: ' + (e.message || '未知错误')); }
        finally { setGenLoading(prev => ({ ...prev, outlines: false })); }
    }, [project.currentProject, prompt, project.chapters, project.setChapters, project.showError, project.setErrorMsg]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        ...project, ...franchise, ...flavor, ...layout, ...styleConstraints, ...worldviewProfile,
        showCreate, setShowCreate, genLoading, prompt, setPrompt,
        generateMaterials, generateOutlines
    };
}
