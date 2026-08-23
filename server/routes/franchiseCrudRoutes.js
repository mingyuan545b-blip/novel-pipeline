const express = require('express');
const router = express.Router();
const store = require('../store');
const { importFromProject } = require('./franchiseImportHelper');
const { ERROR_CODES } = require('../shared/errorCodes');

const { VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.get('/', async (req, res) => {
    try {
        const franchises = await store.queryItems('franchises', {});
        for (const f of franchises) {
            f.projects = await store.queryItems('projects', { franchiseId: f.id });
        }
        res.json({ data: franchises });
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const franchise = await store.getItem('franchises', req.params.id);
        if (!franchise) return res.apiError(NOT_FOUND.statusCode, '世界观不存在', NOT_FOUND.code);
        franchise.projects = await store.queryItems('projects', { franchiseId: franchise.id });
        res.json({ data: franchise });
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, description, worldview, genre, importFromProjectId, importCategories } = req.body;
        if (!name) return res.apiError(VALIDATION_ERROR.statusCode, '名称必填', VALIDATION_ERROR.code);

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
            await importFromProject(franchise, importFromProjectId, importCategories, importCounts);
        }

        res.json({ data: franchise, success: true, importCounts });
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.put('/:id', async (req, res) => {
    try {
        const franchise = await store.getItem('franchises', req.params.id);
        if (!franchise) return res.apiError(NOT_FOUND.statusCode, '世界观不存在', NOT_FOUND.code);

        const { name, description, worldview, genre } = req.body;
        if (name !== undefined) franchise.name = name;
        if (description !== undefined) franchise.description = description;
        if (worldview !== undefined) franchise.worldview = worldview;
        if (genre !== undefined) franchise.genre = genre;
        franchise.updatedAt = new Date().toISOString();

        await store.setItem('franchises', franchise.id, franchise);
        res.json({ data: franchise, success: true });
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const franchise = await store.getItem('franchises', req.params.id);
        if (!franchise) return res.apiError(NOT_FOUND.statusCode, '世界观不存在', NOT_FOUND.code);

        const linkedProjects = await store.queryItems('projects', { franchiseId: req.params.id });
        if (linkedProjects.length > 0) {
            return res.apiError(VALIDATION_ERROR.statusCode, `该世界观下还有${linkedProjects.length}个产品，请先解除关联`, VALIDATION_ERROR.code);
        }

        await store.deleteItem('franchises', req.params.id);
        res.json({ success: true });
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/project-overview/:projectId', async (req, res) => {
    try {
        const project = await store.getItem('projects', req.params.projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, '项目不存在', NOT_FOUND.code);

        const materials = await store.queryItems('materials', { projectId: req.params.projectId });
        const mapNodes = await store.queryItems('map-nodes', { projectId: req.params.projectId });
        const quests = await store.queryItems('quests', { projectId: req.params.projectId });
        const timelines = await store.queryItems('timelines', { projectId: req.params.projectId });

        const categories = buildOverviewCategories(materials, mapNodes, quests, timelines);

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
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

router.get('/:id/characters', async (req, res) => {
    try {
        const franchise = await store.getItem('franchises', req.params.id);
        if (!franchise) return res.apiError(NOT_FOUND.statusCode, '世界观不存在', NOT_FOUND.code);

        const projects = await store.queryItems('projects', { franchiseId: req.params.id });
        const allCharacters = [];
        const relationships = [];

        for (const p of projects) {
            const chars = await store.queryItems('materials', { projectId: p.id, type: 'character' });
            for (const c of chars) {
                allCharacters.push({ ...c, sourceProjectId: p.id, sourceProjectName: p.name });
            }
            const rels = await store.queryItems('materials', { projectId: p.id, type: 'relationship' });
            relationships.push(...rels);
        }

        res.json({ data: { characters: allCharacters, relationships } });
    } catch (error) {
        return res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

function buildOverviewCategories(materials, mapNodes, quests, timelines) {
    const matTypes = [
        { key: 'characters', label: '人物设定', icon: '👤', type: 'character' },
        { key: 'relationships', label: '人物关系', icon: '🔗', type: 'relationship' },
        { key: 'worldview', label: '世界观/背景', icon: '🌍', type: 'worldview' },
        { key: 'location', label: '地点/势力', icon: '🏰', type: 'location' },
        { key: 'equipment', label: '装备/道具', icon: '⚔', type: 'equipment' },
        { key: 'powerSystem', label: '战力体系', icon: '⚡', type: 'power-system' },
        { key: 'plot', label: '剧情/事件', icon: '📜', type: 'plot' },
        { key: 'other', label: '其他元素', icon: '📦', type: 'other' }
    ];

    const categories = matTypes.map(mt => ({
        key: mt.key, label: mt.label, icon: mt.icon, type: mt.type,
        count: materials.filter(m => m.type === mt.type).length,
        items: materials.filter(m => m.type === mt.type).map(m => ({ id: m.id, name: m.name, preview: (m.currentContent || '').substring(0, 60) }))
    }));

    categories.push(
        { key: 'mapNodes', label: '地图节点', icon: '🗺', type: 'map-node', count: mapNodes.length, items: mapNodes.map(n => ({ id: n.id, name: n.name, preview: n.description?.substring(0, 60) || '' })) },
        { key: 'quests', label: '任务/线索', icon: '🎯', type: 'quest', count: quests.length, items: quests.map(q => ({ id: q.id, name: q.title, preview: (q.description || '').substring(0, 60) })) },
        { key: 'timelines', label: '时间线', icon: '⏳', type: 'timeline', count: timelines.length, items: timelines.map(t => ({ id: t.id, name: t.title, preview: (t.description || '').substring(0, 60) })) }
    );

    return categories;
}

module.exports = router;
