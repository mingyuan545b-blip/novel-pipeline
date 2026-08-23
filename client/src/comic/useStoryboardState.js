import { useState, useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { useStoryboardBoardState } from './useStoryboardBoardState';
import { useStoryboardComfyuiState } from './useStoryboardComfyuiState';

const STATUS_MAP = {
    draft: { label: '草稿', color: 'var(--text-muted)' },
    ready: { label: '待渲染', color: 'var(--neon-blue)' },
    rendering: { label: '渲染中', color: 'var(--neon-orange)' },
    done: { label: '已完成', color: 'var(--neon-green)' },
    failed: { label: '失败', color: 'var(--neon-red)' }
};

export default function useStoryboardState() {
    const { chapters } = useAppStore();
    const [converting] = useState(false);

    const boardState = useStoryboardBoardState();
    const comfyuiState = useStoryboardComfyuiState(
        boardState.currentProject, boardState.newBoard, boardState.loadStoryboards
    );

    useEffect(() => { boardState.loadStoryboards(); }, [boardState.currentProject]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        ...boardState,
        ...comfyuiState,
        chapters, converting, STATUS_MAP,
    };
}
