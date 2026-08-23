function buildInjectionMap({ project, chapters, allMaterials, vis, volumeOrderConfig, projectId }) {
    const existingCount = chapters.length;
    const currentVolume = Math.floor(existingCount / 30) + 1;
    const subplaneMats = allMaterials.filter(m => m.type === 'sub-plane');

    const subplanes = subplaneMats.map(m => {
        const volEntry = volumeOrderConfig?.volumeOrder?.find(v => v.subplaneId === m.id || v.subplaneName === m.name);
        const children = allMaterials.filter(c =>
            (c.type === 'character' || c.type === 'faction' || c.type === 'equipment') &&
            (c.parentPlane === m.id || c.parentPlane === m.name || c.parentPlane === m.name.replace(/^小世界[···]/, ''))
        );
        const isInjected = vis.materials.some(vm => vm.id === m.id);

        return {
            id: m.id, name: m.name, isLocked: m.isLocked,
            assignedVolume: volEntry ? volEntry.volume : null,
            isCurrentVolume: vis.currentVolSubplane?.id === m.id,
            willBeInjected: isInjected,
            children: children.map(c => ({
                id: c.id, name: c.name, type: c.type, parentPlane: c.parentPlane,
                parentPlaneMatch: c.parentPlane === m.id ? 'id匹配' : c.parentPlane === m.name ? 'name匹配' : c.parentPlane === m.name.replace(/^小世界[···]/, '') ? '短名匹配' : '不匹配',
                isLocked: c.isLocked, willBeInjected: vis.materials.some(vm => vm.id === c.id)
            }))
        };
    });

    // 兼容历史数据：parentPlane可能为'主位面'(旧)或'主世界'(新)
    const MAIN_WORLD_VALUES = ['主世界', '主位面', '', null, undefined];
    const mainWorldChars = allMaterials.filter(c =>
        (c.type === 'character' || c.type === 'faction') &&
        MAIN_WORLD_VALUES.includes(c.parentPlane)
    ).map(c => ({ id: c.id, name: c.name, type: c.type, parentPlane: c.parentPlane, isLocked: c.isLocked, willBeInjected: true }));

    const orphanChildren = allMaterials.filter(c =>
        (c.type === 'character' || c.type === 'faction') && c.parentPlane
    ).filter(c => {
        const hasMatch = subplaneMats.some(sp => c.parentPlane === sp.id || c.parentPlane === sp.name || c.parentPlane === sp.name.replace(/^小世界[···]/, '') || c.parentPlane === sp.name.replace(/^次位面[···]/, ''));
        const isMainWorld = MAIN_WORLD_VALUES.includes(c.parentPlane);
        return !hasMatch && !isMainWorld;
    }).map(c => ({
        id: c.id, name: c.name, type: c.type, parentPlane: c.parentPlane,
        isLocked: c.isLocked, willBeInjected: vis.materials.some(vm => vm.id === c.id),
        issue: 'parentPlane无法匹配到任何小世界'
    }));

    return {
        projectId, projectName: project.name, currentVolume,
        existingChapterCount: existingCount, chapterInVolume: existingCount % 30,
        currentVolumeSubplane: vis.currentVolSubplane ? { id: vis.currentVolSubplane.id, name: vis.currentVolSubplane.name } : null,
        volumeOrder: volumeOrderConfig?.volumeOrder || [],
        subplanes, mainWorldCharacters: mainWorldChars, orphanChildren,
        totalMaterialsCount: allMaterials.length, injectedMaterialsCount: vis.materials.length,
        debug: vis.debug || { error: 'vis.debug is undefined' }
    };
}

module.exports = { buildInjectionMap };
