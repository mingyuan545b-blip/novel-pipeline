import { useState, useEffect, useCallback } from 'react';
import { pipelineApi } from '../../services/api';
import logger from '../../shared/logger';
import { TRACE_ENTITY_TYPES } from './crossWorldTraceConstants';
import TraceCard from './TraceCard';
import AddTraceForm from './AddTraceForm';
import './crossWorldTrace.css';

const FILTER_ENTITY_TYPES = [{ id: '', label: '全部类型' }, ...Object.values(TRACE_ENTITY_TYPES)];

export default function CrossWorldTraceTab({ projectId }) {
    const [traces, setTraces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filterType, setFilterType] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    const fetchTraces = useCallback(async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            setError(null);
            const filters = filterType ? { entityType: filterType } : {};
            const res = await pipelineApi.getCrossWorldTraces(projectId, filters);
            const data = res.data?.data || res.data || [];
            setTraces(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.response?.data?.error || err.message || '加载溯源数据失败');
        } finally {
            setLoading(false);
        }
    }, [projectId, filterType]);

    useEffect(() => { fetchTraces(); }, [fetchTraces]);

    const handleDelete = async (trace) => {
        if (!window.confirm(`确认删除"${trace.entityName}"的溯源记录？`)) return;
        try {
            await pipelineApi.deleteCrossWorldTrace(projectId, trace.id);
            fetchTraces();
        } catch (err) {
            logger.error('CrossWorldTrace', 'Delete failed:', err.message);
        }
    };

    const handleAdd = async (payload) => {
        try {
            await pipelineApi.createCrossWorldTrace(projectId, payload);
            setShowAddForm(false);
            fetchTraces();
        } catch (err) {
            alert(`创建失败: ${err.response?.data?.error || err.message}`);
        }
    };

    return (
        <div className="cwt-container">
            <div className="cwt-header">
                <div className="cwt-header-title">
                    跨世界物品溯源
                    <span className="cwt-header-sub">{traces.length}条溯源记录</span>
                </div>
                <div className="cwt-header-btns">
                    <select className="cwt-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        {FILTER_ENTITY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    <button className="cyber-btn cyber-btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                        {showAddForm ? '收起' : '+ 添加溯源'}
                    </button>
                </div>
            </div>

            <div className="cwt-guide">
                主角在小世界获取的装备/功法/法宝带往主世界时记录完整来源和跨世界轨迹。
                每条记录包含：来源世界+获取章节+获取方式+跨世界事件时间线，防止物品凭空出现。
            </div>

            {showAddForm && <AddTraceForm onSubmit={handleAdd} onCancel={() => setShowAddForm(false)} />}

            {loading ? (
                <div className="cwt-loading">加载中...</div>
            ) : error ? (
                <div className="cwt-error">
                    <span>{error}</span>
                    <button className="cyber-btn cyber-btn-sm cyber-btn-outline" onClick={fetchTraces}>重试</button>
                </div>
            ) : traces.length === 0 ? (
                <div className="cwt-empty">
                    暂无跨世界物品溯源记录。<br />
                    可手动添加，或在世界域Tab对章节进行"补提取"自动识别。
                </div>
            ) : (
                <div className="cwt-trace-list">
                    {traces.map(t => <TraceCard key={t.id} trace={t} onDelete={handleDelete} />)}
                </div>
            )}
        </div>
    );
}
