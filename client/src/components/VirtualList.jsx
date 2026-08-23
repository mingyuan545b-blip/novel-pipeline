import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export default function VirtualList({
    items,
    renderItem,
    estimateSize = 50,
    overscan = 5,
    className = '',
    style = {},
    scrollRef,
}) {
    const localRef = useRef(null);
    const parentRef = scrollRef || localRef;

    // eslint-disable-next-line react-hooks/incompatible-library
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => estimateSize,
        overscan,
    });

    return (
        <div
            ref={parentRef}
            className={className}
            style={{
                overflow: 'auto',
                ...style,
            }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualItem) => (
                    <div
                        key={virtualItem.key}
                        data-index={virtualItem.index}
                        ref={virtualizer.measureElement}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualItem.start}px)`,
                        }}
                    >
                        {renderItem(items[virtualItem.index], virtualItem.index)}
                    </div>
                ))}
            </div>
        </div>
    );
}
