const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const memory = require('../services/memory');
const { validateHierarchy, HIERARCHY_RULES } = require('../services/materialValidator');
const { validateMaterialDepth } = require('../services/materialDepthValidator');
const { validateMaterialDepthBatch } = require('../services/materialDepthBatch');
const { checkIntegrity, autoFix, normalizeMaterial } = require('../services/materialIntegrity');
const { createMaterial, updateMaterial, materialIdParam } = require('../middleware/validators');
const { ERROR_CODES } = require('../shared/errorCodes');

const { NOT_FOUND, VALIDATION_ERROR, FORBIDDEN } = ERROR_CODES;

const router = require('express').Router();

const { VALID_MATERIAL_TYPES } = require('../config/materialTypes');

router.get('/integrity/:projectId', (req, res) => {
    const report = checkIntegrity(req.params.projectId);
    res.json(report);
});

// 陷阱#22修复：素材深度校验端点
// GET /api/materials/depth/:projectId - 批量校验项目下所有素材深度
// GET /api/materials/depth/:projectId/:materialId - 校验单个素材深度
router.get('/depth/:projectId', async (req, res) => {
    let materials = await store.listItems('materials');
    materials = materials.filter(m => m.projectId === req.params.projectId && !m.archived);
    const result = validateMaterialDepthBatch(materials);
    res.json(result);
});

router.get('/depth/:projectId/:materialId', async (req, res) => {
    const material = await store.getItem('materials', req.params.materialId);
    if (!material || material.projectId !== req.params.projectId) {
        return res.apiError(NOT_FOUND.statusCode, 'Material not found', NOT_FOUND.code);
    }
    const result = validateMaterialDepth(material);
    res.json({ id: material.id, name: material.name, type: material.type, ...result });
});

router.post('/integrity/:projectId/fix', (req, res) => {
    const { dryRun, fixBroken, fixNameRefs, fixDuplicates } = req.body;
    const result = autoFix(req.params.projectId, { dryRun: dryRun !== false, fixBroken: fixBroken !== false, fixNameRefs: fixNameRefs !== false, fixDuplicates: fixDuplicates !== false });
    res.json(result);
});

router.get('/', async (req, res) => {
    const { projectId, type } = req.query;
    let materials = await store.listItems('materials');
    if (projectId) materials = materials.filter(m => m.projectId === projectId);
    if (type) materials = materials.filter(m => m.type === type);
    res.json(materials);
});

router.get('/types', (req, res) => {
    res.json(VALID_MATERIAL_TYPES);
});

router.get('/:id', async (req, res) => {
    const material = await store.getItem('materials', req.params.id);
    if (!material) return res.apiError(NOT_FOUND.statusCode, 'Material not found', NOT_FOUND.code);
    res.json(material);
});

router.post('/', createMaterial, async (req, res) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const contentValue = req.body.currentContent || req.body.initialContent || req.body.content || '';
    const materialType = req.body.type || 'other';
    const projectId = req.body.projectId;

    let parentPlane = req.body.parentPlane || null;
    let parentFaction = req.body.parentFaction || null;

    if (projectId && parentPlane) {
        const planeResult = normalizeMaterial({ parentPlane, parentFaction }, projectId);
        if (planeResult?.parentPlane) parentPlane = planeResult.parentPlane;
    }
    if (projectId && parentFaction) {
        const factionResult = normalizeMaterial({ parentPlane, parentFaction }, projectId);
        if (factionResult?.parentFaction) parentFaction = factionResult.parentFaction;
    }

    const hierarchyCheck = await validateHierarchy({
        type: materialType,
        parentPlane,
        parentFaction
    });

    if (!hierarchyCheck.valid) {
        return res.apiError(
            VALIDATION_ERROR.statusCode,
            '层级归属校验失败',
            VALIDATION_ERROR.code,
            {
                message: hierarchyCheck.message,
                missingFields: hierarchyCheck.missing,
                hint: getHierarchyHint(materialType)
            }
        );
    }

    const material = {
        id,
        projectId,
        type: materialType,
        name: req.body.name || 'Unnamed Material',
        description: req.body.description || '',
        initialContent: req.body.initialContent || contentValue,
        currentContent: contentValue,
        tags: req.body.tags || [],
        isLocked: req.body.isLocked || false,
        parentPlane,
        parentFaction,
        currentPlaneId: req.body.currentPlaneId || null,
        dialectRegion: req.body.dialectRegion || null,
        dialectIntensity: req.body.dialectIntensity || null,
        speechStyle: req.body.speechStyle || null,
        speechStyleIntensity: req.body.speechStyleIntensity || null,
        namingStyle: req.body.namingStyle || null,
        namingStyleIntensity: req.body.namingStyleIntensity || null,
        archetype: req.body.archetype || null,
        version: 1,
        changeLog: [{
            from: '',
            to: contentValue,
            reason: 'Initial creation',
            timestamp: now
        }],
        createdAt: now,
        updatedAt: now
    };
    await store.setItem('materials', id, material);
    res.apiOk(material, null, 201);
});

function getHierarchyHint(type) {
    const rule = HIERARCHY_RULES[type];
    if (!rule) return '';
    if (type === 'faction') return '势力必须归属位面。主世界势力设parentPlane=null，小世界势力设parentPlane为对应小世界素材ID';
    if (type === 'character') return '人物必须归属势力。设parentFaction为对应势力素材ID；若势力属于小世界，还需设parentPlane';
    if (type === 'institution') return '机构必须归属位面。主世界机构设parentPlane=null，小世界机构设parentPlane为对应小世界素材ID';
    return rule.description || '';
}

router.put('/:id', updateMaterial, async (req, res) => {
    const material = await store.getItem('materials', req.params.id);
    if (!material) return res.apiError(NOT_FOUND.statusCode, 'Material not found', NOT_FOUND.code);
    const now = new Date().toISOString();

    let normalizedRefs = {};
    if (material.projectId) {
        if (req.body.parentPlane) {
            const result = normalizeMaterial({ parentPlane: req.body.parentPlane }, material.projectId);
            if (result?.parentPlane) normalizedRefs.parentPlane = result.parentPlane;
        }
        if (req.body.parentFaction) {
            const result = normalizeMaterial({ parentFaction: req.body.parentFaction }, material.projectId);
            if (result?.parentFaction) normalizedRefs.parentFaction = result.parentFaction;
        }
    }

    const PROTECTED_FIELDS = ['id', 'projectId', 'createdAt', 'version'];
    const bodySafe = { ...req.body };
    for (const f of PROTECTED_FIELDS) delete bodySafe[f];

    const updated = {
        ...material,
        ...bodySafe,
        ...normalizedRefs,
        id: material.id,
        projectId: material.projectId,
        version: material.version + 1,
        updatedAt: now
    };
    if (req.body.currentContent && req.body.currentContent !== material.currentContent) {
        updated.changeLog = [...(material.changeLog || []), {
            from: material.currentContent,
            to: req.body.currentContent,
            reason: req.body.changeReason || 'Updated',
            timestamp: now
        }];
    }
    await store.setItem('materials', material.id, updated);
    memory.invalidateCache(material.projectId);
    res.json(updated);
});

router.delete('/:id', async (req, res) => {
    const material = await store.getItem('materials', req.params.id);
    if (!material) return res.apiError(NOT_FOUND.statusCode, 'Material not found', NOT_FOUND.code);
    if (await store.isFoundationMaterial(material)) return res.apiError(FORBIDDEN.statusCode, 'Cannot delete foundation material', FORBIDDEN.code, { name: material.name, message: '基底素材受保护，不可删除。如需修改请编辑内容。' });
    const deleted = await store.deleteItem('materials', req.params.id);
    if (!deleted) return res.apiError(NOT_FOUND.statusCode, 'Material not found', NOT_FOUND.code);
    res.json({ success: true });
});

module.exports = router;
