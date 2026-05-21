const store = require('../store');

class ContextTrace {
    constructor(projectId) {
        this.projectId = projectId;
    }

    _getTraceStore() {
        const project = store.getItem('projects', this.projectId);
        if (!project) return { chapters: {} };
        if (!project.contextTraces) {
            project.contextTraces = { chapters: {} };
            store.setItem('projects', this.projectId, project);
        }
        return project.contextTraces;
    }

    _saveTraceStore(data) {
        const project = store.getItem('projects', this.projectId);
        if (!project) return;
        project.contextTraces = data;
        store.setItem('projects', this.projectId, project);
    }

    recordChapterTrace(chapterNumber, traceData) {
        const traceStore = this._getTraceStore();

        const trace = {
            chapter: chapterNumber,
            timestamp: new Date().toISOString(),
            plannerInputs: traceData.plannerInputs || [],
            selectedContext: traceData.selectedContext || [],
            selectedSources: traceData.selectedSources || [],
            composerInputs: traceData.composerInputs || [],
            notes: traceData.notes || [],
            budgetAllocation: traceData.budgetAllocation || null,
            ruleStackSnapshot: traceData.ruleStackSnapshot || null,
            hookBudgetSnapshot: traceData.hookBudgetSnapshot || null
        };

        traceStore.chapters[`chapter-${String(chapterNumber).padStart(4, '0')}`] = trace;
        this._saveTraceStore(traceStore);
        return trace;
    }

    addContextSelection(chapterNumber, selection) {
        const traceStore = this._getTraceStore();
        const key = `chapter-${String(chapterNumber).padStart(4, '0')}`;

        if (!traceStore.chapters[key]) {
            traceStore.chapters[key] = {
                chapter: chapterNumber,
                timestamp: new Date().toISOString(),
                selectedContext: [],
                selectedSources: [],
                notes: []
            };
        }

        traceStore.chapters[key].selectedContext.push({
            source: selection.source || '',
            reason: selection.reason || '',
            excerpt: (selection.excerpt || '').substring(0, 150),
            tokenEstimate: selection.tokenEstimate || 0,
            priority: selection.priority || 'normal'
        });

        if (selection.source && !traceStore.chapters[key].selectedSources.includes(selection.source)) {
            traceStore.chapters[key].selectedSources.push(selection.source);
        }

        this._saveTraceStore(traceStore);
    }

    getChapterTrace(chapterNumber) {
        const traceStore = this._getTraceStore();
        const key = `chapter-${String(chapterNumber).padStart(4, '0')}`;
        return traceStore.chapters[key] || null;
    }

    getAllTraces() {
        const traceStore = this._getTraceStore();
        return traceStore.chapters;
    }

    formatTraceForPrompt(chapterNumber) {
        const trace = this.getChapterTrace(chapterNumber);
        if (!trace) return '';

        const lines = [];
        lines.push(`【第${chapterNumber}章 上下文选择记录】`);
        lines.push('');

        if (trace.selectedContext && trace.selectedContext.length > 0) {
            lines.push('### 选中的上下文');
            for (const ctx of trace.selectedContext) {
                lines.push(`- 来源: ${ctx.source}`);
                lines.push(`  原因: ${ctx.reason}`);
                lines.push(`  摘要: ${ctx.excerpt}`);
                if (ctx.priority) lines.push(`  优先级: ${ctx.priority}`);
            }
        }

        if (trace.budgetAllocation) {
            lines.push('');
            lines.push('### 预算分配');
            for (const [slot, info] of Object.entries(trace.budgetAllocation)) {
                lines.push(`- ${slot}: ${info.used || 0}/${info.budget || '?'} tokens`);
            }
        }

        return lines.join('\n');
    }

    getContextSelectionReasoning(chapterNumber) {
        const trace = this.getChapterTrace(chapterNumber);
        if (!trace || !trace.selectedContext) return [];

        return trace.selectedContext.map(ctx => ({
            source: ctx.source,
            reason: ctx.reason,
            excerpt: ctx.excerpt
        }));
    }
}

function getContextTraceForProject(projectId) {
    return new ContextTrace(projectId);
}

module.exports = {
    ContextTrace,
    getContextTraceForProject
};
