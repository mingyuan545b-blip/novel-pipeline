import { chapterAuditApi } from '../../services/api';
import AuditRepairPanel from './AuditRepairPanel';
import AuditBatchPanel from './AuditBatchPanel';
import AuditReviewPanel from './AuditReviewPanel';
import { WordViolationCard, ViolationList, ViolationTagBar } from './AuditViolationComponents';
import s from './ChapterAuditPanel.module.css';

export default function ChapterAuditPanel({
    currentProject, chapterAuditData, setChapterAuditData,
    chapterAuditLoading, setChapterAuditLoading,
    auditPage, setAuditPage, auditPageSize,
    auditFilter, setAuditFilter,
    expandedChapter, setExpandedChapter,
    repairModels, selectedRepairModel, setSelectedRepairModel,
    repairingChapterId, setRepairingChapterId,
    repairInstructions, setRepairInstructions,
    repairResult, setRepairResult,
    selectedForBatch, setSelectedForBatch,
    batchRepairing, setBatchRepairing,
    buttonPollRefs,
    repairingChapter, setRepairingChapter,
    retryProgress, setRetryProgress,
    retryTaskId, setRetryTaskId,
    batchTaskId, setBatchTaskId,
    batchProgress, setBatchProgress,
    reviewLoading, setReviewLoading,
    reviewResult, setReviewResult,
    retryCount, setRetryCount,
    expandedAttempt, setExpandedAttempt,
}) {
    const handleFullScan = async () => {
        if (!currentProject?.id) return;
        setChapterAuditLoading(true);
        try {
            const res = await chapterAuditApi.audit(currentProject.id);
            setChapterAuditData(res.data);
        } catch (e) { alert('扫描失败: ' + e.message); }
        finally { setChapterAuditLoading(false); }
    };

    const renderResults = () => {
        if (!chapterAuditData) return <div className={s.emptyHint}>点击&quot;全量扫描&quot;检测所有章节违规</div>;
        const violated = chapterAuditData.results.filter(r => !r.clean);
        const filtered = auditFilter === 'all' ? violated : auditFilter === 'critical' ? violated.filter(r => r.criticalCount > 0) : violated.filter(r => r.violations.some(v => v.type === auditFilter));
        const totalPages = Math.ceil(filtered.length / auditPageSize);
        const paged = filtered.slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize);
        const typeOptions = [...new Set(violated.flatMap(r => r.violations.map(v => v.type)))];
        return (
            <div>
                <div className={s.summary}>扫描{chapterAuditData.summary.total}章 | ✅{chapterAuditData.summary.clean} | ⚠️违规{chapterAuditData.summary.withViolations} | 🔴严重{chapterAuditData.summary.critical}</div>
                <div className={s.filterBar}>
                    <button onClick={() => { setAuditFilter('all'); setAuditPage(1); }} className={`${s.filterBtn} ${auditFilter === 'all' ? s.filterBtnActive : s.filterBtnInactive}`}>全部({violated.length})</button>
                    <button onClick={() => { setAuditFilter('critical'); setAuditPage(1); }} className={`${s.filterBtn} ${auditFilter === 'critical' ? s.filterBtnCritical : s.filterBtnInactive}`}>🔴严重({violated.filter(r => r.criticalCount > 0).length})</button>
                    {typeOptions.map(t => <button key={t} onClick={() => { setAuditFilter(t); setAuditPage(1); }} className={`${s.filterBtn} ${auditFilter === t ? s.filterBtnType : s.filterBtnInactive}`}>{t}({violated.filter(r => r.violations.some(v => v.type === t)).length})</button>)}
                </div>
                <div className={s.scrollArea}>{paged.map(r => renderChapterCard(r))}</div>
                {totalPages > 1 && renderPagination(totalPages, filtered.length)}
            </div>
        );
    };

    const renderChapterCard = (r) => {
        const wv = r.violations.find(v => v.type === 'wordCountTooLow' || v.type === 'wordCountTooHigh');
        const ov = r.violations.filter(v => v.type !== 'wordCountTooLow' && v.type !== 'wordCountTooHigh');
        const isSel = selectedForBatch.has(r.chapterId);
        const cardCls = `${s.chapterCard} ${r.criticalCount > 0 ? s.chapterCardCritical : s.chapterCardWarning} ${isSel ? s.chapterCardSelected : r.criticalCount > 0 ? s.chapterCardCriticalBorder : s.chapterCardWarningBorder}`;
        return (
            <div key={r.chapterId} className={cardCls}>
                <div className={s.chapterHeader}>
                    <div className={s.chapterLeft}>
                        <input type="checkbox" checked={isSel} onChange={() => { const ns = new Set(selectedForBatch); if (ns.has(r.chapterId)) ns.delete(r.chapterId); else ns.add(r.chapterId); setSelectedForBatch(ns); }} disabled={repairingChapter || batchRepairing} className={s.checkbox} />
                        <span className={`${s.chapterTitle} ${r.criticalCount > 0 ? s.chapterTitleCritical : s.chapterTitleWarning}`} onClick={() => setExpandedChapter(expandedChapter === r.chapterId ? null : r.chapterId)}>Ch{r.chapterNumber} {r.criticalCount > 0 ? '🔴' : '🟡'} {r.violations.length}项违规</span>
                    </div>
                    <div className={s.chapterRight}>
                        <span className={`${s.wordCount} ${wv ? s.wordCountBad : s.wordCountOk}`}>{r.wordCount}字{wv ? (wv.type === 'wordCountTooLow' ? ` ⚠差${wv.gap || ''}字` : ' ⚠超标') : ''}</span>
                        <button className={`cyber-btn cyber-btn-sm ${s.repairBtn}`} onClick={() => setRepairingChapterId(repairingChapterId === r.chapterId ? null : r.chapterId)} disabled={repairingChapter || batchRepairing}>{repairingChapter === r.chapterNumber ? '⏳返修中' : '🔧返修'}</button>
                    </div>
                </div>
                {expandedChapter === r.chapterId && <div className={s.expanded}><WordViolationCard r={r} wordCountViolation={wv} /><ViolationList violations={ov} /></div>}
                {expandedChapter !== r.chapterId && <ViolationTagBar violations={r.violations} />}
                <AuditRepairPanel chapter={r} repairingChapter={repairingChapter} setRepairingChapter={setRepairingChapter} repairingChapterId={repairingChapterId} setRepairingChapterId={setRepairingChapterId} repairInstructions={repairInstructions} setRepairInstructions={setRepairInstructions} repairModels={repairModels} selectedRepairModel={selectedRepairModel} setSelectedRepairModel={setSelectedRepairModel} retryTaskId={retryTaskId} batchRepairing={batchRepairing} currentProject={currentProject} buttonPollRefs={buttonPollRefs} setRetryCount={setRetryCount} setRetryProgress={setRetryProgress} setRetryTaskId={setRetryTaskId} setRepairResult={setRepairResult} setReviewResult={setReviewResult} setChapterAuditData={setChapterAuditData} />
            </div>
        );
    };

    const renderPagination = (totalPages, total) => (
        <div className={s.pagination}>
            <button disabled={auditPage <= 1} onClick={() => setAuditPage(auditPage - 1)} className={`${s.pageBtn} ${auditPage <= 1 ? s.pageBtnDisabled : ''}`}>◀</button>
            <span className={s.pageInfo}>{auditPage}/{totalPages} (共{total}条)</span>
            <button disabled={auditPage >= totalPages} onClick={() => setAuditPage(auditPage + 1)} className={`${s.pageBtn} ${auditPage >= totalPages ? s.pageBtnDisabled : ''}`}>▶</button>
        </div>
    );

    return (
        <div className={s.panel}>
            <div className={s.header}>
                <span className={s.title}>📋 章节审计</span>
                <div className={s.btnGroup}>
                    <AuditBatchPanel selectedForBatch={selectedForBatch} batchRepairing={batchRepairing} setBatchRepairing={setBatchRepairing} batchTaskId={batchTaskId} setBatchTaskId={setBatchTaskId} batchProgress={batchProgress} setBatchProgress={setBatchProgress} setSelectedForBatch={setSelectedForBatch} currentProject={currentProject} selectedRepairModel={selectedRepairModel} buttonPollRefs={buttonPollRefs} setChapterAuditData={setChapterAuditData} repairingChapter={repairingChapter} retryTaskId={retryTaskId} />
                    <button className={`cyber-btn cyber-btn-sm ${s.scanBtn}`} disabled={chapterAuditLoading} onClick={handleFullScan}>{chapterAuditLoading ? '⏳扫描中...' : '🔍全量扫描'}</button>
                </div>
            </div>
            <AuditReviewPanel repairResult={repairResult} setRepairResult={setRepairResult} retryProgress={retryProgress} setRetryProgress={setRetryProgress} retryCount={retryCount} setRetryCount={setRetryCount} expandedAttempt={expandedAttempt} setExpandedAttempt={setExpandedAttempt} reviewLoading={reviewLoading} setReviewLoading={setReviewLoading} reviewResult={reviewResult} setReviewResult={setReviewResult} repairingChapter={repairingChapter} setRepairingChapter={setRepairingChapter} retryTaskId={retryTaskId} setRetryTaskId={setRetryTaskId} selectedRepairModel={selectedRepairModel} currentProject={currentProject} buttonPollRefs={buttonPollRefs} setChapterAuditData={setChapterAuditData} repairInstructions={repairInstructions} />
            {renderResults()}
        </div>
    );
}
