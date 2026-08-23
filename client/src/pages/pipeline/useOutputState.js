import { useState, useMemo } from 'react';
import {
    useReviewsByChapter,
    usePipelineOutputPaths,
} from '../../hooks/queries';

export function useOutputState(currentProject, selectedChapter) {
    const [activeOutputTab, setActiveOutputTab] = useState('writerOutput');
    const [viewVersion, setViewVersion] = useState(null);

    const { data: outputPathsData } = usePipelineOutputPaths(currentProject?.id);
    const outputPaths = useMemo(() => outputPathsData || {}, [outputPathsData]);

    const { data: reviewLogsData } = useReviewsByChapter(selectedChapter?.id || '');
    const reviewLogs = useMemo(() => reviewLogsData || [], [reviewLogsData]);

    return {
        activeOutputTab, setActiveOutputTab,
        outputPaths, setOutputPaths: () => {},
        viewVersion, setViewVersion,
        reviewLogs,
    };
}
