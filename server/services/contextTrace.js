const store = require('../store');
const { getDataContext } = require('./dataContext');


/** 装配记录存储集合（非专用表，走 kv_store；已在 dataStoreRegistry 注册级联删除） */
const ASSEMBLY_STORE = 'context-assemblies';
const chapterKey = (n) => `chapter-${String(n).padStart(4, '0')}`;
const assemblyId = (projectId, n, agentType) => `${projectId}_${chapterKey(n)}_${agentType}`;

class ContextTrace {
    constructor(projectId) {
        this.projectId = projectId;
    }

    async _getTraceStore() {
        const _ctCtx = await getDataContext(this.projectId);
        const project = await _ctCtx.getProject();
        if (!project) return { chapters: {} };
        if (!project.contextTraces) {
            project.contextTraces = { chapters: {} };
            await store.setItem('projects', this.projectId, project);
        }
        return project.contextTraces;
    }

    async _saveTraceStore(data) {
        const _ctsCtx = await getDataContext(this.projectId);
        const project = await _ctsCtx.getProject();
        if (!project) return;
        project.contextTraces = data;
        await store.setItem('projects', this.projectId, project);
    }

    async recordChapterTrace(chapterNumber, traceData) {
        const traceStore = await this._getTraceStore();

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
        await this._saveTraceStore(traceStore);
        return trace;
    }

    async addContextSelection(chapterNumber, selection) {
        const traceStore = await this._getTraceStore();
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

        await this._saveTraceStore(traceStore);
    }

    async getChapterTrace(chapterNumber) {
        const traceStore = await this._getTraceStore();
        const key = `chapter-${String(chapterNumber).padStart(4, '0')}`;
        return traceStore.chapters[key] || null;
    }

    /**
     * 记录一次"上下文装配"实况（每章每Agent一条）
     *
     * 存储：独立集合 context-assemblies，键 = `${projectId}_ch${nnn}_${agentType}`
     * 为什么不用 project.contextTraces（2026-09-18 实测教训）：
     *   内嵌在 projects 记录里需要"读整个项目→改→整体写回"，与 postApproval 的
     *   recordChapterTrace 并发时互相覆盖（实测5章只有1章记录存活=丢失更新）。
     *   独立集合按记录写，天然无丢失更新，也不会让项目记录随章节数线性膨胀。
     */
    async recordAssembly(chapterNumber, assembly) {
        const id = assemblyId(this.projectId, chapterNumber, assembly.agentType);
        const record = {
            ...assembly,
            projectId: this.projectId,
            chapter: chapterNumber,
            chapterKey: chapterKey(chapterNumber),
            recordedAt: new Date().toISOString(),
        };
        await store.setItem(ASSEMBLY_STORE, id, record);
        return record;
    }

    /** 获取某章的全部装配记录 { agentType: assembly } */
    async getChapterAssemblies(chapterNumber) {
        const rows = await store.queryItems(ASSEMBLY_STORE, { projectId: this.projectId });
        const hit = rows.filter(r => (r.chapter ?? Number(String(r.chapterKey || '').replace('chapter-', ''))) === chapterNumber);
        if (hit.length > 0) {
            const out = {};
            for (const r of hit) out[r.agentType] = r;
            return out;
        }
        // 向后兼容：读取内嵌在 project.contextTraces 里的旧记录
        const trace = await this.getChapterTrace(chapterNumber);
        return trace?.assemblies || {};
    }

    /** 批量移除过老的装配记录（装配图滚动淘汰用） */
    async dropChapters(keys) {
        if (!keys || keys.length === 0) return 0;
        const rows = await store.queryItems(ASSEMBLY_STORE, { projectId: this.projectId });
        let removed = 0;
        for (const r of rows) {
            if (keys.includes(r.chapterKey)) { await store.deleteItem(ASSEMBLY_STORE, r.id); removed++; }
        }
        return removed;
    }

    async formatTraceForPrompt(chapterNumber) {
        const trace = await this.getChapterTrace(chapterNumber);
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

    async getContextSelectionReasoning(chapterNumber) {
        const trace = await this.getChapterTrace(chapterNumber);
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
    getContextTraceForProject,
    ASSEMBLY_STORE,
    chapterKey,
    assemblyId,
};
