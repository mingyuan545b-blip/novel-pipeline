const { v4: uuidv4 } = require('uuid');
const store = require('../../../store');
const { validateNewMaterial } = require('../../genreConfig');

function extractFromMarkdown(mdText, chapter, projectId, materials, styleProfile) {
    const appliedUpdates = [];

    console.log(`[PIPELINE] material-manager JSON parse failed, trying markdown extraction for ch${chapter.chapterNumber}`);

    const headingRegex = /#{1,5}\s*\[(character|worldview|power-system|foreshadowing|relationship|equipment|location|famous-scene|catchphrase|growth-history)\]\s*([^(]+?)\s*\(v\d+\)/gi;
    const headingMatches = [...mdText.matchAll(headingRegex)];

    if (headingMatches.length === 0) return appliedUpdates;

    for (const hm of headingMatches) {
        const type = hm[1].toLowerCase();
        const name = hm[2].replace(/^#+\s*/, '').replace(/\[.*?\]/g, '').trim();
        if (!name || name.length < 2) continue;

        const matchStart = hm.index;
        const nextHeading = headingMatches.find(m => m.index > matchStart);
        const matchEnd = nextHeading ? nextHeading.index : mdText.length;
        const block = mdText.substring(matchStart, matchEnd);

        let content = extractBlockContent(block);
        if (content.length < 10) continue;

        const existing = materials.find(m => m.projectId === projectId && !m.archived && m.type === type && m.name === name);

        if (existing) {
            store.setItem('materials', existing.id, {
                ...existing,
                currentContent: content,
                sourceChapter: chapter.chapterNumber,
                changeLog: [...(existing.changeLog || []), {
                    from: existing.currentContent || '',
                    to: content,
                    reason: 'Markdown extraction update',
                    chapterNumber: chapter.chapterNumber,
                    timestamp: new Date().toISOString()
                }],
                version: (existing.version || 1) + 1,
                updatedAt: new Date().toISOString()
            });
            console.log(`[PIPELINE] Markdown extraction: updated ${type} "${name}"`);
            appliedUpdates.push({ action: 'update', type, name, reason: 'Markdown extraction update' });
        } else {
            const genreVal = validateNewMaterial({ type, name, currentContent: content, initialContent: content }, styleProfile, materials);
            if (genreVal.errors.length > 0) {
                console.warn(`[PIPELINE] Markdown素材校验拦截: "${name}" - ${genreVal.errors.join('; ')}`);
                continue;
            }

            const newMatId = uuidv4();
            store.setItem('materials', newMatId, {
                id: newMatId, projectId, type, name,
                initialContent: content, currentContent: content,
                parentPlane: null, parentFaction: null, version: 1, status: 'active',
                sourceChapter: chapter.chapterNumber, tags: [],
                changeLog: [{ action: 'import', from: 'markdown-extraction', at: new Date().toISOString() }],
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            });
            console.log(`[PIPELINE] Markdown extraction: created ${type} "${name}"`);
            appliedUpdates.push({ action: 'create', type, name, reason: 'Markdown extraction create' });
        }
    }

    return appliedUpdates;
}

function extractBlockContent(block) {
    let content = '';

    const codeBlockMatch = block.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        try {
            let jsonStr = codeBlockMatch[1].trim();
            let parsed = null;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (_) {
                try {
                    parsed = JSON.parse(jsonStr
                        .replace(/[\u201c\u201d]/g, '"')
                        .replace(/[\u2018\u2019]/g, "'")
                        .replace(/,\s*([}\]])/g, '$1'));
                } catch (__) {
                    console.warn('[SILENT-CATCH]', __.message || __);
                }
            }
            content = parsed ? (parsed['内容'] || parsed.content || parsed['描述'] || parsed.description || JSON.stringify(parsed, null, 2)) : jsonStr;
        } catch (_) {
            content = codeBlockMatch[1].trim();
        }
    }

    if (!content || content.length < 10) {
        const descMatch = block.match(/(?:内容|描述|详情|备注)[:：]\s*([\s\S]*?)(?=\n#{1,5}|\n---|\n```|$)/);
        content = descMatch ? descMatch[1].trim() : block.trim();
    }

    return content;
}

module.exports = {
    extractFromMarkdown
};
