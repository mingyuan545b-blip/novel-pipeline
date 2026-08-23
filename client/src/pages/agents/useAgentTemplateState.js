import { useState } from 'react';
import { useAgentTemplates, useUpdateAgentTemplate } from '../../hooks/queries';

export function useAgentTemplateState() {
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [templateEditSystem, setTemplateEditSystem] = useState('');
    const [templateOriginal, setTemplateOriginal] = useState('');
    const [templateSaving, setTemplateSaving] = useState(false);

    const templatesQuery = useAgentTemplates();
    const templates = templatesQuery.data || [];
    const updateAgentTemplateMutation = useUpdateAgentTemplate(selectedTemplate?.id);

    const templateHasChanges = templateEditSystem !== templateOriginal;

    const selectTemplate = (tpl) => {
        setSelectedTemplate(tpl);
        setTemplateEditSystem(tpl.system || '');
        setTemplateOriginal(tpl.system || '');
    };

    const saveTemplate = async () => {
        if (!selectedTemplate) return;
        setTemplateSaving(true);
        try { await updateAgentTemplateMutation.mutateAsync({ ...selectedTemplate, system: templateEditSystem }); setTemplateOriginal(templateEditSystem); alert('模板已更新'); }
        catch (e) { alert('保存失败: ' + e.message); }
        finally { setTemplateSaving(false); }
    };

    return {
        selectedTemplate, templateEditSystem, setTemplateEditSystem,
        templateSaving, templateHasChanges, templates,
        selectTemplate, saveTemplate,
    };
}
