import { useState, useCallback } from 'react';
import { DEFAULT_LAYOUT, loadLayout, saveLayout } from './constants';

export default function useLayoutState() {
    const [cardLayout, setCardLayout] = useState(() => loadLayout());

    const onDragEnd = useCallback((result) => {
        const { source, destination } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;
        setCardLayout(prev => {
            const next = { left: [...prev.left], right: [...prev.right] };
            const [removed] = next[source.droppableId].splice(source.index, 1);
            next[destination.droppableId].splice(destination.index, 0, removed);
            saveLayout(next);
            return next;
        });
    }, []);

    const resetLayout = useCallback(() => {
        setCardLayout(DEFAULT_LAYOUT);
        saveLayout(DEFAULT_LAYOUT);
    }, []);

    return { cardLayout, onDragEnd, resetLayout };
}
