const router = require('express').Router();
const pipeline = require('../services/pipeline');
const legacyPipeline = require('../services/_pipelineLegacy');
const imageGen = require('../services/imageGen');
const fpModule = require('../services/pipeline/fullPipeline');
const { startPipeline, startInfinitePipeline } = require('../middleware/validators');

const asyncTasks = new Map();
const MAX_ASYNC_TASKS = 100;

setInterval(() => {
    const now = Date.now();
    for (const [id, task] of asyncTasks.entries()) {
        const age = now - (task.startedAt || task.completedAt || now);
        if (task.status !== 'running' && age > 60 * 60 * 1000) {
            asyncTasks.delete(id);
        }
        if (task.status === 'running' && age > 30 * 60 * 1000) {
            task.status = 'timeout';
            task.error = 'Task timed out (30min)';
            task.completedAt = now;
        }
    }
    if (asyncTasks.size > MAX_ASYNC_TASKS) {
        const entries = [...asyncTasks.entries()]
            .filter(([_, t]) => t.status !== 'running')
            .sort((a, b) => (a[1].completedAt || a[1].startedAt) - (b[1].completedAt || b[1].startedAt));
        const toDelete = entries.slice(0, asyncTasks.size - MAX_ASYNC_TASKS + 10);
        for (const [id] of toDelete) asyncTasks.delete(id);
    }
}, 10 * 60 * 1000);

router.post('/step', async (req, res) => {
    try {
        const { projectId, chapterId, step, round, context } = req.body;
        if (!projectId || !chapterId || !step) {
            return res.status(400).json({ error: 'projectId, chapterId, and step are required' });
        }
        const result = await pipeline.runPipelineStep(projectId, chapterId, step, round || 1, context || {});
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/full', startPipeline, (req, res) => {
    try {
        const { projectId, chapterId, maxRounds, generateImages, imageAspectRatio } = req.body;
        if (!projectId || !chapterId) {
            return res.status(400).json({ error: 'projectId and chapterId are required' });
        }

        const store = require('../store');
        const project = store.getItem('projects', projectId);
        if (!project) return res.status(404).json({ error: '项目不存在' });

        const chapter = store.getItem('chapters', chapterId);
        if (!chapter) return res.status(404).json({ error: '章节不存在' });

        const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        asyncTasks.set(taskId, { status: 'running', progress: 0, result: null, error: null, startedAt: Date.now() });

        const runWithRetry = async (attempt = 0) => {
            try {
                fpModule.setRunPipelineStepFn(legacyPipeline.runPipelineStep);
                const result = await fpModule.runFullPipeline(projectId, chapterId, maxRounds || 3, {
                    generateImages: generateImages || false,
                    imageAspectRatio: imageAspectRatio || '16:9'
                });
                const task = asyncTasks.get(taskId);
                if (task) {
                    if (result.success) {
                        task.status = 'completed';
                    } else {
                        task.status = 'failed';
                    }
                    task.result = result;
                    task.completedAt = Date.now();
                }
            } catch (err) {
                const isOverloaded = err.message && (err.message.includes('529') || err.message.includes('2064') || err.message.includes('负载较高') || err.message.includes('overloaded'));
                if (isOverloaded && attempt < 2) {
                    const delay = 60000 * (attempt + 1);
                    console.log(`[PIPELINE ROUTE] Full pipeline failed (attempt ${attempt + 1}/3), retrying in ${delay/1000}s...`);
                    const task = asyncTasks.get(taskId);
                    if (task) task.progress = `服务繁忙，第${attempt + 1}次重试中...`;
                    await new Promise(r => setTimeout(r, delay));
                    return runWithRetry(attempt + 1);
                }
                const task = asyncTasks.get(taskId);
                if (task) {
                    task.status = 'failed';
                    task.error = err.message;
                    task.completedAt = Date.now();
                }
            }
        };
        runWithRetry();

        res.json({ success: true, taskId, message: 'Pipeline task started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/generate-materials', async (req, res) => {
    try {
        const { projectId, prompt } = req.body;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        const result = await pipeline.generateInitialMaterials(projectId, prompt || '');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/generate-outlines', async (req, res) => {
    try {
        const { projectId, prompt, targetChapters } = req.body;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        console.log(`[PIPELINE ROUTE] generate-outlines called, projectId: ${projectId}, targetChapters: ${targetChapters || 'default'}`);
        const maxRhythmRetries = 3;
        let result;
        for (let attempt = 1; attempt <= maxRhythmRetries; attempt++) {
            result = await pipeline.generateChapterOutlines(projectId, prompt || '', targetChapters || null);
            if (result.rhythmIssues) {
                console.warn(`[PIPELINE ROUTE] 卷节奏校验失败(尝试${attempt}/${maxRhythmRetries}):`, result.rhythmIssues.join('; '));
                if (attempt < maxRhythmRetries) {
                    console.log(`[PIPELINE ROUTE] 重试大纲生成...`);
                    continue;
                }
            } else {
                break;
            }
        }
        console.log(`[PIPELINE ROUTE] generate-outlines result: count=${result.count}, created=${result.created?.length || 0}`);
        res.json(result);
    } catch (error) {
        console.error('[PIPELINE ROUTE] generate-outlines error:', error.stack || error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/infinite', startInfinitePipeline, async (req, res) => {
    try {
        const { projectId, chaptersPerBatch, maxSupplements, stopAfterChapter, maxRounds } = req.body;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        const store = require('../store');
        const project = store.getItem('projects', projectId);
        if (!project) return res.status(404).json({ error: '项目不存在', success: false });

        const existingState = pipeline.getInfinitePipelineStatus(projectId);
        if (existingState.running) {
            return res.status(409).json({ error: '该项目已有无限流水线在运行中', success: false });
        }

        pipeline.runInfinitePipeline(projectId, { chaptersPerBatch, maxSupplements, stopAfterChapter, maxRounds })
            .then(result => {
                console.log('[PIPELINE] Infinite pipeline completed:', result.completedChapters, 'chapters');
            })
            .catch(err => {
                console.error('[PIPELINE] Infinite pipeline error:', err.message);
                const state = pipeline.getInfinitePipelineStatus(projectId);
                if (state) {
                    state.running = false;
                    state.lastError = err.message;
                }
            });
        res.json({ success: true, message: 'Infinite pipeline started' });
    } catch (error) {
        console.error('[PIPELINE ROUTE] /infinite error:', error.message);
        res.status(500).json({ error: error.message, success: false });
    }
});

router.post('/infinite/stop', (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const result = pipeline.stopInfinitePipeline(projectId);
    res.json(result);
});

router.post('/infinite/reset', (req, res) => {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const result = pipeline.forceResetPipeline(projectId);
    res.json(result);
});

router.post('/reset-chapter-content', async (req, res) => {
    const { projectId, chapterId, chapterNumber } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });
    const store = require('../store');

    let chapters;
    if (chapterId) {
        chapters = [store.getItem('chapters', chapterId)].filter(Boolean);
    } else if (chapterNumber) {
        chapters = store.queryItems('chapters', { projectId }).filter(c => c.chapterNumber === chapterNumber);
    } else {
        return res.status(400).json({ error: 'chapterId or chapterNumber is required' });
    }

    let resetCount = 0;
    for (const ch of chapters) {
        ch.status = 'outlined';
        ch.content = '';
        ch.round = 0;
        ch.wordCount = 0;
        ch.writerOutput = '';
        ch.firstReviewOutput = '';
        ch.secondReviewOutput = '';
        ch.finalEditorOutput = '';
        ch.materialManagerOutput = '';
        ch.skipUntil = undefined;
        ch.updatedAt = new Date().toISOString();
        await store.setItem('chapters', ch.id, ch);
        try { store.deleteItem('pipeline-logs', `${ch.id}_pipeline`); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        resetCount++;
    }

    res.json({ success: true, resetCount, message: `已重置${resetCount}章的正文（大纲保留）` });
});

router.post('/reset-chapters-bulk', async (req, res) => {
    const { projectId, fromChapter, toChapter } = req.body;
    if (!projectId || !fromChapter || !toChapter) return res.status(400).json({ error: 'projectId, fromChapter, toChapter are required' });
    const store = require('../store');

    const chapters = store.queryItems('chapters', { projectId })
        .filter(c => c.chapterNumber >= fromChapter && c.chapterNumber <= toChapter);

    let resetCount = 0;
    for (const ch of chapters) {
        ch.status = 'outlined';
        ch.content = '';
        ch.round = 0;
        ch.wordCount = 0;
        ch.writerOutput = '';
        ch.firstReviewOutput = '';
        ch.secondReviewOutput = '';
        ch.finalEditorOutput = '';
        ch.materialManagerOutput = '';
        ch.skipUntil = undefined;
        ch.updatedAt = new Date().toISOString();
        await store.setItem('chapters', ch.id, ch);
        try { store.deleteItem('pipeline-logs', `${ch.id}_pipeline`); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
        resetCount++;
    }

    res.json({ success: true, resetCount, message: `已重置第${fromChapter}-${toChapter}章的正文（大纲保留）` });
});

router.get('/infinite/status/:projectId', (req, res) => {
    const result = pipeline.getInfinitePipelineStatus(req.params.projectId);
    res.json(result);
});

router.post('/supplement-outlines', async (req, res) => {
    try {
        const { projectId, supplementCount } = req.body;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        const chapters = require('../store').queryItems('chapters', { projectId });
        const existingCount = chapters.length > 0 ? Math.max(...chapters.map(c => c.chapterNumber || 0)) : 0;
        const result = await pipeline.supplementChapterOutlines(projectId, existingCount, supplementCount || 30);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/injection-map/:projectId', (req, res) => {
    console.log('[PIPELINE ROUTE] /injection-map hit! projectId:', req.params.projectId);
    try {
        const store = require('../store');
        const projectId = req.params.projectId;
        const project = store.getItem('projects', projectId);
        if (!project) return res.status(404).json({ error: '项目不存在' });

        const pipeline = require('../services/_pipelineLegacy');
        const chapters = store.queryItems('chapters', { projectId }).sort((a, b) => a.chapterNumber - b.chapterNumber);
        const existingCount = chapters.length;
        const currentVolume = Math.floor(existingCount / 30) + 1;
        const nextChapterNum = existingCount + 1;

        const vis = legacyPipeline.getVisibleMaterials(projectId, nextChapterNum, { purpose: 'outline' });

        const allMaterials = store.queryItems('materials', { projectId }).filter(m => !m.archived);
        const subplaneMats = allMaterials.filter(m => m.type === 'sub-plane');

        const volumeOrderConfig = legacyPipeline.getVolumeOrder(projectId);

        const subplanes = subplaneMats.map(m => {
            const volEntry = volumeOrderConfig?.volumeOrder?.find(v => v.subplaneId === m.id || v.subplaneName === m.name);
            const children = allMaterials.filter(c =>
                (c.type === 'character' || c.type === 'faction' || c.type === 'equipment') &&
                (c.parentPlane === m.id || c.parentPlane === m.name || c.parentPlane === m.name.replace(/^次位面[···]/, ''))
            );
            const isInjected = vis.materials.some(vm => vm.id === m.id);

            return {
                id: m.id,
                name: m.name,
                isLocked: m.isLocked,
                assignedVolume: volEntry ? volEntry.volume : null,
                isCurrentVolume: vis.currentVolSubplane?.id === m.id,
                willBeInjected: isInjected,
                children: children.map(c => {
                    const cInjected = vis.materials.some(vm => vm.id === c.id);
                    return {
                        id: c.id,
                        name: c.name,
                        type: c.type,
                        parentPlane: c.parentPlane,
                        parentPlaneMatch: c.parentPlane === m.id ? 'id匹配' : c.parentPlane === m.name ? 'name匹配' : c.parentPlane === m.name.replace(/^次位面[···]/, '') ? '短名匹配' : '不匹配',
                        isLocked: c.isLocked,
                        willBeInjected: cInjected
                    };
                })
            };
        });

        const mainWorldChars = allMaterials.filter(c =>
            (c.type === 'character' || c.type === 'faction') &&
            (c.parentPlane === '主世界' || c.parentPlane === '' || c.parentPlane === null || !c.parentPlane)
        ).map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            parentPlane: c.parentPlane,
            isLocked: c.isLocked,
            willBeInjected: true
        }));

        const orphanChildren = allMaterials.filter(c =>
            (c.type === 'character' || c.type === 'faction') && c.parentPlane
        ).filter(c => {
            const hasMatch = subplaneMats.some(sp => c.parentPlane === sp.id || c.parentPlane === sp.name || c.parentPlane === sp.name.replace(/^次位面[···]/, ''));
            const isMainWorld = c.parentPlane === '主世界' || c.parentPlane === '' || c.parentPlane === null;
            return !hasMatch && !isMainWorld;
        }).map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            parentPlane: c.parentPlane,
            isLocked: c.isLocked,
            willBeInjected: vis.materials.some(vm => vm.id === c.id),
            issue: 'parentPlane无法匹配到任何次位面'
        }));

        const injectionSummary = {
            projectId,
            projectName: project.name,
            currentVolume,
            existingChapterCount: existingCount,
            chapterInVolume: existingCount % 30,
            currentVolumeSubplane: vis.currentVolSubplane ? { id: vis.currentVolSubplane.id, name: vis.currentVolSubplane.name } : null,
            volumeOrder: volumeOrderConfig?.volumeOrder || [],
            subplanes,
            mainWorldCharacters: mainWorldChars,
            orphanChildren,
            totalMaterialsCount: allMaterials.length,
            injectedMaterialsCount: vis.materials.length,
            debug: vis.debug || { error: 'vis.debug is undefined' }
        };

        res.json(injectionSummary);
    } catch (error) {
        console.error('[PIPELINE ROUTE] /outline-injection-map error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/toggle-material-lock', (req, res) => {
    try {
        const store = require('../store');
        const { materialId, isLocked } = req.body;
        if (!materialId) return res.status(400).json({ error: 'materialId必填' });

        const mat = store.getItem('materials', materialId);
        if (!mat) return res.status(404).json({ error: '素材不存在' });

        mat.isLocked = isLocked;
        mat.updatedAt = new Date().toISOString();
        if (!mat.changeLog) mat.changeLog = [];
        mat.changeLog.push({ action: 'lock-toggle', reason: `手动${isLocked ? '锁定' : '解锁'}`, at: new Date().toISOString() });
        store.setItem('materials', materialId, mat);

        res.json({ success: true, materialId, isLocked: mat.isLocked });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/set-volume-subplane', (req, res) => {
    try {
        const store = require('../store');
        const { projectId, volumeNumber, subplaneId } = req.body;
        if (!projectId || !volumeNumber || !subplaneId) {
            return res.status(400).json({ error: 'projectId, volumeNumber, subplaneId必填' });
        }

        const subplaneMats = store.queryItems('materials', { projectId, type: 'sub-plane' });
        for (const m of subplaneMats) {
            const shouldBeUnlocked = m.id === subplaneId;
            if (m.isLocked === shouldBeUnlocked) {
                m.isLocked = !shouldBeUnlocked;
                m.updatedAt = new Date().toISOString();
                store.setItem('materials', m.id, m);
            }
        }

        const subChildren = store.queryItems('materials', { projectId }).filter(m =>
            !m.archived && (m.type === 'character' || m.type === 'faction' || m.type === 'equipment') &&
            m.parentPlane && m.parentPlane !== '主世界' && m.parentPlane !== ''
        );
        for (const c of subChildren) {
            const belongsToUnlocked = c.parentPlane === subplaneId;
            if (c.isLocked === belongsToUnlocked) {
                c.isLocked = !belongsToUnlocked;
                c.updatedAt = new Date().toISOString();
                store.setItem('materials', c.id, c);
            }
        }

        res.json({ success: true, volumeNumber, unlockedSubplaneId: subplaneId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/generate-subplane-materials', async (req, res) => {
    try {
        const { projectId, genre, subplaneName, subplaneType, ipReference, volumeNumber } = req.body;
        if (!projectId || !subplaneName || !subplaneType) {
            return res.status(400).json({ error: 'projectId, subplaneName, subplaneType 必填' });
        }

        const store = require('../store');
        const project = store.getItem('projects', projectId);
        if (!project) return res.status(404).json({ error: '项目不存在' });

        const llm = require('../services/llm');

        const messages = [
            {
                role: 'system',
                content: `你是一个小说次位面素材生成器。根据给定的题材、类型和IP参考，生成完整的次位面素材包。

输出严格JSON格式，包含以下结构：
{
  "subplane": {
    "name": "次位面·${subplaneName}",
    "type": "${subplaneType}",
    "description": "一句话描述",
    "initialContent": "【类型】${subplaneType}\\n【核心规则】...\\n【视觉特征】...\\n【主线剧情】...\\n【系统任务】...\\n【关键转折】...\\n【智斗要素】...\\n【掠夺能力】...\\n【主世界回响】..."
  },
  "factions": [
    {"name": "势力名", "description": "一句话描述", "content": "【定位】...\\n【特色】...\\n【与主角关系】...\\n【内部关系】..."}
  ],
  "characters": [
    {"name": "角色全称", "faction": "所属势力", "description": "一句话描述", "content": "【所属位面】次位面·${subplaneName}\\n【所属势力】...\\n【身份】...\\n【性格】...\\n【能力】...\\n【与主角关系】...\\n【出场方式】...", "refNames": {"narrator": "全称", "byChild": "简称", "byAdult": "简称", "pronoun": "他/她/它"}}
  ],
  "items": [
    {"name": "道具名", "description": "一句话描述", "content": "【所属位面】次位面·${subplaneName}\\n【道具名】...\\n【获取方式】...\\n【功能】...\\n【主世界翻译】..."}
  ]
}

要求：
1. 至少3个势力，势力之间有明确冲突关系
2. 至少6个角色（每势力2个），角色有独特性格和能力
3. 至少3个道具/装备
4. 核心规则必须有"智斗"空间——规则本身可以被解读、利用、绕过
5. 抢劫能力要有创意，不能太强也不能太弱
6. ${ipReference ? `参考IP：${ipReference}，但要原创化处理，不能直接照搬` : '完全原创'}`
            },
            {
                role: 'user',
                content: `请为小说"${project.name}"生成一个次位面素材包：
- 次位面名称：${subplaneName}
- 类型：${subplaneType}
${ipReference ? `- IP参考：${ipReference}` : ''}
- 风格定位：${project.styleProfile?.description || project.genre || '智斗喜剧'}
- 第${volumeNumber || '?'}卷的次位面

请生成完整素材包。`
            }
        ];

        const result = await llm.chat(messages, { temperature: 0.8, maxTokens: 16000 });
        let parsed;
        try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON found');
            parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
            return res.status(500).json({ error: '素材生成格式错误: ' + e.message, raw: result.substring(0, 500) });
        }

        const subplaneId = `sp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const createdMaterials = [];

        const chapters = store.queryItems('chapters', { projectId });
        const existingCount = chapters.length;
        const currentVolume = volumeNumber || Math.floor(existingCount / 30) + 1;
        const volumeOrderConfig = (() => {
            try {
                const fs = require('fs');
                const path = require('path');
                const genre = project.genre || project.styleProfile?.key || '';
                const genreFileMap = {
                    'causal-eye-strategy': 'volume-order-causal-eye.json',
                    'strategy-crossplane': 'volume-order-strategy.json',
                    'witty-strategy': 'volume-order-witty-strategy.json',
                };
                const fileName = genreFileMap[genre] || 'volume-order.json';
                const voPath = path.join(__dirname, '..', '..', 'data', 'subplanes', fileName);
                if (fs.existsSync(voPath)) return JSON.parse(fs.readFileSync(voPath, 'utf8'));
            } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
            return null;
        })();
        const volEntry = volumeOrderConfig?.volumeOrder?.find(v => v.volume === currentVolume);
        const isCurrentVolumeSubplane = volEntry && (volEntry.subplaneName === `次位面·${subplaneName}` || volEntry.subplaneName === subplaneName);
        const shouldUnlock = isCurrentVolumeSubplane;

        const subMat = {
            id: subplaneId,
            projectId,
            type: 'sub-plane',
            name: parsed.subplane.name || `次位面·${subplaneName}`,
            description: parsed.subplane.description || `${subplaneType}类次位面`,
            initialContent: parsed.subplane.initialContent,
            currentContent: parsed.subplane.initialContent,
            parentPlane: '主世界',
            isLocked: !shouldUnlock,
            tags: ['sub-plane', subplaneType],
            version: 1,
            changeLog: [{ action: 'generated', reason: `手动生成次位面素材(第${currentVolume}卷${shouldUnlock ? '，当前卷解锁' : '，非当前卷锁定'})`, at: new Date().toISOString() }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        store.setItem('materials', subplaneId, subMat);
        createdMaterials.push({ type: 'sub-plane', name: subMat.name, id: subplaneId });

        if (parsed.factions) {
            const factionNameToId = {};
            for (const fac of parsed.factions) {
                const facId = `fac-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
                const facMat = {
                    id: facId,
                    projectId,
                    type: 'faction',
                    name: fac.name,
                    description: fac.description,
                    initialContent: fac.content,
                    currentContent: fac.content,
                    parentPlane: subplaneId,
                    isLocked: !shouldUnlock,
                    tags: [subMat.name, subplaneType],
                    version: 1,
                    changeLog: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                store.setItem('materials', facId, facMat);
                createdMaterials.push({ type: 'faction', name: fac.name, id: facId });
                factionNameToId[fac.name] = facId;
            }
        }

        if (parsed.characters) {
            for (const chr of parsed.characters) {
                const chrId = `chr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
                const chrMat = {
                    id: chrId,
                    projectId,
                    type: 'character',
                    name: chr.name,
                    description: chr.description,
                    initialContent: chr.content,
                    currentContent: chr.content,
                    parentPlane: subplaneId,
                    parentFaction: factionNameToId[chr.faction] || chr.faction,
                    isLocked: !shouldUnlock,
                    tags: [subMat.name, subplaneType, 'original'],
                    refNames: chr.refNames || {},
                    version: 1,
                    changeLog: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                store.setItem('materials', chrId, chrMat);
                createdMaterials.push({ type: 'character', name: chr.name, id: chrId });
            }
        }

        if (parsed.items) {
            for (const itm of parsed.items) {
                const itmId = `itm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
                const itmMat = {
                    id: itmId,
                    projectId,
                    type: 'equipment',
                    name: itm.name,
                    description: itm.description,
                    initialContent: itm.content,
                    currentContent: itm.content,
                    parentPlane: subplaneId,
                    isLocked: !shouldUnlock,
                    tags: [subMat.name, subplaneType, 'sub-plane-item'],
                    version: 1,
                    changeLog: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                store.setItem('materials', itmId, itmMat);
                createdMaterials.push({ type: 'equipment', name: itm.name, id: itmId });
            }
        }

        res.json({
            success: true,
            subplaneId,
            createdMaterials,
            count: createdMaterials.length,
            raw: parsed
        });
    } catch (error) {
        console.error('[PIPELINE ROUTE] /generate-subplane-materials error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

router.get('/output-paths/:projectId/:chapterId', (req, res) => {
    try {
        const { projectId, chapterId } = req.params;
        const chapter = require('../store').getItem('chapters', chapterId);
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
        const paths = pipeline.getAgentOutputPaths(projectId, chapter);
        res.json(paths);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/agents', (req, res) => {
    const mode = req.query.mode || 'novel';
    const store = require('../store');
    const templates = store.listItems('agent-templates');
    const seen = new Set();
    const agents = [];
    const modeSpecific = templates.filter(t => t.agentType && t.mode === mode);
    const fallback = templates.filter(t => t.agentType && t.mode === 'novel');
    const anyMode = templates.filter(t => t.agentType);
    for (const t of modeSpecific) {
        if (!seen.has(t.agentType)) { seen.add(t.agentType); agents.push({ type: t.agentType, role: t.role, tool: t.tool, systemPrompt: t.system }); }
    }
    for (const t of fallback) {
        if (!seen.has(t.agentType)) { seen.add(t.agentType); agents.push({ type: t.agentType, role: t.role, tool: t.tool, systemPrompt: t.system }); }
    }
    for (const t of anyMode) {
        if (!seen.has(t.agentType)) { seen.add(t.agentType); agents.push({ type: t.agentType, role: t.role, tool: t.tool, systemPrompt: t.system }); }
    }
    res.json(agents);
});

router.get('/agents/:type', (req, res) => {
    const mode = req.query.mode || 'novel';
    const projectId = req.query.projectId || null;
    const agent = pipeline.getAgentPrompt(req.params.type, mode, projectId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ type: req.params.type, role: agent.role, tool: agent.tool, systemPrompt: agent.system });
});

router.post('/generate-images', async (req, res) => {
    try {
        const { projectId, chapterId, aspectRatio } = req.body;
        if (!projectId || !chapterId) {
            return res.status(400).json({ error: 'projectId and chapterId are required' });
        }
        const chapter = require('../store').getItem('chapters', chapterId);
        if (!chapter || !chapter.content) {
            return res.status(400).json({ error: 'Chapter not found or has no content' });
        }
        const result = await imageGen.generateChapterImages(
            projectId,
            chapter.chapterNumber,
            chapter.title,
            chapter.content,
            { aspectRatio: aspectRatio || '16:9' }
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/generate-from-template', async (req, res) => {
    try {
        const template = req.body;
        if (!template.name || !template.genre) {
            return res.status(400).json({ error: 'name and genre are required' });
        }
        const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        asyncTasks.set(taskId, { status: 'running', progress: 0, result: null, error: null, startedAt: Date.now() });

        const MAX_ATTEMPTS = 3;
        let attempt = 0;
        const tryGenerate = async () => {
            attempt++;
            try {
                const result = await pipeline.generateFromTemplate(template);
                const task = asyncTasks.get(taskId);
                if (task) {
                    task.status = result.success ? 'completed' : 'failed';
                    task.result = result;
                    task.completedAt = Date.now();
                }
            } catch (err) {
                const isOverloaded = err.message && (err.message.includes('529') || err.message.includes('2064') || err.message.includes('负载较高') || err.message.includes('overloaded'));
                if (isOverloaded && attempt < MAX_ATTEMPTS) {
                    const delay = 60000 * attempt;
                    console.log(`[PIPELINE ROUTE] generateFromTemplate failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${delay/1000}s...`);
                    const task = asyncTasks.get(taskId);
                    if (task) task.progress = `服务繁忙，第${attempt}次重试中，${delay/1000}秒后重试...`;
                    await new Promise(r => setTimeout(r, delay));
                    return tryGenerate();
                }
                const task = asyncTasks.get(taskId);
                if (task) {
                    task.status = 'failed';
                    task.error = err.message;
                    task.completedAt = Date.now();
                }
            }
        };
        tryGenerate();

        res.json({ success: true, taskId, message: 'Task started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/shuangwen-oneclick', async (req, res) => {
    try {
        const { name, genre, elements, targetChapters, style, tone, pov, setting, conflict, themes, constraints } = req.body;
        if (!name || !genre) {
            return res.status(400).json({ error: 'name and genre are required' });
        }

        const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        asyncTasks.set(taskId, { status: 'running', progress: '正在搜索热梗...', result: null, error: null, startedAt: Date.now() });

        const trendingSearch = require('../services/trendingSearch');
        const store = require('../store');

        const runOneClick = async () => {
            try {
                const task = asyncTasks.get(taskId);
                if (task) task.progress = '正在搜索网络热梗和流行语...';

                const trending = await trendingSearch.searchTrendingMemes(genre, elements || name);

                if (task) task.progress = '正在生成爽文设定和大纲...';

                const result = await pipeline.generateFromTemplate({
                    name,
                    genre,
                    elements,
                    targetChapters: targetChapters || 20,
                    style: style || '热血爽文',
                    tone: tone || '热血激昂',
                    pov: pov || '第三人称限制视角',
                    setting,
                    conflict,
                    themes,
                    constraints: constraints || ['no-derailment', 'character-consistency', 'worldview-consistency', 'hook-every-chapter', 'fast-escalation', 'reader-satisfaction'],
                    mode: 'shuangwen',
                    trendingHint: trending.injectionHint
                });

                if (task) {
                    task.status = result.success ? 'completed' : 'failed';
                    task.result = result;
                    task.completedAt = Date.now();
                }
            } catch (err) {
                const task = asyncTasks.get(taskId);
                if (task) {
                    task.status = 'failed';
                    task.error = err.message;
                    task.completedAt = Date.now();
                }
            }
        };
        runOneClick();

        res.json({ success: true, taskId, message: '爽文一键成型任务已启动' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/task/:taskId', (req, res) => {
    const task = asyncTasks.get(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
    if (task.status === 'completed' || task.status === 'failed') {
        setTimeout(() => asyncTasks.delete(req.params.taskId), 60000);
    }
});

router.get('/images/:projectId', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const imageDir = path.join(__dirname, '..', '..', 'output', req.params.projectId, 'images');
        if (!fs.existsSync(imageDir)) return res.json([]);
        const files = fs.readdirSync(imageDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
        res.json(files.map(f => ({
            fileName: f,
            filePath: `/output/${req.params.projectId}/images/${f}`
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/context-budget/:projectId', (req, res) => {
    try {
        const { calculateMaxBatchChapters } = require('../services/contextBudget');
        const model = process.env.LMSTUDIO_MODEL || process.env.MINIMAX_MODEL || 'default';
        const result = calculateMaxBatchChapters(req.params.projectId, model);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/hook-budget/:projectId', (req, res) => {
    try {
        const { getHookBudgetForProject } = require('../services/hookBudget');
        const hookBudget = getHookBudgetForProject(req.params.projectId);
        const currentChapter = parseInt(req.query.chapter) || 0;
        res.json({
            budget: hookBudget.getBudgetStatus(currentChapter),
            agenda: hookBudget.generateHookAgenda(currentChapter),
            summary: hookBudget.getHooksSummary()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/rule-stack/:projectId', (req, res) => {
    try {
        const { getRuleStackForProject } = require('../services/ruleStack');
        const ruleStack = getRuleStackForProject(req.params.projectId);
        res.json({
            summary: ruleStack.getStackSummary(),
            effectiveRules: ruleStack.getEffectiveRules(req.query.context || 'writer'),
            formattedPrompt: ruleStack.formatRuleStackForPrompt(req.query.context || 'writer')
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/chapter-intent/:projectId/:chapterNumber', (req, res) => {
    try {
        const { getChapterIntentPlanner } = require('../services/chapterIntent');
        const planner = getChapterIntentPlanner(req.params.projectId);
        const chapterNumber = parseInt(req.params.chapterNumber);
        const intent = planner.getIntent(chapterNumber);
        if (!intent) return res.status(404).json({ error: '意图尚未生成' });
        res.json({
            intent,
            formattedPrompt: planner.formatIntentForPrompt(chapterNumber)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/context-trace/:projectId/:chapterNumber', (req, res) => {
    try {
        const { getContextTraceForProject } = require('../services/contextTrace');
        const trace = getContextTraceForProject(req.params.projectId);
        const chapterNumber = parseInt(req.params.chapterNumber);
        const chapterTrace = trace.getChapterTrace(chapterNumber);
        if (!chapterTrace) return res.status(404).json({ error: '追踪记录不存在' });
        res.json(chapterTrace);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/hook-budget/:projectId/register', (req, res) => {
    try {
        const { getHookBudgetForProject } = require('../services/hookBudget');
        const hookBudget = getHookBudgetForProject(req.params.projectId);
        const hook = hookBudget.registerHook(req.body);
        res.json(hook);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/hook-budget/:projectId/sync', (req, res) => {
    try {
        const { getHookBudgetForProject } = require('../services/hookBudget');
        const hookBudget = getHookBudgetForProject(req.params.projectId);
        const imported = hookBudget.syncFromForeshadowingMaterials();
        res.json({ imported, summary: hookBudget.getHooksSummary() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/rule-stack/:projectId/extract', (req, res) => {
    try {
        const { getRuleStackForProject } = require('../services/ruleStack');
        const ruleStack = getRuleStackForProject(req.params.projectId);
        const imported = ruleStack.extractRulesFromMaterials();
        res.json({ imported, summary: ruleStack.getStackSummary() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/rerun-material-manager/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { chapterIds } = req.body;
        const store = require('../store');
        const project = store.getItem('projects', projectId);
        if (!project) return res.status(404).json({ error: '项目不存在' });

        let chapters;
        if (chapterIds && chapterIds.length > 0) {
            chapters = chapterIds.map(id => store.getItem('chapters', id)).filter(Boolean);
        } else {
            chapters = store.queryItems('chapters', { projectId })
                .filter(ch => (ch.status === 'approved' || ch.status === 'material-updated') && ch.content && (!ch.materialManagerOutput || ch.materialManagerOutput === ''))
                .sort((a, b) => a.chapterNumber - b.chapterNumber);
        }

        if (chapters.length === 0) {
            return res.json({ success: true, processed: 0, message: '没有需要重新运行素材管理员的章节' });
        }

        const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        asyncTasks.set(taskId, { status: 'running', progress: 0, result: null, error: null, startedAt: Date.now() });

        res.json({ taskId, chapterCount: chapters.length });

        (async () => {
            let processed = 0;
            let failed = 0;
            for (const ch of chapters) {
                try {
                    console.log(`[RERUN-MAT] Running material-manager for chapter ${ch.chapterNumber}...`);
                    await pipeline.runPipelineStep(projectId, ch.id, 'material-manager', ch.round || 1, { materialGuidance: '' });
                    processed++;
                    console.log(`[RERUN-MAT] Chapter ${ch.chapterNumber} done`);
                } catch (err) {
                    failed++;
                    console.error(`[RERUN-MAT] Chapter ${ch.chapterNumber} failed:`, err.message);
                    const failedCh = store.getItem('chapters', ch.id);
                    if (failedCh && !failedCh.materialManagerOutput) {
                        failedCh.materialManagerOutput = `[素材管理失败] ${err.message}`;
                        failedCh.updatedAt = new Date().toISOString();
                        store.setItem('chapters', ch.id, failedCh);
                    }
                }
                asyncTasks.set(taskId, {
                    status: 'running',
                    progress: Math.round(((processed + failed) / chapters.length) * 100),
                    result: { processed, failed },
                    startedAt: asyncTasks.get(taskId)?.startedAt || Date.now()
                });
            }
            asyncTasks.set(taskId, {
                status: 'done',
                progress: 100,
                result: { processed, failed, total: chapters.length },
                startedAt: asyncTasks.get(taskId)?.startedAt || Date.now(),
                completedAt: Date.now()
            });
        })();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/clear-chapters-after/:projectId', (req, res) => {
    try {
        const { projectId } = req.params;
        const { afterChapter } = req.body;
        const store = require('../store');
        const project = store.getItem('projects', projectId);
        if (!project) return res.status(404).json({ error: '项目不存在' });

        const chapters = store.queryItems('chapters', { projectId })
            .filter(ch => ch.chapterNumber > afterChapter);
        let cleared = 0;
        const fieldsToClean = ['writerOutput', 'firstReviewOutput', 'secondReviewOutput', 'finalEditorOutput', 'polisherOutput', 'materialManagerOutput', 'reviserOutput', 'pipelineLog', 'content', 'polishedContent', 'normalContent', 'reviewFeedback', 'intentPlan', 'intentPlannerOutput', 'round', 'history', 'wordCount'];

        chapters.forEach(ch => {
            let changed = false;
            fieldsToClean.forEach(f => {
                if (ch[f] !== undefined && ch[f] !== null && ch[f] !== '' && JSON.stringify(ch[f]).length > 2) {
                    if (Array.isArray(ch[f])) { ch[f] = []; } else { ch[f] = ''; }
                    changed = true;
                }
            });
            if (ch.status && ch.status !== 'outlined') {
                ch.status = 'outlined';
                changed = true;
            }
            if (ch.skipUntil) {
                delete ch.skipUntil;
                changed = true;
            }
            if (changed) {
                ch.updatedAt = new Date().toISOString();
                store.setItem('chapters', ch.id, ch);
                try { store.deleteItem('pipeline-logs', `${ch.id}_pipeline`); } catch(_) { console.warn('[SILENT-CATCH]', _.message || _); }
                cleared++;
            }
        });

        res.json({ success: true, cleared });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/pipeline-logs/:projectId/:chapterId', (req, res) => {
    try {
        const { projectId, chapterId } = req.params;
        const store = require('../store');
        const logId = `${chapterId}_pipeline`;
        const logData = store.getItem('pipeline-logs', logId);
        if (!logData) return res.json({ entries: [], chapterId, projectId });
        res.json(logData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/pipeline-logs/:projectId', (req, res) => {
    try {
        const { projectId } = req.params;
        const store = require('../store');
        const allLogs = store.queryItems('pipeline-logs', { projectId });
        res.json(allLogs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/prompt-audit/:projectId', (req, res) => {
    try {
        const { projectId } = req.params;
        const mode = req.query.mode || 'novel';
        const promptAuditor = require('../services/promptAuditor');
        const report = promptAuditor.getFullReport(projectId, mode);
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/prompt-audit-latest', (req, res) => {
    try {
        const promptAuditor = require('../services/promptAuditor');
        const lastAudit = promptAuditor.getLastAudit();
        if (!lastAudit) return res.json({ healthScore: -1, summary: '暂无审计数据' });
        res.json(lastAudit);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
