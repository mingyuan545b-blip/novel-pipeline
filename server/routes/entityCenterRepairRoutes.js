const logger = require('../shared/logger');
const store = require('../store');
const router = require('express').Router();
const { resolveMaterialName } = require('../services/pipeline/materialNameResolver');
const { ERROR_CODES } = require('../shared/errorCodes');

const { INTERNAL_ERROR } = ERROR_CODES;

router.post('/sync-from-materials/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const entityCenter = require('../services/entityCenter');
        const materials = await store.queryItems('materials', { projectId });
        const existingEntities = await store.queryItems('entity-registry', { projectId });
        const existingIds = new Set(existingEntities.map(e => e.id));
        const project = await store.getItem('projects', projectId);
        const protagonistName = project?.styleProfile?.protagonistName || '';
        let synced = 0;
        let skipped = 0;

        for (const mat of materials) {
            if (mat.archived) { skipped++; continue; }
            if (mat.type !== 'character') { continue; }
            if (existingIds.has(mat.id)) { skipped++; continue; }

            let roleLevel = mat.roleLevel || 'npc';
            const isProtagonist = (protagonistName && mat.name === protagonistName)
                || mat.tags?.includes('主角')
                || mat.isMainCharacter;
            roleLevel = isProtagonist ? 'protagonist' : roleLevel;

            const content = mat.currentContent || mat.initialContent || '';
            const { extractCharacterStateFromContent } = require('../services/pipeline/outlineResponseParser');
            const parsed = extractCharacterStateFromContent(content, {});
            await entityCenter.getOrCreateEntity(projectId, 'character', resolveMaterialName(mat), {
                roleLevel,
                sourceChapter: mat.sourceChapter || 0,
                position: mat.position || parsed.position || '',
                personality: mat.personality || parsed.personality || '',
                speakingTone: mat.speakingTone || parsed.speakingTone || '',
                signatureDetail: mat.signatureDetail || parsed.signatureDetail || '',
                craftStyle: mat.craftStyle || parsed.craftStyle || '',
                profile: parsed.profile || {},
                sourceContent: content.substring(0, 2000)
            });
            synced++;
        }

        res.json({ success: true, synced, skipped, total: materials.length });
    } catch (err) {
        res.apiError(INTERNAL_ERROR.statusCode, 'Sync failed', INTERNAL_ERROR.code, { message: err.message });
    }
});

router.post('/repair-registry/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { syncToRegistry, getEntitiesForProject, updateEntity } = require('../services/entityCenter/entityCRUD');
        const entities = await getEntitiesForProject(projectId, { entityType: 'character' });
        let repaired = 0;

        for (const entity of entities) {
            if (entity.sourceContent) {
                const { extractCharacterStateFromContent } = require('../services/pipeline/outlineResponseParser');
                const parsed = extractCharacterStateFromContent(entity.sourceContent, {});
                const updates = {};
                const fillableFields = ['position', 'personality', 'speakingTone', 'signatureDetail', 'craftStyle', 'factionName'];
                for (const field of fillableFields) {
                    if (!entity[field] && parsed[field]) updates[field] = parsed[field];
                }
                if (parsed.profile && Object.keys(parsed.profile).some(k => parsed.profile[k])) {
                    updates.profile = { ...(entity.profile || {}), ...parsed.profile };
                }
                if (Object.keys(updates).length > 0) {
                    await updateEntity(entity.id, updates);
                    repaired++;
                }
            }
            await syncToRegistry(entity);
        }

        res.json({ success: true, entitiesProcessed: entities.length, repaired });
    } catch (err) {
        res.apiError(INTERNAL_ERROR.statusCode, 'Repair failed', INTERNAL_ERROR.code, { message: err.message });
    }
});

router.post('/deep-repair/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { getEntitiesForProject, syncToRegistry, updateEntity } = require('../services/entityCenter/entityCRUD');
        const entities = await getEntitiesForProject(projectId, { entityType: 'character' });
        const FIELDS_TO_CHECK = ['position', 'personality', 'speakingTone', 'signatureDetail', 'craftStyle', 'factionName'];

        const incomplete = entities.filter(e => FIELDS_TO_CHECK.some(f => !e[f]));
        if (incomplete.length === 0) {
            return res.json({ success: true, message: '所有角色字段完整', deepRepaired: 0 });
        }

        const llm = require('../services/llm');
        let deepRepaired = 0;

        for (const entity of incomplete) {
            const missing = FIELDS_TO_CHECK.filter(f => !entity[f]);
            const prompt = `根据以下角色描述，提取缺失字段。只输出JSON，不要解释。\n\n角色名：${entity.name}\n角色描述：\n${entity.sourceContent || '无'}\n\n缺失字段：${missing.join(', ')}\n\n输出格式：\n{"${missing[0]}": "值"${missing.length > 1 ? `, "${missing[1]}": "值"` : ''}${missing.length > 2 ? `, "${missing[2]}": "值"` : ''}}`;

            try {
                const result = await llm.chat(
                    [{ role: 'user', content: prompt }],
                    { temperature: 0.1, maxTokens: 300 }
                );
                const text = result?.choices?.[0]?.message?.content || '';
                const jsonMatch = text.match(/\{[^}]+\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    const updates = {};
                    for (const field of missing) {
                        if (parsed[field] && typeof parsed[field] === 'string') updates[field] = parsed[field];
                    }
                    if (Object.keys(updates).length > 0) {
                        await updateEntity(entity.id, updates);
                        await syncToRegistry({ ...entity, ...updates });
                        deepRepaired++;
                    }
                }
            } catch (e) {
                logger.warn('entityCenter', `[deep-repair] LLM failed for "${entity.name}":`, e.message);
            }
        }

        res.json({ success: true, deepRepaired, total: incomplete.length });
    } catch (err) {
        res.apiError(INTERNAL_ERROR.statusCode, 'Deep repair failed', INTERNAL_ERROR.code, { message: err.message });
    }
});

module.exports = router;
