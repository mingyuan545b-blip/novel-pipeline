const express = require('express');
const router = express.Router();
const store = require('../store');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND, INTERNAL_ERROR } = ERROR_CODES;

const PROFILES_DIR = path.join(store.DATA_DIR, 'worldview-profiles');

if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
}

router.get('/', (req, res) => {
    try {
        const files = fs.readdirSync(PROFILES_DIR).filter(f => f.endsWith('.json'));
        const profiles = files.map(f => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(PROFILES_DIR, f), 'utf-8').replace(/^\uFEFF/, ''));
                return { id: data.id, name: data.name, description: data.description, createdAt: data.createdAt };
            } catch (e) { return null; }
        }).filter(Boolean);
        res.json(profiles);
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.get('/:id', (req, res) => {
    try {
        const filePath = path.join(PROFILES_DIR, `${req.params.id}.json`);
        if (!fs.existsSync(filePath)) return res.apiError(NOT_FOUND.statusCode, 'Profile not found', NOT_FOUND.code);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''));
        res.json(data);
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/', (req, res) => {
    try {
        const { name, description, agentOverrides, constraints, styleGuidance, materialTemplates } = req.body;
        const id = `wvp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const profile = {
            id, name: name || '未命名世界观', description: description || '',
            agentOverrides: agentOverrides || {},
            constraints: constraints || [],
            styleGuidance: styleGuidance || '',
            materialTemplates: materialTemplates || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(path.join(PROFILES_DIR, `${id}.json`), JSON.stringify(profile, null, 2), 'utf-8');
        res.json({ success: true, profile });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.put('/:id', (req, res) => {
    try {
        const filePath = path.join(PROFILES_DIR, `${req.params.id}.json`);
        if (!fs.existsSync(filePath)) return res.apiError(NOT_FOUND.statusCode, 'Profile not found', NOT_FOUND.code);
        const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''));
        const updated = { ...existing, ...req.body, id: existing.id, updatedAt: new Date().toISOString() };
        fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
        res.json({ success: true, profile: updated });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.delete('/:id', (req, res) => {
    try {
        const filePath = path.join(PROFILES_DIR, `${req.params.id}.json`);
        if (!fs.existsSync(filePath)) return res.apiError(NOT_FOUND.statusCode, 'Profile not found', NOT_FOUND.code);
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/:id/apply/:projectId', async (req, res) => {
    try {
        const profilePath = path.join(PROFILES_DIR, `${req.params.id}.json`);
        if (!fs.existsSync(profilePath)) return res.apiError(NOT_FOUND.statusCode, 'Profile not found', NOT_FOUND.code);

        const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8').replace(/^\uFEFF/, ''));
        const project = await store.getItem('projects', req.params.projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

        if (profile.constraints?.length) {
            project.constraints = profile.constraints;
        }
        if (profile.styleGuidance) {
            project.styleGuidance = profile.styleGuidance;
            project.styleGuidanceUpdatedAt = new Date().toISOString();
        }
        if (profile.agentOverrides && Object.keys(profile.agentOverrides).length > 0) {
            project.agentOverrides = profile.agentOverrides;
        }
        project.worldviewProfileId = profile.id;
        project.worldviewProfileName = profile.name;
        project.updatedAt = new Date().toISOString();
        await store.setItem('projects', req.params.projectId, project);

        if (profile.materialTemplates?.length) {
            const existingMats = await store.queryItems('materials', { projectId: req.params.projectId });
            for (const m of existingMats) {
                await store.deleteItem('materials', m.id);
            }

            for (const tmpl of profile.materialTemplates) {
                const matId = uuidv4();
                await store.setItem('materials', matId, {
                    id: matId,
                    projectId: req.params.projectId,
                    type: tmpl.type || 'worldview',
                    name: tmpl.name,
                    initialContent: tmpl.content,
                    currentContent: tmpl.content,
                    archived: false,
                    locked: false,
                    changeLog: [{ version: 1, reason: `世界观切换: ${profile.name}`, updatedAt: new Date().toISOString() }],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        }

        res.json({
            success: true,
            applied: {
                constraints: profile.constraints?.length || 0,
                styleGuidance: !!profile.styleGuidance,
                agentOverrides: Object.keys(profile.agentOverrides || {}).length,
                materials: profile.materialTemplates?.length || 0
            }
        });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

router.post('/save-from-project/:projectId', async (req, res) => {
    try {
        const project = await store.getItem('projects', req.params.projectId);
        if (!project) return res.apiError(NOT_FOUND.statusCode, 'Project not found', NOT_FOUND.code);

        const { name, description } = req.body;
        const materials = await store.queryItems('materials', { projectId: req.params.projectId });

        const materialTemplates = materials.map(m => ({
            type: m.type,
            name: m.name,
            content: m.currentContent || m.initialContent
        }));

        const id = `wvp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const profile = {
            id, name: name || project.name, description: description || `从项目 ${project.name} 提取的世界观配置`,
            agentOverrides: project.agentOverrides || {},
            constraints: project.constraints || [],
            styleGuidance: project.styleGuidance || '',
            materialTemplates,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(path.join(PROFILES_DIR, `${id}.json`), JSON.stringify(profile, null, 2), 'utf-8');
        res.json({ success: true, profile: { id: profile.id, name: profile.name, materialCount: materialTemplates.length } });
    } catch (e) {
        return res.apiError(INTERNAL_ERROR.statusCode, e.message, INTERNAL_ERROR.code);
    }
});

module.exports = router;
