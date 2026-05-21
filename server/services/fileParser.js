const store = require('../store');

function parseFileContent(content, fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    const isMd = ext === 'md' || ext === 'markdown';
    const lines = content.split(/\r?\n/);

    const sections = [];
    let currentSection = null;
    let currentLines = [];

    function flushSection() {
        if (currentSection) {
            currentSection.content = currentLines.join('\n').trim();
            if (currentSection.content) {
                sections.push(currentSection);
            }
        }
        currentLines = [];
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        let isHeader = false;
        let headerLevel = 0;
        let headerTitle = '';

        if (isMd) {
            const mdMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
            if (mdMatch) {
                isHeader = true;
                headerLevel = mdMatch[1].length;
                headerTitle = mdMatch[2].trim();
            }
        }

        if (!isHeader && !isMd) {
            if (/^第[零一二三四五六七八九十百千万\d]+[章节卷部篇回]/.test(trimmed)) {
                isHeader = true;
                headerLevel = 1;
                headerTitle = trimmed;
            } else if (/^[＝=]{3,}/.test(trimmed) && i + 1 < lines.length) {
                const nextLine = lines[i + 1]?.trim();
                if (nextLine) {
                    isHeader = true;
                    headerLevel = 1;
                    headerTitle = nextLine;
                    i++;
                }
            } else if (/^【[^】]+】$/.test(trimmed)) {
                isHeader = true;
                headerLevel = 1;
                headerTitle = trimmed.replace(/^【|】$/g, '');
            }
        }

        if (isHeader) {
            flushSection();
            currentSection = {
                title: headerTitle,
                level: headerLevel,
                type: detectMaterialType(headerTitle),
                rawContent: ''
            };
        } else {
            currentLines.push(line);
        }
    }

    flushSection();

    if (sections.length === 0 && content.trim()) {
        sections.push({
            title: fileName.replace(/\.(txt|md|markdown)$/i, ''),
            level: 1,
            type: 'worldview',
            rawContent: content.trim()
        });
    }

    const merged = mergeSubSections(sections, isMd);
    for (const section of merged) {
        section.content = section.content || section.rawContent || '';
        section.preview = section.content.substring(0, 100);
    }

    return merged;
}

function mergeSubSections(sections, isMd) {
    if (sections.length <= 1) return sections;

    const result = [];
    let i = 0;

    while (i < sections.length) {
        const section = { ...sections[i] };
        let content = section.content || '';

        if (section.level > 1 && result.length > 0) {
            const parent = result[result.length - 1];
            const prefix = isMd ? `${'#'.repeat(section.level)} ${section.title}` : section.title;
            parent.content = (parent.content || '') + '\n\n' + prefix + '\n' + (section.content || '');
            parent.rawContent = parent.content;
            i++;
            continue;
        }

        let j = i + 1;
        while (j < sections.length && sections[j].level > section.level) {
            const sub = sections[j];
            const prefix = isMd ? `${'#'.repeat(sub.level)} ${sub.title}` : sub.title;
            content += '\n\n' + prefix + '\n' + (sub.content || '');
            j++;
        }

        section.content = content.trim();
        section.rawContent = section.content;
        result.push(section);
        i = j;
    }

    return result;
}

function detectMaterialType(title) {
    const t = title;
    if (/角色|人物|角色卡|人物卡|角色设定|人物设定|人物简介/.test(t)) return 'character';
    if (/关系|关系图|人物关系|关系网/.test(t)) return 'relationship';
    if (/世界观|世界设定|背景|设定集|宇宙|大陆|历史|纪年|年表/.test(t)) return 'worldview';
    if (/地点|城市|国家|区域|星球|星域|地图|势力|阵营|组织|门派|宗门/.test(t)) return 'location';
    if (/装备|道具|法宝|武器|物品|神器|宝物/.test(t)) return 'equipment';
    if (/战力|等级|修炼|境界|体系|功法|实力|修为/.test(t)) return 'power-system';
    if (/剧情|事件|故事|主线|支线|大纲|情节|篇章/.test(t)) return 'plot';
    if (/魔法|术式|技能|异能|超能力|天赋/.test(t)) return 'power-system';
    if (/种族|民族|族群|物种/.test(t)) return 'worldview';
    if (/语言|文字|文化|风俗|宗教|信仰/.test(t)) return 'worldview';
    if (/经济|货币|贸易|商业/.test(t)) return 'worldview';
    if (/科技|技术|工程|机械/.test(t)) return 'equipment';
    return 'worldview';
}

function parseFile(buffer, fileName) {
    const content = buffer.toString('utf-8');
    const sections = parseFileContent(content, fileName);

    const categories = {};
    for (const section of sections) {
        const type = section.type;
        if (!categories[type]) categories[type] = [];
        categories[type].push({
            name: section.title,
            content: section.content,
            preview: section.preview || section.content?.substring(0, 80) || ''
        });
    }

    return {
        fileName,
        totalSections: sections.length,
        categories,
        sections
    };
}

function importParsedToProject(projectId, parsed, selectedCategories) {
    const typeMap = {
        character: 'character',
        relationship: 'relationship',
        worldview: 'worldview',
        location: 'location',
        equipment: 'equipment',
        'power-system': 'power-system',
        plot: 'plot',
        other: 'other'
    };

    const importCounts = {};
    const allTypes = selectedCategories && selectedCategories.length > 0
        ? selectedCategories
        : Object.keys(parsed.categories);

    for (const type of allTypes) {
        const items = parsed.categories[type];
        if (!items || items.length === 0) continue;

        for (const item of items) {
            const id = 'mat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
            const material = {
                id,
                projectId,
                type: typeMap[type] || type,
                name: item.name,
                initialContent: item.content || '',
                currentContent: item.content || '',
                version: 1,
                status: 'active',
                sourceFile: parsed.fileName,
                changeLog: [{
                    action: 'import',
                    from: parsed.fileName,
                    chapterNumber: 0,
                    timestamp: new Date().toISOString(),
                    reason: `从文件 ${parsed.fileName} 导入`
                }],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            store.setItem('materials', material.id, material);
            importCounts[type] = (importCounts[type] || 0) + 1;
        }
    }

    return importCounts;
}

function importParsedToFranchise(franchiseId, parsed, selectedCategories) {
    const typeMap = {
        character: 'character',
        relationship: 'relationship',
        worldview: 'worldview',
        location: 'location',
        equipment: 'equipment',
        'power-system': 'power-system',
        plot: 'plot',
        other: 'other'
    };

    const importCounts = {};
    const allTypes = selectedCategories && selectedCategories.length > 0
        ? selectedCategories
        : Object.keys(parsed.categories);

    for (const type of allTypes) {
        const items = parsed.categories[type];
        if (!items || items.length === 0) continue;

        for (const item of items) {
            const id = 'fs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
            const summary = {
                id,
                franchiseId,
                type: typeMap[type] || type,
                name: item.name,
                content: item.content || '',
                sourceFile: parsed.fileName,
                importedAt: new Date().toISOString()
            };
            store.setItem('franchise-materials', summary.id, summary);
            importCounts[type] = (importCounts[type] || 0) + 1;
        }
    }

    return importCounts;
}

module.exports = { parseFile, importParsedToFranchise, importParsedToProject, parseFileContent };
