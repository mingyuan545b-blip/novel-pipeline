const store = require('../server/store');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUBPLANES_DIR = path.join(__dirname, '..', 'data', 'subplanes');

function loadAllSubplanes(projectId, options = {}) {
    const { dryRun = false, verbose = true } = options;

    if (!fs.existsSync(SUBPLANES_DIR)) {
        console.error('❌ 数据目录不存在:', SUBPLANES_DIR);
        return { loaded: 0, errors: [] };
    }

    if (!dryRun) {
        const existing = store.queryItems('materials', { projectId });
        const subPlaneRelated = existing.filter(m => m.type === 'sub-plane' || m.parentPlane || (m.type === 'faction' && m.tags && m.tags.includes('主世界')));
        subPlaneRelated.forEach(m => store.deleteItem('materials', m.id));
        const oldMainWorldChars = existing.filter(m => m.type === 'character' && m.parentFaction && m.parentFaction.startsWith('fac-mainworld'));
        oldMainWorldChars.forEach(m => store.deleteItem('materials', m.id));
        const totalDeleted = subPlaneRelated.length + oldMainWorldChars.length;
        if (verbose && totalDeleted > 0) console.log(`🗑️ 清理旧数据: ${totalDeleted} 条`);
    }

    const files = fs.readdirSync(SUBPLANES_DIR).filter(f => f.endsWith('.json'));
    if (verbose) console.log(`📂 发现 ${files.length} 个次位面数据文件`);

    const results = { loaded: 0, errors: [], materials: [] };

    for (const file of files) {
        try {
            const filePath = path.join(SUBPLANES_DIR, file);
            const raw = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(raw);
            const materials = flattenToMaterials(data, projectId);
            results.materials.push({ file, planeName: data.name, materials });

            if (!dryRun) {
                for (const mat of materials) {
                    store.setItem('materials', mat.id, mat);
                }
            }

            results.loaded++;
            if (verbose) {
                const counts = countByType(materials);
                console.log(`✅ ${data.name} → ${Object.entries(counts).map(([t, c]) => `${t}:${c}`).join(' ')}`);
            }
        } catch (err) {
            const msg = `${file}: ${err.message}`;
            results.errors.push(msg);
            console.error(`❌ ${msg}`);
        }
    }

    return results;
}

function flattenToMaterials(planeData, projectId) {
    const materials = [];

    if (planeData.items && Array.isArray(planeData.items)) {
        for (const item of planeData.items) {
            const itemId = `${item.type}-${planeData.id}-${crypto.randomUUID().substring(0, 8)}`;
            const mat = {
                id: itemId,
                projectId,
                type: item.type,
                name: item.name,
                description: item.description || '',
                initialContent: item.content || '',
                currentContent: item.content || '',
                tags: ['核心设定', item.type],
                isLocked: false,
                parentPlane: null,
                version: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            materials.push(mat);
        }
        return materials;
    }

    const isMainWorld = planeData.category === '主世界';
    const planeId = isMainWorld ? `mw-${planeData.id}` : `sp-${planeData.id}`;
    const isLocked = !isMainWorld && planeData.unlockStatus !== 'unlocked';

    if (!isMainWorld) {
        const planeMat = {
            id: planeId,
            projectId,
            type: 'sub-plane',
            name: planeData.name,
            description: `${planeData.category} | ${(planeData.coreRules || '').substring(0, 80)}`,
            initialContent: buildPlaneContent(planeData),
            currentContent: buildPlaneContent(planeData),
            tags: [planeData.category, isLocked ? 'locked' : 'unlocked'],
            isLocked,
            unlockChapter: planeData.unlockChapter || 0,
            parentPlane: null,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        materials.push(planeMat);
    }

    for (const faction of (planeData.factions || [])) {
        const factionId = `fac-${planeData.id}-${faction.id}`;
        const factionMat = {
            id: factionId,
            projectId,
            type: 'faction',
            name: faction.name,
            description: faction.position,
            initialContent: buildFactionContent(faction, planeData),
            currentContent: buildFactionContent(faction, planeData),
            tags: isMainWorld ? [planeData.name, '主世界'] : [planeData.name, planeData.category, isLocked ? 'locked' : 'unlocked'],
            isLocked: isMainWorld ? false : isLocked,
            parentPlane: isMainWorld ? null : planeId,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        materials.push(factionMat);

        for (const char of (faction.characters || [])) {
            const charId = `chr-${planeData.id}-${char.id}`;
            const charMat = {
                id: charId,
                projectId,
                type: 'character',
                name: char.title || char.name,
                description: char.identity,
                initialContent: buildCharacterContent(char, faction, planeData),
                currentContent: buildCharacterContent(char, faction, planeData),
                tags: isMainWorld
                    ? [planeData.name, faction.name, '主世界', char.isCanonVerified ? 'canon-verified' : 'original']
                    : [planeData.name, faction.name, planeData.category, isLocked ? 'locked' : 'unlocked', char.isCanonVerified ? 'canon-verified' : 'original'],
                isLocked: isMainWorld ? false : isLocked,
                parentPlane: isMainWorld ? null : planeId,
                parentFaction: factionId,
                refNames: buildRefNames(char),
                version: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            materials.push(charMat);
        }
    }

    for (const item of (planeData.obtainableItems || [])) {
        const itemId = `itm-${planeData.id}-${item.name}`;
        const itemMat = {
            id: itemId,
            projectId,
            type: 'equipment',
            name: item.name,
            description: `${item.acquisitionMethod} | ${item.description}`,
            initialContent: buildItemContent(item, planeData),
            currentContent: buildItemContent(item, planeData),
            tags: [planeData.name, planeData.category, isLocked ? 'locked' : 'unlocked', 'sub-plane-item'],
            isLocked,
            parentPlane: planeId,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        materials.push(itemMat);
    }

    return materials;
}

function buildPlaneContent(data) {
    const lines = [];
    lines.push(`【类型】${data.category}`);
    lines.push(`【核心规则】${data.coreRules}`);
    if (data.plotLine) {
        lines.push(`【剧情线】`);
        if (data.plotLine.mainPlot) lines.push(`  主线：${data.plotLine.mainPlot}`);
        if (data.plotLine.systemTask) lines.push(`  系统任务：${data.plotLine.systemTask}`);
        if (data.plotLine.keyTurningPoint) lines.push(`  关键转折：${data.plotLine.keyTurningPoint}`);
        if (data.plotLine.mainWorldConnection) lines.push(`  衔接主世界：${data.plotLine.mainWorldConnection}`);
    }
    if (data.plunderAbility) {
        lines.push(`【掠夺能力】${data.plunderAbility.name}——${data.plunderAbility.description}。${data.plunderAbility.suppressionRule}`);
        lines.push(`【触发条件】${data.plunderAbility.triggerCondition}`);
    }
    lines.push(`【视觉特征】${data.visualFeatures}`);
    lines.push(`【IP校验】${data.ipValidation}`);
    lines.push(`【解封状态】${data.unlockStatus === 'unlocked' ? '已解锁' : '锁定'}`);
    return lines.join('\n');
}

function buildFactionContent(faction, planeData) {
    const lines = [];
    lines.push(`【所属位面】${planeData.name}（${planeData.category}）`);
    lines.push(`【势力名】${faction.name}`);
    lines.push(`【定位】${faction.position}`);
    lines.push(`【势力关系】${faction.relations}`);
    if (faction.characters && faction.characters.length > 0) {
        lines.push(`【成员】${faction.characters.map(c => c.title || c.name).join('、')}`);
    }
    return lines.join('\n');
}

function buildCharacterContent(char, faction, planeData) {
    const lines = [];
    lines.push(`【所属位面】${planeData.name}（${planeData.category}）`);
    lines.push(`【所属势力】${faction.name}`);
    lines.push(`【身份】${char.identity}`);
    lines.push(`【性格】${char.personality}`);
    lines.push(`【能力】${char.abilities}`);
    lines.push(`【与主角关系】${char.relationToProtagonist}`);
    lines.push(`【出场方式】${char.entranceStyle}`);
    if (char.isCanonVerified) lines.push(`【IP校验】[CANON-VERIFIED] 知名IP角色，行为需符合原著人设`);
    return lines.join('\n');
}

function buildItemContent(item, planeData) {
    const lines = [];
    lines.push(`【所属位面】${planeData.name}（${planeData.category}）`);
    lines.push(`【道具名】${item.name}`);
    lines.push(`【获取方式】${item.acquisitionMethod}（非掠夺，道具通过探索/交易/任务获得）`);
    lines.push(`【功能】${item.description}`);
    if (item.mainWorldTranslation) lines.push(`【主世界翻译】${item.mainWorldTranslation}`);
    if (item.suppressionRule) lines.push(`【修为压制】${item.suppressionRule}`);
    return lines.join('\n');
}

function buildRefNames(char) {
    return {
        narrator: char.title || char.name,
        byChild: char.name,
        byAdult: char.name,
        pronoun: '他'
    };
}

function countByType(materials) {
    return materials.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
    }, {});
}

function validateAll(projectId) {
    const materials = store.queryItems('materials', { projectId });
    const subPlanes = materials.filter(m => m.type === 'sub-plane');
    const factions = materials.filter(m => m.type === 'faction');
    const characters = materials.filter(m => m.type === 'character' && m.parentPlane);
    const items = materials.filter(m => m.type === 'equipment' && m.parentPlane);

    console.log(`\n📊 数据验证:`);
    console.log(`  次位面: ${subPlanes.length}`);
    console.log(`  势力: ${factions.length}`);
    console.log(`  位面人物: ${characters.length}`);
    console.log(`  位面道具: ${items.length}`);

    let errors = [];

    factions.forEach(f => {
        const isMainWorldFac = f.tags && f.tags.includes('主世界');
        if (!isMainWorldFac) {
            if (!f.parentPlane) errors.push(`势力 ${f.name} 缺少 parentPlane`);
            const parent = materials.find(m => m.id === f.parentPlane);
            if (!parent && f.parentPlane) errors.push(`势力 ${f.name} 的 parentPlane ${f.parentPlane} 不存在`);
        }
    });

    characters.forEach(c => {
        if (!c.parentFaction) errors.push(`人物 ${c.name} 缺少 parentFaction`);
        const faction = materials.find(m => m.id === c.parentFaction);
        if (!faction && c.parentFaction) errors.push(`人物 ${c.name} 的 parentFaction ${c.parentFaction} 不存在`);
    });

    items.forEach(i => {
        if (!i.parentPlane) errors.push(`道具 ${i.name} 缺少 parentPlane`);
    });

    const directIPNames = ['孙悟空', '贝吉塔', '克林', '路飞', '索隆', '娜美', '小杰', '奇犽', '西索', '哆啦A梦', '大雄', '出木杉', '灰太狼', '喜羊羊', '慢羊羊', '汤姆', '杰瑞', '斯派克', '迪迦'];
    materials.filter(m => m.parentPlane || m.type === 'sub-plane').forEach(m => {
        directIPNames.forEach(n => {
            if ((m.currentContent || '').includes(n)) {
                errors.push(`直接IP角色名: ${m.name} → ${n}`);
            }
        });
    });

    if (errors.length === 0) {
        console.log(`  ✅ 层级归属完整，无直接IP名`);
    } else {
        console.log(`  ❌ 发现 ${errors.length} 个问题:`);
        errors.forEach(e => console.log(`    - ${e}`));
    }

    return errors;
}

const pid = process.argv[2] || '7804d8fd-c4f1-4d55-afdd-5754ab8af167';
const command = process.argv[3] || 'load';

if (command === 'load') {
    console.log(`🔄 加载次位面数据 (projectId: ${pid})`);
    const result = loadAllSubplanes(pid);
    console.log(`\n✅ 加载完成: ${result.loaded} 个次位面, ${result.errors.length} 个错误`);
    if (result.errors.length === 0) validateAll(pid);
} else if (command === 'validate') {
    validateAll(pid);
} else if (command === 'dry-run') {
    console.log(`🔍 试运行 (不写入store)`);
    const result = loadAllSubplanes(pid, { dryRun: true });
    console.log(`\n将创建 ${result.materials.reduce((s, r) => s + r.materials.length, 0)} 条素材记录`);
    result.materials.forEach(r => {
        const counts = countByType(r.materials);
        console.log(`  ${r.planeName}: ${Object.entries(counts).map(([t, c]) => `${t}:${c}`).join(' ')}`);
    });
}
