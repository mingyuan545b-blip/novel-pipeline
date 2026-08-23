import s from './workshop.module.css';
import p from './preview.module.css';
import { ImportResult, TechniquesResult, ElementsResult, FusionResult } from './WorkshopResultCards';

export default function WorkshopPreview({ activeTab, result }) {
    if (!result) return null;

    return (
        <div className={s.resultSection}>
            <div className="cyber-section-title">分析结果</div>
            {result.error ? (
                <div className={`cyber-card ${p.errorCard}`}>
                    <div className={p.errorTitle}>错误</div>
                    <div className={p.errorDetail}>{result.error}</div>
                </div>
            ) : (
                <>
                    {activeTab === 'import' && <ImportResult result={result} />}
                    {activeTab === 'fusion' && (
                        <>
                            <TechniquesResult techniques={result.techniques} />
                            <ElementsResult elements={result.elements} />
                            <FusionResult fusion={result.fusion} />
                            {result.outputDir && (
                                <div className={s.filePath}>分析结果已保存至: {result.outputDir}</div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
