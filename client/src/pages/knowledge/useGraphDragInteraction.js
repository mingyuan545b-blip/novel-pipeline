import { useState, useRef } from 'react';
import useForceLayout from './useForceLayout';

/**
 * 图谱拖拽交互 hook
 * 封装节点拖拽、力导向布局相关的状态和事件处理
 * 从 GraphPanel.jsx 提取，降低主组件 useState 数量
 *
 * @param {Object} params
 * @param {Object} params.graph - 原始图谱数据
 * @param {Array} params.filteredNodes - 经视图筛选后的节点
 * @param {Array} params.filteredEdges - 经视图筛选后的边
 * @param {number} params.filteredCount - 筛选节点数
 * @param {number} params.filteredEdgeCount - 筛选边数
 * @param {string} params.viewMode - 当前视图模式
 * @returns {Object} { svgRef, positions, dragging, handleMouseDown, handleMouseMove, handleMouseUp }
 */
export default function useGraphDragInteraction({ graph, filteredNodes, filteredEdges, filteredCount, filteredEdgeCount, viewMode }) {
    const svgRef = useRef(null);
    const [positions, setPositions] = useState({});
    const [dragging, setDragging] = useState(null);
    const animRef = useRef(null);
    const currentPos = useRef({});
    const draggingRef = useRef(null);

    useForceLayout({ graph, filteredNodes, filteredEdges, filteredCount, filteredEdgeCount, viewMode, currentPos, animRef, draggingRef, setPositions });

    const handleMouseDown = (nodeId) => {
        setDragging(nodeId);
        draggingRef.current = nodeId;
    };

    const handleMouseMove = (e) => {
        if (!draggingRef.current || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = 900 / rect.width;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleX;
        const pos = { ...currentPos.current };
        if (pos[draggingRef.current]) {
            pos[draggingRef.current] = { ...pos[draggingRef.current], x, y, vx: 0, vy: 0 };
            currentPos.current = pos;
            setPositions(pos);
        }
    };

    const handleMouseUp = () => {
        setDragging(null);
        draggingRef.current = null;
    };

    return { svgRef, positions, dragging, handleMouseDown, handleMouseMove, handleMouseUp };
}
