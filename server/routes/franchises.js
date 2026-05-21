const express = require('express');
const router = express.Router();
const store = require('../store');
const multer = require('multer');
const { parseFile, importParsedToFranchise, importParsedToProject } = require('../services/fileParser');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/project-overview/:projectId', (req, res) => {
    try {
        const project = store.getItem('projects', req.params.projectId);
        if (!project) return res.status(404).json({ error: '项目不存在' });

        const materials = store.queryItems('materials', { projectId: req.params.projectId });
        const mapNodes = store.queryItems('map-nodes', { projectId: req.params.projectId });
        const quests = store.queryItems('quests', { projectId: req.params.projectId });
        const timelines = store.queryItems('timelines', { projectId: req.params.projectId });

        const categories = [
            { key: 'characters', label: '人物设定', icon: '👤', type: 'character', count: materials.filter(m => m.type === 'character').length, items: materials.filter(m => m.type === 'character').map(m => ({ id: m.id, name: m.name, preview: (m.currentContent || '').substring(0, 60) })) },
            { key: 'relationships', label: '人物关系', icon: '🔗', type: 'relationship', count: materials.filter(m => m.type === 'relationship').length, items: materials.filter(m => m.type === 'relationship').map(m => ({ id: m.id, name: m.name, preview: (m.currentContent || '').substring(0, 60) })) },
            { key: 'worldview', label: '世界观/背景', icon: '🌍', type: 'worldview', count: materials.filter(m => m.type === 'worldview').length, items: materials.filter(m => m.type === 'worldview').map(m => ({ id: m.id, name: m.name, preview: (m.currentContent || '').substring(0, 60) })) },
            { key: 'location', label: '地点/势力', icon: '🏰', type: 'location', count: materials.filter(m => m.type === 'location').length, items: materials.filter(m => m.type === 'location').map(m => ({ id: m.id, name: m.name, preview: (m.currentContent || '').substring(0, 60) })) },
            { key: 'equipment', label: '装备/道具', icon: '⚔', type: 'equipment', count: materials.filter(m => m.type === 'equipment').length, items: materials.filter(m => m.type === 'equipment').map(m => ({ id: m.id, name: m.name, preview: (m.currentContent || '').substring(0, 60) })) },
            { key: 'powerSystem', label: '战力体系', icon: '⚡', type: 'power-system', count: materials.filter(m => m.type === 'power-system').length, items: materials.filter(m => m.type === 'power-system').map(m => ({ id: m.id, name: m.name, preview: (m.currentContent || '').substring(0, 60) })) },
            { key: 'plot', label: '剧情/事件', icon: '📜', type: 'plot', count: materials.filter(m => m.type === 'plot').length, items: materials.filter(m => m.type === 'plot').map(m => ({ id: m.id, name: m.name, preview: (m.currentContent || '').substring(0, 60) })) },
            { key: 'other', label: '其他元素', icon: '📦', type: 'other', count: materials.filter(m => m.type === 'other').length, items: materials.filter(m => m.type === 'other').map(m => ({ id: m.id, name: m.name, preview: (m.currentContent || '').substring(0, 60) })) },
            { key: 'mapNodes', label: '地图节点', icon: '🗺', type: 'map-node', count: mapNodes.length, items: mapNodes.map(n => ({ id: n.id, name: n.name, preview: n.description?.substring(0, 60) || '' })) },
            { key: 'quests', label: '任务/线索', icon: '🎯', type: 'quest', count: quests.length, items: quests.map(q => ({ id: q.id, name: q.title, preview: (q.description || '').substring(0, 60) })) },
            { key: 'timelines', label: '时间线', icon: '⏳', type: 'timeline', count: timelines.length, items: timelines.map(t => ({ id: t.id, name: t.title, preview: (t.description || '').substring(0, 60) })) }
        ];

        res.json({
            data: {
                projectId: req.params.projectId,
                projectName: project.name,
                genre: project.genre,
                description: project.description,
                categories: categories.filter(c => c.count > 0),
                totalMaterials: materials.length,
                totalMapNodes: mapNodes.length,
                totalQuests: quests.length,
                totalTimelines: timelines.length
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/', (req, res) => {
    try {
        const franchises = store.queryItems('franchises', {});
        franchises.forEach(f => {
            f.projects = store.queryItems('projects', { franchiseId: f.id });
        });
        res.json({ data: franchises });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/parse-file', upload.array('files', 20), (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: '请上传文件' });
        }

        const allParsed = [];
        const mergedCategories = {};

        for (const file of files) {
            const fileName = file.originalname;
            const ext = fileName.split('.').pop().toLowerCase();
            if (!['txt', 'md', 'markdown'].includes(ext)) {
                continue;
            }

            const parsed = parseFile(file.buffer, fileName);
            allParsed.push(parsed);

            for (const [type, items] of Object.entries(parsed.categories)) {
                if (!mergedCategories[type]) mergedCategories[type] = [];
                mergedCategories[type].push(...items);
            }
        }

        if (allParsed.length === 0) {
            return res.status(400).json({ error: '没有有效的 TXT 或 Markdown 文件' });
        }

        const categorySummary = Object.entries(mergedCategories).map(([type, items]) => ({
            key: type,
            label: getTypeLabel(type),
            icon: getTypeIcon(type),
            count: items.length,
            items: items.slice(0, 10).map(item => ({
                name: item.name,
                preview: item.preview || item.content?.substring(0, 60) || ''
            }))
        }));

        const totalSections = allParsed.reduce((sum, p) => sum + p.totalSections, 0);

        res.json({
            data: {
                fileCount: allParsed.length,
                totalSections,
                categories: categorySummary,
                parsedData: allParsed
            }
        });
    } catch (error) {
        console.error('[FRANCHISE] parse-file error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/import-parsed', (req, res) => {
    try {
        const { franchiseId, projectId, parsedData, importCategories } = req.body;
        if (!franchiseId && !projectId) return res.status(400).json({ error: 'franchiseId 或 projectId 必填' });
        if (!parsedData || parsedData.length === 0) return res.status(400).json({ error: '没有可导入的数据' });

        const importCounts = {};
        for (const parsed of parsedData) {
            if (projectId) {
                const counts = importParsedToProject(projectId, parsed, importCategories);
                for (const [type, count] of Object.entries(counts)) {
                    importCounts[type] = (importCounts[type] || 0) + count;
                }
            }
            if (franchiseId) {
                const franchise = store.getItem('franchises', franchiseId);
                if (franchise) {
                    const counts = importParsedToFranchise(franchiseId, parsed, importCategories);
                    for (const [type, count] of Object.entries(counts)) {
                        importCounts[type] = (importCounts[type] || 0) + count;
                    }
                }
            }
        }

        res.json({ success: true, importCounts });
    } catch (error) {
        console.error('[FRANCHISE] import-parsed error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/import-file-to-project', upload.array('files', 20), (req, res) => {
    try {
        const projectId = req.body.projectId;
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        const project = store.getItem('projects', projectId);
        if (!project) return res.status(404).json({ error: '项目不存在' });

        const files = req.files;
        if (!files || files.length === 0) return res.status(400).json({ error: '请上传文件' });

        const importCounts = {};
        for (const file of files) {
            const fileName = file.originalname;
            const ext = fileName.split('.').pop().toLowerCase();
            if (!['txt', 'md', 'markdown'].includes(ext)) continue;

            const parsed = parseFile(file.buffer, fileName);
            const counts = importParsedToProject(projectId, parsed, null);
            for (const [type, count] of Object.entries(counts)) {
                importCounts[type] = (importCounts[type] || 0) + count;
            }
        }

        res.json({ success: true, importCounts });
    } catch (error) {
        console.error('[FRANCHISE] import-file-to-project error:', error);
        res.status(500).json({ error: error.message });
    }
});

function getTypeLabel(type) {
    const labels = {
        'character': '人物设定', 'relationship': '人物关系', 'worldview': '世界观/背景',
        'location': '地点/势力', 'equipment': '装备/道具', 'power-system': '战力体系',
        'plot': '剧情/事件', 'other': '其他元素'
    };
    return labels[type] || type;
}

function getTypeIcon(type) {
    const icons = {
        'character': '👤', 'relationship': '🔗', 'worldview': '🌍',
        'location': '🏰', 'equipment': '⚔', 'power-system': '⚡',
        'plot': '📜', 'other': '📦'
    };
    return icons[type] || '📄';
}

router.get('/:id', (req, res) => {
    try {
        const franchise = store.getItem('franchises', req.params.id);
        if (!franchise) return res.status(404).json({ error: '世界观不存在' });
        franchise.projects = store.queryItems('projects', { franchiseId: franchise.id });
        res.json({ data: franchise });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, description, worldview, genre, importFromProjectId, importCategories } = req.body;
        if (!name) return res.status(400).json({ error: '名称必填' });

        const franchise = {
            id: 'fr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            name,
            description: description || '',
            worldview: worldview || '',
            genre: genre || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await store.setItem('franchises', franchise.id, franchise);

        const importCounts = { characters: 0, relationships: 0, worldview: 0, location: 0, equipment: 0, powerSystem: 0, plot: 0, other: 0, mapNodes: 0, quests: 0, timelines: 0 };

        if (importFromProjectId && importCategories && importCategories.length > 0) {
            const srcProject = store.getItem('projects', importFromProjectId);
            if (srcProject) {
                if (!franchise.genre && srcProject.genre) franchise.genre = srcProject.genre;
                if (!franchise.description && srcProject.description) franchise.description = srcProject.description.substring(0, 500);
                franchise.sourceProjectId = importFromProjectId;
                franchise.updatedAt = new Date().toISOString();
                await store.setItem('franchises', franchise.id, franchise);

                const allMats = store.queryItems('materials', { projectId: importFromProjectId });
                const typeMap = {
                    characters: 'character',
                    relationships: 'relationship',
                    worldview: 'worldview',
                    location: 'location',
                    equipment: 'equipment',
                    powerSystem: 'power-system',
                    plot: 'plot',
                    other: 'other'
                };

                for (const cat of importCategories) {
                    const matType = typeMap[cat];
                    if (!matType) continue;
                    const mats = allMats.filter(m => m.type === matType);
                    for (const m of mats) {
                        const summary = {
                            id: 'fs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                            franchiseId: franchise.id,
                            sourceProjectId: importFromProjectId,
                            sourceMaterialId: m.id,
                            type: m.type,
                            name: m.name,
                            content: m.currentContent || m.initialContent || '',
                            importedAt: new Date().toISOString()
                        };
                        await store.setItem('franchise-materials', summary.id, summary);
                        importCounts[cat] = (importCounts[cat] || 0) + 1;
                    }
                }

                if (importCategories.includes('mapNodes')) {
                    const srcMapNodes = store.queryItems('map-nodes', { projectId: importFromProjectId });
                    for (const node of srcMapNodes) {
                        const summary = {
                            id: 'fs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                            franchiseId: franchise.id,
                            sourceProjectId: importFromProjectId,
                            type: 'map-node',
                            name: node.name,
                            level: node.level,
                            parentId: node.parentId,
                            content: node.description || '',
                            factionName: node.factionName || '',
                            importedAt: new Date().toISOString()
                        };
                        await store.setItem('franchise-materials', summary.id, summary);
                        importCounts.mapNodes++;
                    }
                }

                if (importCategories.includes('quests')) {
                    const srcQuests = store.queryItems('quests', { projectId: importFromProjectId });
                    for (const q of srcQuests) {
                        const summary = {
                            id: 'fs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                            franchiseId: franchise.id,
                            sourceProjectId: importFromProjectId,
                            type: 'quest',
                            name: q.title,
                            content: q.description || '',
                            importedAt: new Date().toISOString()
                        };
                        await store.setItem('franchise-materials', summary.id, summary);
                        importCounts.quests++;
                    }
                }

                if (importCategories.includes('timelines')) {
                    const srcTimelines = store.queryItems('timelines', { projectId: importFromProjectId });
                    for (const t of srcTimelines) {
                        const summary = {
                            id: 'fs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                            franchiseId: franchise.id,
                            sourceProjectId: importFromProjectId,
                            type: 'timeline',
                            name: t.title,
                            content: t.description || '',
                            importedAt: new Date().toISOString()
                        };
                        await store.setItem('franchise-materials', summary.id, summary);
                        importCounts.timelines++;
                    }
                }
            }
        }

        res.json({ data: franchise, success: true, importCounts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const franchise = store.getItem('franchises', req.params.id);
        if (!franchise) return res.status(404).json({ error: '世界观不存在' });

        const { name, description, worldview, genre } = req.body;
        if (name !== undefined) franchise.name = name;
        if (description !== undefined) franchise.description = description;
        if (worldview !== undefined) franchise.worldview = worldview;
        if (genre !== undefined) franchise.genre = genre;
        franchise.updatedAt = new Date().toISOString();

        await store.setItem('franchises', franchise.id, franchise);
        res.json({ data: franchise, success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', (req, res) => {
    try {
        const franchise = store.getItem('franchises', req.params.id);
        if (!franchise) return res.status(404).json({ error: '世界观不存在' });

        const linkedProjects = store.queryItems('projects', { franchiseId: req.params.id });
        if (linkedProjects.length > 0) {
            return res.status(400).json({ error: `该世界观下还有${linkedProjects.length}个产品，请先解除关联` });
        }

        store.deleteItem('franchises', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id/characters', (req, res) => {
    try {
        const franchise = store.getItem('franchises', req.params.id);
        if (!franchise) return res.status(404).json({ error: '世界观不存在' });

        const projects = store.queryItems('projects', { franchiseId: req.params.id });
        const allCharacters = [];
        projects.forEach(p => {
            const chars = store.queryItems('materials', { projectId: p.id, type: 'character' });
            chars.forEach(c => {
                allCharacters.push({
                    ...c,
                    sourceProjectId: p.id,
                    sourceProjectName: p.name
                });
            });
        });

        const relationships = [];
        projects.forEach(p => {
            const rels = store.queryItems('materials', { projectId: p.id, type: 'relationship' });
            relationships.push(...rels);
        });

        res.json({ data: { characters: allCharacters, relationships } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:id/create-product', async (req, res) => {
    try {
        const { name, genre, targetChapters, inheritCharacterIds, newSeriesFocus, styleTemplateId, constraints, importWorldview, sourceProjectId } = req.body;
        const franchise = store.getItem('franchises', req.params.id);
        if (!franchise) return res.status(404).json({ error: '世界观不存在' });

        const existingProducts = store.queryItems('projects', { franchiseId: req.params.id });
        const sequence = existingProducts.length + 1;

        const project = {
            id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            name: name || `${franchise.name} 第${sequence}部`,
            description: newSeriesFocus || '',
            genre: genre || franchise.genre || '',
            targetChapters: targetChapters || 100,
            status: 'created',
            franchiseId: req.params.id,
            franchiseSequence: sequence,
            styleTemplateId: styleTemplateId || '',
            constraints: constraints || [],
            settings: { autoPipeline: false, chapterRounds: 3 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await store.setItem('projects', project.id, project);

        let srcProjId = sourceProjectId;
        if (!srcProjId && inheritCharacterIds && inheritCharacterIds.length > 0) {
            const firstChar = store.getItem('materials', inheritCharacterIds[0]);
            if (firstChar) srcProjId = firstChar.projectId;
        }
        if (!srcProjId && existingProducts.length > 0) {
            srcProjId = existingProducts[0].id;
        }

        const inheritedCounts = { characters: 0, relationships: 0, worldview: 0, location: 0, mapNodes: 0 };

        if (inheritCharacterIds && inheritCharacterIds.length > 0) {
            const franchiseData = await new Promise((resolve) => {
                const projects = store.queryItems('projects', { franchiseId: req.params.id });
                const allChars = [];
                const allRels = [];
                projects.forEach(p => {
                    const chars = store.queryItems('materials', { projectId: p.id, type: 'character' });
                    allChars.push(...chars);
                    const rels = store.queryItems('materials', { projectId: p.id, type: 'relationship' });
                    allRels.push(...rels);
                });
                resolve({ characters: allChars, relationships: allRels });
            });

            const inheritedChars = franchiseData.characters.filter(c => inheritCharacterIds.includes(c.id));
            const inheritedCharNames = inheritedChars.map(c => c.name);
            const inheritedRels = franchiseData.relationships.filter(r => {
                const name = r.name || '';
                return inheritedCharNames.some(n => name.includes(n));
            });

            for (const c of inheritedChars) {
                const newMat = {
                    id: 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                    projectId: project.id,
                    type: 'character',
                    name: c.name,
                    currentContent: c.currentContent || '',
                    version: 1,
                    status: 'active',
                    sourceProjectId: c.sourceProjectId || c.projectId,
                    inheritedFrom: c.projectId,
                    changeLog: [{ action: 'inherit', from: c.projectId, chapterNumber: 0, timestamp: new Date().toISOString(), reason: `从${c.sourceProjectName || '前作'}继承` }],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await store.setItem('materials', newMat.id, newMat);
                inheritedCounts.characters++;
            }

            for (const r of inheritedRels) {
                const newRel = {
                    id: 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                    projectId: project.id,
                    type: 'relationship',
                    name: r.name,
                    currentContent: r.currentContent || '',
                    version: 1,
                    status: 'active',
                    inheritedFrom: r.projectId,
                    changeLog: [{ action: 'inherit', from: r.projectId, chapterNumber: 0, timestamp: new Date().toISOString(), reason: '从前作继承关系' }],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await store.setItem('materials', newRel.id, newRel);
                inheritedCounts.relationships++;
            }
        }

        if (importWorldview && srcProjId) {
            const worldviewMats = store.queryItems('materials', { projectId: srcProjId, type: 'worldview' });
            for (const w of worldviewMats) {
                const exists = store.queryItems('materials', { projectId: project.id, type: 'worldview' })
                    .find(m => m.name === w.name);
                if (exists) continue;
                const newWv = {
                    id: 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                    projectId: project.id,
                    type: 'worldview',
                    name: w.name,
                    currentContent: w.currentContent || '',
                    version: 1,
                    status: 'active',
                    inheritedFrom: w.projectId,
                    changeLog: [{ action: 'inherit', from: w.projectId, chapterNumber: 0, timestamp: new Date().toISOString(), reason: '世界观继承' }],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await store.setItem('materials', newWv.id, newWv);
                inheritedCounts.worldview++;
            }

            const locationMats = store.queryItems('materials', { projectId: srcProjId, type: 'location' });
            for (const loc of locationMats) {
                const newLoc = {
                    id: 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                    projectId: project.id,
                    type: 'location',
                    name: loc.name,
                    currentContent: loc.currentContent || '',
                    version: 1,
                    status: 'active',
                    inheritedFrom: loc.projectId,
                    changeLog: [{ action: 'inherit', from: loc.projectId, chapterNumber: 0, timestamp: new Date().toISOString(), reason: '地点继承' }],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await store.setItem('materials', newLoc.id, newLoc);
                inheritedCounts.location++;
            }

            const srcMapNodes = store.queryItems('map-nodes', { projectId: srcProjId });
            if (srcMapNodes.length > 0) {
                const idMap = {};
                srcMapNodes.forEach(node => {
                    const newId = 'mn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
                    idMap[node.id] = newId;
                });
                for (const node of srcMapNodes) {
                    const newNode = {
                        ...node,
                        id: idMap[node.id],
                        projectId: project.id,
                        parentId: node.parentId ? (idMap[node.parentId] || null) : null,
                        inheritedFrom: node.projectId,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    await store.setItem('map-nodes', newNode.id, newNode);
                    inheritedCounts.mapNodes++;
                }
            }
        }

        res.json({ data: project, success: true, inheritedCounts });
    } catch (error) {
        console.error('[FRANCHISE] create-product error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
