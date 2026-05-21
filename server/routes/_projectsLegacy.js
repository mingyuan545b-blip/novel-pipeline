const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { createProject, updateProject } = require('../middleware/validators');

const router = require('express').Router();

router.get('/constraints', (req, res) => {
    const presets = store.listItems('constraint-presets');
    res.json(presets.map(p => ({ id: p.id, label: p.label, desc: p.desc || p.description || '' })));
});

router.get('/', (req, res) => {
    const projects = store.listItems('projects');
    res.json(projects);
});

router.get('/:id', (req, res) => {
    const project = store.getItem('projects', req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
});

router.post('/', createProject, async (req, res) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const mode = req.body.mode || 'novel';
    const project = {
        id,
        name: req.body.name || 'Untitled Project',
        description: req.body.description || '',
        genre: req.body.genre || '',
        mode,
        targetChapters: req.body.targetChapters || 100,
        targetWordCount: req.body.targetWordCount || 0,
        currentChapter: 0,
        status: 'draft',
        styleProfile: req.body.styleProfile || null,
        settings: {
            autoPipeline: false,
            chapterRounds: mode === 'shuangwen' || mode === 'tomato-short' ? 2 : 1,
            ...req.body.settings
        },
        styleTemplateId: req.body.styleTemplateId || '',
        constraints: req.body.constraints || (mode === 'shuangwen' ? ['no-derailment', 'character-consistency', 'worldview-consistency', 'hook-every-chapter', 'fast-escalation', 'reader-satisfaction'] : mode === 'tomato-short' ? ['no-derailment', 'character-consistency', 'worldview-consistency', 'hook-every-chapter', 'fast-escalation', 'reader-satisfaction', 'tomato-metrics'] : []),
        chapters: [],
        chapterIntents: { chapters: [] },
        hookBudget: { hooks: [], lastUpdated: null },
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('projects', id, project);
    res.status(201).json(project);
});

router.put('/:id', updateProject, async (req, res) => {
    const project = store.getItem('projects', req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const updated = {
        ...project,
        ...req.body,
        id: project.id,
        updatedAt: new Date().toISOString()
    };
    await store.setItem('projects', project.id, updated);
    res.json(updated);
});

router.delete('/:id', (req, res) => {
    const project = store.getItem('projects', req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const projectId = req.params.id;

    const chapters = store.listItems('chapters').filter(c => c.projectId === projectId);
    const chapterIds = new Set(chapters.map(c => c.id));
    for (const c of chapters) { store.deleteItem('chapters', c.id); }

    const reviews = store.listItems('reviews').filter(r => r.projectId === projectId || chapterIds.has(r.chapterId));
    for (const r of reviews) { store.deleteItem('reviews', r.id); }

    const materials = store.listItems('materials').filter(m => m.projectId === projectId);
    let protectedCount = 0;
    for (const m of materials) {
        if (store.isFoundationMaterial(m)) { protectedCount++; continue; }
        store.deleteItem('materials', m.id);
    }

    store.deleteItem('projects', projectId);

    res.json({
        success: true,
        deletedChapters: chapters.length,
        deletedReviews: reviews.length,
        deletedMaterials: materials.length
    });
});

router.get('/:id/relationship-graph', (req, res) => {
    const projectId = req.params.id;
    const materials = store.queryItems('materials', { projectId }).filter(m => !m.archived);

    const characters = materials.filter(m => m.type === 'character');
    const relationships = materials.filter(m => m.type === 'relationship');
    const worldviews = materials.filter(m => m.type === 'worldview');

    const nodes = [];
    const edges = [];
    const nodeMap = {};
    const charOrgMap = {};

    const orgNames = worldviews.filter(w =>
        /(?:集团|公司|组织|联盟|公会|门派|宗门|势力|部门|局|处|会|堂|阁|殿|帮|派|族|院|所|基地|阵营|体系)/.test(w.name) ||
        /(?:组织|机构|集团|联盟|部门|势力)/.test((w.currentContent || '').substring(0, 100))
    ).map(w => w.name);

    characters.forEach(ch => {
        const id = ch.id;
        const content = ch.currentContent || '';
        let faction = '';
        const factionPatterns = [
            /【(?:身份|所属|阵营|组织)】([^\n]+)/,
            /(?:身份|所属|阵营)[：:]\s*([^\n,，。；;]+)/,
            /^(.{2,20}?)(?:成员|员工|干部|首领|高层|核心|骨干|部下|部属|特工|间谍|卧底)/m,
            /(?:属于|隶属|效力于|加入|来自|出身于)\s*([^\n,，。；;的]{2,20})/m
        ];
        for (const p of factionPatterns) {
            const m = content.match(p);
            if (m) { faction = m[1] ? m[1].trim() : m[0].trim(); break; }
        }
        if (!faction) {
            for (const orgName of orgNames) {
                if (content.includes(orgName)) {
                    faction = orgName;
                    break;
                }
            }
        }
        if (faction) {
            for (const orgName of orgNames) {
                if (faction.includes(orgName) || orgName.includes(faction)) {
                    faction = orgName;
                    break;
                }
            }
        }
        const roleMatch = content.match(/【身份】([^\n]+)/);
        const role = roleMatch ? roleMatch[1].trim() : '';
        const rankMatch = content.match(/(?:上级|中级|下级|高层|核心|骨干|普通|首领|副手)/);

        nodeMap[ch.name] = id;
        if (faction) charOrgMap[ch.name] = { org: faction, role, rank: rankMatch ? rankMatch[0] : '' };
        nodes.push({ id, label: ch.name, type: 'character', faction, role, rank: rankMatch ? rankMatch[0] : '', description: content.substring(0, 150) });
    });

    worldviews.forEach(w => {
        const id = w.id;
        const content = w.currentContent || '';
        nodeMap[w.name] = id;

        let parentOrg = '';
        const parentMatch = content.match(/(?:隶属|属于|旗下|分支|子公司|下属|附属于)[：:]*\s*([^\n,，。；;]+)/);
        if (parentMatch) parentOrg = parentMatch[1].trim().replace(/[的]$/, '');

        const isOrg = /(?:集团|公司|组织|联盟|公会|门派|宗门|势力|部门|局|处|会|堂|阁|殿|帮|派|族|院|所|基地|阵营|体系)/.test(w.name) ||
            /(?:组织|机构|集团|联盟|部门|势力)/.test(content.substring(0, 100));

        nodes.push({ id, label: w.name, type: isOrg ? 'organization' : 'worldview', parentOrg, description: content.substring(0, 150) });
    });

    const orgNodes = nodes.filter(n => n.type === 'organization');
    orgNodes.forEach(org => {
        if (org.parentOrg && nodeMap[org.parentOrg]) {
            edges.push({
                id: `org-hierarchy-${org.id}`,
                source: nodeMap[org.parentOrg],
                target: org.id,
                label: '子公司/分支',
                category: 'org-hierarchy',
                strength: 80,
                detail: `${org.parentOrg} → ${org.label}`
            });
        }
    });

    Object.entries(charOrgMap).forEach(([charName, info]) => {
        const charId = nodeMap[charName];
        const orgId = nodeMap[info.org];
        if (!charId || !orgId) return;

        const orgNode = nodes.find(n => n.id === orgId);
        if (!orgNode || orgNode.type !== 'organization') return;

        let rankLabel = '成员';
        if (info.rank === '上级' || info.rank === '高层' || info.rank === '首领') rankLabel = '上级';
        else if (info.rank === '中级' || info.rank === '核心' || info.rank === '骨干') rankLabel = '中级';
        else if (info.rank === '下级' || info.rank === '普通') rankLabel = '下级';

        edges.push({
            id: `org-member-${charId}`,
            source: orgId,
            target: charId,
            label: rankLabel,
            category: 'org-member',
            strength: 70,
            detail: `${info.org} → ${charName}（${info.role || rankLabel}）`,
            rank: rankLabel
        });
    });

    relationships.forEach(rel => {
        const content = rel.currentContent || '';
        const name = rel.name || '';

        let source = null;
        let target = null;
        const parts = name.split(/[与和、及]/);
        if (parts.length >= 2) {
            source = parts[0].trim();
            target = parts[parts.length - 1].trim();
        }
        if (!source || !target) return;

        let relType = '';
        let strength = 50;
        const typePatterns = [
            /【关系类型】\s*([^\n,，。；;【]+)/,
            /关系类型[：:]\s*([^\n,，。；;【]+)/,
            /关系性质[：:]\s*([^\n,，。；;【]+)/,
            /关系进展[】]?\s*([^\n,，。；;【]+)/,
            /关系[：:]\s*([^\n,，。；;【]{2,10})/
        ];
        for (const p of typePatterns) {
            const m = content.match(p) || name.match(p);
            if (m) { relType = m[1].trim(); break; }
        }

        const nameKeywords = name.match(/["""]([^"""]+)["""]|([师徒敌对盟友朋友兄弟姐妹夫妻父子母女亲属搭档对手死敌上下级同门同僚忘年交知己战友])/g);
        if (!relType && nameKeywords) {
            relType = nameKeywords.join('');
        }
        if (!relType) relType = '关联';

        const strengthMatch = content.match(/(?:【?强度?】?|关系强度[：:])\s*(\d+)/);
        if (strengthMatch) strength = parseInt(strengthMatch[1]);

        const combined = (relType + ' ' + name + ' ' + content).toLowerCase();

        let category = 'other';
        const hostileKw = ['敌对','对抗','对立','死敌','对手','追杀','通缉','仇恨','仇人','敌人','背叛','暗杀','陷害','追捕','敌意','反目','对立与和解'];
        const familyKw = ['师徒','师父','师傅','徒弟','兄弟','姐妹','夫妻','父子','母女','亲属','家人','长辈','晚辈','父母','父亲','母亲','子女','传承','托付','忘年交','老朋友','爱情','恋人','爱人','伴侣','亲情','师徒变挚友'];
        const friendlyKw = ['盟友','朋友','友','盟','知己','搭档','同门','同僚','战友','并肩','信任','保护','和解','友好','合作','协助','帮助','照顾','引路人','交情','友谊'];
        const hierarchyKw = ['隶属','依附','下属','上下级','从属','旗下','汇报','上级','首领','部下','效忠','服从','听命'];

        const matchKw = (text, keywords) => keywords.some(kw => text.includes(kw));

        if (matchKw(combined, hostileKw)) {
            category = 'hostile';
        } else if (matchKw(combined, familyKw)) {
            category = 'family';
        } else if (matchKw(combined, friendlyKw)) {
            category = 'friendly';
        } else if (matchKw(combined, hierarchyKw)) {
            category = 'hierarchy';
        }

        if (!nodeMap[source]) {
            const newId = `auto-${source}`;
            nodeMap[source] = newId;
            nodes.push({ id: newId, label: source, type: 'character', faction: '', role: '', rank: '', description: '' });
        }
        if (!nodeMap[target]) {
            const newId = `auto-${target}`;
            nodeMap[target] = newId;
            nodes.push({ id: newId, label: target, type: 'character', faction: '', role: '', rank: '', description: '' });
        }

        const sourceNode = nodes.find(n => n.id === nodeMap[source]);
        const targetNode = nodes.find(n => n.id === nodeMap[target]);

        let graphCategory = category;
        if (category === 'hostile' || category === 'friendly') {
            const sourceIsOrg = sourceNode?.type === 'organization';
            const targetIsOrg = targetNode?.type === 'organization';
            if (sourceIsOrg || targetIsOrg) {
                graphCategory = category === 'hostile' ? 'org-hostile' : 'org-friendly';
            } else {
                graphCategory = category === 'hostile' ? 'char-hostile' : 'char-friendly';
            }
        } else if (category === 'family' || category === 'hierarchy') {
            graphCategory = category;
        }

        edges.push({
            id: rel.id,
            source: nodeMap[source],
            target: nodeMap[target],
            label: relType,
            category: graphCategory,
            rawCategory: category,
            strength,
            detail: content.substring(0, 200)
        });
    });

    res.json({ nodes, edges });
});

router.post('/:id/analyze-style', async (req, res) => {
    try {
        const { id } = req.params;
        const { suggestion } = req.body;
        const project = store.getItem('projects', id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const chapters = store.queryItems('chapters', { projectId: id })
            .filter(ch => ch.content)
            .sort((a, b) => a.chapterNumber - b.chapterNumber);

        if (chapters.length === 0) {
            return res.status(400).json({ error: '没有已完成的章节可供分析' });
        }

        const sampleChapters = chapters.slice(-5);
        const sampleText = sampleChapters.map(ch =>
            `【第${ch.chapterNumber}章 ${ch.title}】\n${ch.content.substring(0, 1500)}`
        ).join('\n\n');

        const llm = require('../services/llm');
        const apiConfig = {
            provider: process.env.LLM_PROVIDER || 'minimax',
            model: process.env.LLM_MODEL || 'MiniMax-Text-01',
            temperature: 0.3
        };

        const prompt = `你是一个顶级小说写作风格分析师。请根据用户的修改建议和已有章节内容，分析当前写作风格的优缺点，并生成精确的风格指导。

【用户修改建议】
${suggestion || '无具体建议，请全面分析'}

【近期章节样本】
${sampleText}

请严格按照以下JSON格式输出：
{
  "strengths": ["当前写作的优点1", "优点2", "优点3"],
  "weaknesses": ["需要改善的问题1", "问题2", "问题3"],
  "styleGuidance": "综合风格指导文本（200-400字），包含：1)必须保持的优点 2)需要调整的方向 3)具体的写作技巧建议",
  "adjustmentPoints": ["具体调整点1", "调整点2", "调整点3"],
  "tone": "建议的情感基调",
  "pacingGuidance": "节奏建议",
  "dialogueGuidance": "对话建议",
  "descriptionGuidance": "描写建议"
}

注意：
- 优点必须基于已有章节的实际内容，不能泛泛而谈
- 改善方向必须针对用户建议，不能偏离
- styleGuidance必须具体可执行，不能是空话
- 调整点必须是不影响已有优点的增量式改善`;

        const result = await llm.chat(
            [{ role: 'system', content: '你是顶级小说写作风格分析师，只输出JSON。' }, { role: 'user', content: prompt }],
            { maxTokens: 4096, temperature: 0.3, apiConfig }
        );
        const responseText = result.choices?.[0]?.message?.content || result.response || '';

        let parsed;
        try {
            const jsonStr = responseText.match(/\{[\s\S]*\}/)?.[0];
            parsed = JSON.parse(jsonStr);
        } catch (_) {
            parsed = {
                strengths: ['已有章节内容完整'],
                weaknesses: ['需要根据建议调整'],
                styleGuidance: responseText.substring(0, 500),
                adjustmentPoints: [suggestion || '按建议调整'],
                tone: '',
                pacingGuidance: '',
                dialogueGuidance: '',
                descriptionGuidance: ''
            };
        }

        const fullGuidance = `【风格指导 - 基于修改建议生成】

✅ 必须保持的优点：
${parsed.strengths.map(s => `· ${s}`).join('\n')}

⚠ 需要改善的方向：
${parsed.weaknesses.map(w => `· ${w}`).join('\n')}

🎯 具体调整要点：
${parsed.adjustmentPoints.map(a => `· ${a}`).join('\n')}

📝 综合写作指导：
${parsed.styleGuidance}
${parsed.tone ? `\n🎭 情感基调：${parsed.tone}` : ''}${parsed.pacingGuidance ? `\n⏱ 节奏建议：${parsed.pacingGuidance}` : ''}${parsed.dialogueGuidance ? `\n💬 对话建议：${parsed.dialogueGuidance}` : ''}${parsed.descriptionGuidance ? `\n🎨 描写建议：${parsed.descriptionGuidance}` : ''}

【原始修改建议】${suggestion || '无'}`;

        project.styleGuidance = fullGuidance;
        project.styleGuidanceUpdatedAt = new Date().toISOString();
        await store.setItem('projects', id, project);

        res.json({
            success: true,
            styleGuidance: fullGuidance,
            analysis: parsed
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id/style-guidance', async (req, res) => {
    const { id } = req.params;
    const { styleGuidance } = req.body;
    const project = store.getItem('projects', id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    project.styleGuidance = styleGuidance;
    project.styleGuidanceUpdatedAt = new Date().toISOString();
    await store.setItem('projects', id, project);
    res.json({ success: true, styleGuidance });
});

router.post('/:id/remediate', async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewText, autoApply } = req.body;
        if (!reviewText) return res.status(400).json({ error: 'reviewText is required' });

        const reviewRemediation = require('../services/reviewRemediation');
        const result = await reviewRemediation.analyzeAndRemediate(id, reviewText, { autoApply: autoApply !== false });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id/remediation-status', (req, res) => {
    const { id } = req.params;
    const project = store.getItem('projects', id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.json({
        writerRules: project.writerPromptAdditions || [],
        reviewRules: project.reviewPromptAdditions || [],
        constraints: project.constraints || [],
        styleGuidance: project.styleGuidance || null
    });
});

router.delete('/:id/remediation/:type', async (req, res) => {
    const { id, type } = req.params;
    const { index } = req.body;
    const project = store.getItem('projects', id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (type === 'writer-rule' && project.writerPromptAdditions) {
        project.writerPromptAdditions.splice(index, 1);
    } else if (type === 'review-rule' && project.reviewPromptAdditions) {
        project.reviewPromptAdditions.splice(index, 1);
    } else if (type === 'style-guidance') {
        project.styleGuidance = '';
        project.styleGuidanceUpdatedAt = new Date().toISOString();
    }

    await store.setItem('projects', id, project);
    res.json({ success: true });
});

router.post('/:id/cleanup', async (req, res) => {
    const { id } = req.params;
    const { targets, keepLocked } = req.body;
    const project = store.getItem('projects', id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const fs = require('fs');
    const path = require('path');
    const result = { success: true, cleaned: {} };
    const shouldKeepLocked = keepLocked !== false;

    if (targets.includes('chapters')) {
        let del = 0;
        const chapters = store.queryItems('chapters', { projectId: id });
        for (const ch of chapters) { if (ch.id) store.deleteItem('chapters', ch.id); del++; }
        const dataDir = store.DATA_DIR;
        const chDir = path.join(dataDir, 'chapters');
        if (fs.existsSync(chDir)) {
            fs.readdirSync(chDir).filter(f => f.includes(id) && f.endsWith('.json')).forEach(f => {
                fs.unlinkSync(path.join(chDir, f));
                del++;
            });
        }
        const reviews = store.queryItems('reviews', { projectId: id });
        let delRev = 0;
        for (const rev of reviews) { if (rev.id) store.deleteItem('reviews', rev.id); delRev++; }
        const rvDir = path.join(dataDir, 'reviews');
        if (fs.existsSync(rvDir)) {
            fs.readdirSync(rvDir).filter(f => f.includes(id) && f.endsWith('.json')).forEach(f => {
                fs.unlinkSync(path.join(rvDir, f));
                delRev++;
            });
        }
        project.currentChapter = 0;
        project.status = 'draft';
        result.cleaned.chapters = del;
        result.cleaned.reviews = delRev;
    }

    if (targets.includes('timelines')) {
        let del = 0;
        const timelines = store.queryItems('timelines', { projectId: id });
        for (const t of timelines) { if (t.id) store.deleteItem('timelines', t.id); del++; }
        const dataDir = store.DATA_DIR;
        const tlDir = path.join(dataDir, 'timelines');
        if (fs.existsSync(tlDir)) {
            fs.readdirSync(tlDir).filter(f => f.includes(id) && f.endsWith('.json')).forEach(f => {
                fs.unlinkSync(path.join(tlDir, f));
                del++;
            });
        }
        const quests = store.queryItems('quests', { projectId: id });
        let delQ = 0;
        for (const q of quests) { if (q.id) store.deleteItem('quests', q.id); delQ++; }
        const qDir = path.join(dataDir, 'quests');
        if (fs.existsSync(qDir)) {
            fs.readdirSync(qDir).filter(f => f.includes(id) && f.endsWith('.json')).forEach(f => {
                fs.unlinkSync(path.join(qDir, f));
                delQ++;
            });
        }
        result.cleaned.timelines = del;
        result.cleaned.quests = delQ;
    }

    if (targets.includes('materials')) {
        let del = 0;
        let keptFoundation = 0;
        const materials = store.queryItems('materials', { projectId: id });
        for (const mat of materials) {
            if (shouldKeepLocked && mat.isLocked) continue;
            if (store.isFoundationMaterial(mat)) { keptFoundation++; continue; }
            store.deleteItem('materials', mat.id);
            del++;
        }
        result.cleaned.materials = del;
        result.cleaned.keptLocked = shouldKeepLocked ? materials.filter(m => m.isLocked).length : 0;
        result.cleaned.keptFoundation = keptFoundation;
    }

    if (targets.includes('knowledge')) {
        let del = 0;
        const layers = store.queryItems('memory-layers', { projectId: id });
        for (const l of layers) { if (l.id) store.deleteItem('memory-layers', l.id); del++; }
        const dataDir = store.DATA_DIR;
        const mlDir = path.join(dataDir, 'memory-layers');
        if (fs.existsSync(mlDir)) {
            fs.readdirSync(mlDir).filter(f => f.includes(id) && f.endsWith('.json')).forEach(f => {
                fs.unlinkSync(path.join(mlDir, f));
                del++;
            });
        }
        const snapshots = store.queryItems('state-snapshots', { projectId: id });
        let delS = 0;
        for (const s of snapshots) { if (s.id) store.deleteItem('state-snapshots', s.id); delS++; }
        const ssDir = path.join(dataDir, 'state-snapshots');
        if (fs.existsSync(ssDir)) {
            fs.readdirSync(ssDir).filter(f => f.includes(id) && f.endsWith('.json')).forEach(f => {
                fs.unlinkSync(path.join(ssDir, f));
                delS++;
            });
        }
        const reports = store.queryItems('consistency-reports', { projectId: id });
        let delR = 0;
        for (const r of reports) { if (r.id) store.deleteItem('consistency-reports', r.id); delR++; }
        const crDir = path.join(dataDir, 'consistency-reports');
        if (fs.existsSync(crDir)) {
            fs.readdirSync(crDir).filter(f => f.includes(id) && f.endsWith('.json')).forEach(f => {
                fs.unlinkSync(path.join(crDir, f));
                delR++;
            });
        }
        result.cleaned.memoryLayers = del;
        result.cleaned.snapshots = delS;
        result.cleaned.consistencyReports = delR;
    }

    if (targets.includes('outlines')) {
        let del = 0;
        const materials = store.queryItems('materials', { projectId: id });
        for (const mat of materials) {
            if (mat.type === 'chapter-outline') {
                store.deleteItem('materials', mat.id);
                del++;
            }
        }
        result.cleaned.outlines = del;
    }

    if (targets.includes('logs')) {
        let del = 0;
        const outputDir = path.join(__dirname, '..', '..', 'output', id);
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
            del++;
        }
        const dataDir = store.DATA_DIR;
        const exportDir = path.join(dataDir, id, 'export');
        if (fs.existsSync(exportDir)) {
            fs.rmSync(exportDir, { recursive: true, force: true });
            del++;
        }
        result.cleaned.outputDirs = del;
    }

    if (targets.includes('remediation')) {
        project.writerPromptAdditions = [];
        project.reviewPromptAdditions = [];
        if (project.styleGuidance) {
            delete project.styleGuidance;
            delete project.styleGuidanceUpdatedAt;
        }
        result.cleaned.remediation = true;
    }

    project.updatedAt = new Date().toISOString();
    await store.setItem('projects', id, project);

    res.json(result);
});

router.get('/:id/cleanup-stats', (req, res) => {
    const { id } = req.params;
    const project = store.getItem('projects', id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const fs = require('fs');
    const path = require('path');
    const dataDir = store.DATA_DIR;

    const chapters = store.queryItems('chapters', { projectId: id });
    const reviews = store.queryItems('reviews', { projectId: id });
    const timelines = store.queryItems('timelines', { projectId: id });
    const quests = store.queryItems('quests', { projectId: id });
    const materials = store.queryItems('materials', { projectId: id });
    const memoryLayers = store.queryItems('memory-layers', { projectId: id });
    const snapshots = store.queryItems('state-snapshots', { projectId: id });
    const consistencyReports = store.queryItems('consistency-reports', { projectId: id });
    const outlines = materials.filter(m => m.type === 'chapter-outline');
    const lockedMaterials = materials.filter(m => m.isLocked);

    const countFiles = (dir) => {
        if (!fs.existsSync(dir)) return 0;
        return fs.readdirSync(dir).filter(f => f.includes(id) && f.endsWith('.json')).length;
    };

    const chFileCount = countFiles(path.join(dataDir, 'chapters'));
    const rvFileCount = countFiles(path.join(dataDir, 'reviews'));
    const tlFileCount = countFiles(path.join(dataDir, 'timelines'));
    const qFileCount = countFiles(path.join(dataDir, 'quests'));
    const mlFileCount = countFiles(path.join(dataDir, 'memory-layers'));
    const ssFileCount = countFiles(path.join(dataDir, 'state-snapshots'));
    const crFileCount = countFiles(path.join(dataDir, 'consistency-reports'));

    const outputDir = path.join(__dirname, '..', '..', 'output', id);
    const exportDir = path.join(dataDir, id, 'export');
    let logSize = 0;
    [outputDir, exportDir].forEach(d => {
        if (fs.existsSync(d)) {
            try { logSize += getDirSize(d); } catch {}
        }
    });

    res.json({
        chapters: { count: Math.max(chapters.length, chFileCount), reviews: Math.max(reviews.length, rvFileCount) },
        timelines: { count: Math.max(timelines.length, tlFileCount), quests: Math.max(quests.length, qFileCount) },
        materials: { count: materials.length, locked: lockedMaterials.length, unlocked: materials.length - lockedMaterials.length },
        knowledge: { memoryLayers: Math.max(memoryLayers.length, mlFileCount), snapshots: Math.max(snapshots.length, ssFileCount), consistencyReports: Math.max(consistencyReports.length, crFileCount) },
        outlines: { count: outlines.length },
        logs: { sizeBytes: logSize, hasOutput: fs.existsSync(outputDir), hasExport: fs.existsSync(exportDir) },
        remediation: {
            hasWriterAdditions: (project.writerPromptAdditions || []).length > 0,
            hasReviewAdditions: (project.reviewPromptAdditions || []).length > 0,
            hasStyleGuidance: !!project.styleGuidance
        }
    });
});

function getDirSize(dirPath) {
    let size = 0;
    const fs = require('fs');
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) { size += getDirSize(filePath); }
        else { size += stats.size; }
    }
    return size;
}

router.get('/:id/agent-model-config', (req, res) => {
    const project = store.getItem('projects', req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project.agentModelConfig || {});
});

router.put('/:id/agent-model-config', async (req, res) => {
    const project = store.getItem('projects', req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    project.agentModelConfig = req.body;
    project.updatedAt = new Date().toISOString();
    await store.setItem('projects', project.id, project);
    res.json(project.agentModelConfig);
});

router.put('/:id/targets', async (req, res) => {
    const project = store.getItem('projects', req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { targetChapterCount, targetWordCount } = req.body;
    if (targetChapterCount !== undefined) project.targetChapterCount = targetChapterCount ? parseInt(targetChapterCount) : null;
    if (targetWordCount !== undefined) project.targetWordCount = targetWordCount ? parseInt(targetWordCount) : null;
    project.updatedAt = new Date().toISOString();
    await store.setItem('projects', project.id, project);
    res.json({ targetChapterCount: project.targetChapterCount, targetWordCount: project.targetWordCount });
});

router.post('/test-connection', async (req, res) => {
    const { provider, apiKey, model, baseURL, groupId, agentLabel } = req.body;
    if (!provider) return res.status(400).json({ error: 'provider is required' });

    const llm = require('../services/llm');
    try {
        let resolvedApiKey = apiKey || '';
        let resolvedModel = model || 'default';
        let resolvedBaseURL = baseURL || '';
        let resolvedGroupId = groupId || '';

        if (!resolvedApiKey) {
            if (provider === 'aliyunCoding') { resolvedApiKey = process.env.ALIYUN_CODING_API_KEY || ''; resolvedModel = resolvedModel === 'default' ? (process.env.ALIYUN_CODING_MODEL || 'qwen3.6-plus') : resolvedModel; resolvedBaseURL = resolvedBaseURL || 'https://coding.dashscope.aliyuncs.com/v1'; }
            else if (provider === 'minimax') { resolvedApiKey = process.env.MINIMAX_API_KEY || ''; resolvedModel = resolvedModel === 'default' ? (process.env.MINIMAX_MODEL || 'MiniMax-M2.7') : resolvedModel; resolvedBaseURL = resolvedBaseURL || 'https://api.minimaxi.com/v1'; resolvedGroupId = resolvedGroupId || process.env.MINIMAX_GROUP_ID || ''; }
            else if (provider === 'lmstudio') { resolvedApiKey = 'lmstudio'; resolvedModel = resolvedModel === 'default' ? (process.env.LMSTUDIO_MODEL || 'default') : resolvedModel; resolvedBaseURL = resolvedBaseURL || process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'; }
            else if (provider === 'siliconflow') { resolvedApiKey = process.env.SILICONFLOW_API_KEY || ''; resolvedBaseURL = resolvedBaseURL || 'https://api.siliconflow.cn/v1'; }
            else if (provider === 'deepseek') { resolvedApiKey = process.env.DEEPSEEK_API_KEY || ''; resolvedBaseURL = resolvedBaseURL || 'https://api.deepseek.com'; }
        }

        const apiConfig = { provider, apiKey: resolvedApiKey, model: resolvedModel, baseURL: resolvedBaseURL, groupId: resolvedGroupId };
        const agentName = agentLabel || provider;
        const result = await llm.chat(
            [{ role: 'system', content: '你必须严格按照指定格式回复，不要添加任何额外内容。' },
             { role: 'user', content: `严格按此格式回复，不要添加其他内容：我是${agentName}，我使用的是${resolvedModel}模型` }],
            { maxTokens: 500, temperature: 0.01, apiConfig, timeout: 30000 }
        );
        const text = result.response || result.choices?.[0]?.message?.content || '';
        const actualModel = result.model || resolvedModel;
        res.json({ success: true, message: text.substring(0, 200), provider, model: actualModel, agentLabel: agentName });
    } catch (err) {
        res.json({ success: false, message: err.message, provider, model });
    }
});

module.exports = router;
