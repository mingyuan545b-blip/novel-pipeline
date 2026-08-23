import { useState } from 'react';

export function usePublishUpdateState() {
    const [updateChapterInput, setUpdateChapterInput] = useState('');
    const [updateRangeStart, setUpdateRangeStart] = useState('');
    const [updateRangeEnd, setUpdateRangeEnd] = useState('');
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);
    const [updatePlatform, setUpdatePlatform] = useState('');

    return {
        updateChapterInput, setUpdateChapterInput,
        updateRangeStart, setUpdateRangeStart,
        updateRangeEnd, setUpdateRangeEnd,
        showUpdateDialog, setShowUpdateDialog,
        updatePlatform, setUpdatePlatform,
    };
}
