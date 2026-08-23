const logger = require('../shared/logger');
const express = require('express');
const router = express.Router();
const store = require('../store');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

router.post('/:id/create-product', async (req, res) => {
    try {
        const { name, genre, targetChapters, inheritCharacterIds, newSeriesFocus, styleTemplateId, constraints, importWorldview, sourceProjectId } = req.body;
        const franchise = await store.getItem('franchises', req.params.id);
        if (!franchise) return res.apiError(NOT_FOUND.statusCode, '世界观不存在', NOT_FOUND.code);

        const existingProducts = await store.queryItems('projects', { franchiseId: req.params.id });
        const sequence = existingProducts.length + 1;

        const project = {
            id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            name: name || `${franchise.name} 第${sequence}部`,
            description: newSeriesFocus || '',
            genre: genre || franchise.genre || '',
            targetChapters: targetChapters ?? 100,
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
            const firstChar = await store.getItem('materials', inheritCharacterIds[0]);
            if (firstChar) srcProjId = firstChar.projectId;
        }
        if (!srcProjId && existingProducts.length > 0) {
            srcProjId = existingProducts[0].id;
        }

        const inheritedCounts = { characters: 0, relationships: 0, worldview: 0, location: 0, mapNodes: 0 };

        if (inheritCharacterIds && inheritCharacterIds.length > 0) {
            await inheritCharacters(project, req.params.id, inheritCharacterIds, inheritedCounts);
        }

        if (importWorldview && srcProjId) {
            await inheritWorldview(project, srcProjId, inheritedCounts);
        }

        res.json({ data: project, success: true, inheritedCounts });
    } catch (error) {
        logger.error('franchiseProductRout', '[FRANCHISE] create-product error:', error);
        res.apiError(INTERNAL_ERROR.statusCode, error.message, INTERNAL_ERROR.code);
    }
});

async function inheritCharacters(project, franchiseId, inheritCharacterIds, inheritedCounts) {
    const projects = await store.queryItems('projects', { franchiseId });
    const allChars = [];
    const allRels = [];
    for (const p of projects) {
        const chars = await store.queryItems('materials', { projectId: p.id, type: 'character' });
        allChars.push(...chars);
        const rels = await store.queryItems('materials', { projectId: p.id, type: 'relationship' });
        allRels.push(...rels);
    }

    const inheritedChars = allChars.filter(c => inheritCharacterIds.includes(c.id));
    const inheritedCharNames = inheritedChars.map(c => c.name);
    const inheritedRels = allRels.filter(r => {
        const name = r.name || '';
        return inheritedCharNames.some(n => name.includes(n));
    });

    for (const c of inheritedChars) {
        const newMat = {
            id: 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            projectId: project.id, type: 'character', name: c.name,
            currentContent: c.currentContent || '', version: 1, status: 'active',
            sourceProjectId: c.sourceProjectId || c.projectId, inheritedFrom: c.projectId,
            changeLog: [{ action: 'inherit', from: c.projectId, chapterNumber: 0, timestamp: new Date().toISOString(), reason: `从${c.sourceProjectName || '前作'}继承` }],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await store.setItem('materials', newMat.id, newMat);
        inheritedCounts.characters++;
    }

    for (const r of inheritedRels) {
        const newRel = {
            id: 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            projectId: project.id, type: 'relationship', name: r.name,
            currentContent: r.currentContent || '', version: 1, status: 'active',
            inheritedFrom: r.projectId,
            changeLog: [{ action: 'inherit', from: r.projectId, chapterNumber: 0, timestamp: new Date().toISOString(), reason: '从前作继承关系' }],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await store.setItem('materials', newRel.id, newRel);
        inheritedCounts.relationships++;
    }
}

async function inheritWorldview(project, srcProjId, inheritedCounts) {
    const worldviewMats = await store.queryItems('materials', { projectId: srcProjId, type: 'worldview' });
    for (const w of worldviewMats) {
        const exists = (await store.queryItems('materials', { projectId: project.id, type: 'worldview' }))
            .find(m => m.name === w.name);
        if (exists) continue;
        const newWv = {
            id: 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            projectId: project.id, type: 'worldview', name: w.name,
            currentContent: w.currentContent || '', version: 1, status: 'active',
            inheritedFrom: w.projectId,
            changeLog: [{ action: 'inherit', from: w.projectId, chapterNumber: 0, timestamp: new Date().toISOString(), reason: '世界观继承' }],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await store.setItem('materials', newWv.id, newWv);
        inheritedCounts.worldview++;
    }

    const locationMats = await store.queryItems('materials', { projectId: srcProjId, type: 'location' });
    for (const loc of locationMats) {
        const newLoc = {
            id: 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            projectId: project.id, type: 'location', name: loc.name,
            currentContent: loc.currentContent || '', version: 1, status: 'active',
            inheritedFrom: loc.projectId,
            changeLog: [{ action: 'inherit', from: loc.projectId, chapterNumber: 0, timestamp: new Date().toISOString(), reason: '地点继承' }],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await store.setItem('materials', newLoc.id, newLoc);
        inheritedCounts.location++;
    }

    const srcMapNodes = await store.queryItems('map-nodes', { projectId: srcProjId });
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

module.exports = router;
