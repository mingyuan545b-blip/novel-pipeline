/**
 * ExtractDialog — 藏经阁「一键提取」弹窗
 *
 * 交互：上传txt 或 粘贴正文 → 选作品名 → 勾选提取维度 → 提交 → 显示维度级进度 → 展示新增技法。
 * 说明：提取为异步长任务（多次LLM调用），状态由 useExtractState 轮询。
 * 文件位置：client/src/pages/library/ExtractDialog.jsx
 */
import s from './library.module.css';

const MIN_CHARS = 2000;

export default function ExtractDialog({ state }) {
    const { open, form, setForm, dimensions, task, error, running, readFile, submit, close } = state;
    if (!open) return null;

    const toggleDim = (id) => {
        const list = form.dimensions.includes(id)
            ? form.dimensions.filter(x => x !== id)
            : [...form.dimensions, id];
        setForm({ ...form, dimensions: list });
    };
    const chars = form.text.length;
    const canSubmit = chars >= MIN_CHARS && !running;

    return (
        <div className={s.dlgMask} onClick={close}>
            <div className={s.dlgBox} onClick={e => e.stopPropagation()}>
                <div className={s.fbTitle}>⬆ 一键提取写作技法</div>
                <p className={s.dlgHint}>
                    粘贴整本小说或上传txt，系统会按下面勾选的维度（不选=全部）逐维分析，
                    产出**跨作品通用的技法**并直接入库。已有同名技法会自动跳过。
                </p>

                <div className={s.dlgRow}>
                    <input
                        className={s.dlgInput}
                        placeholder="作品名（用于标记技法来源）"
                        value={form.novelName}
                        onChange={e => setForm({ ...form, novelName: e.target.value })}
                    />
                    <label className={s.dlgFileBtn}>
                        选择txt文件
                        <input type="file" accept=".txt,text/plain" hidden
                            onChange={e => readFile(e.target.files?.[0])} />
                    </label>
                </div>

                <textarea
                    className={s.dlgTextarea}
                    placeholder={`把小说正文粘贴到这里（至少 ${MIN_CHARS} 字）…\n已输入 ${chars} 字`}
                    value={form.text}
                    onChange={e => setForm({ ...form, text: e.target.value })}
                />

                <div className={s.dlgDimWrap}>
                    {dimensions.map(d => (
                        <button
                            key={d.id}
                            className={form.dimensions.includes(d.id) ? s.dlgDimOn : s.dlgDimOff}
                            title={d.hint}
                            onClick={() => toggleDim(d.id)}
                        >{d.label}</button>
                    ))}
                </div>

                {task && (
                    <div className={s.dlgProgress}>
                        <div className={s.dlgProgressTrack}>
                            <div className={s.dlgProgressFill} style={{ width: `${task.progress || 0}%` }} />
                        </div>
                        <span className={s.dlgProgressText}>
                            {task.status === 'completed' ? '完成' : (task.step || task.status)} · {task.progress || 0}%
                        </span>
                    </div>
                )}

                {task?.result && (
                    <div className={s.dlgResult}>
                        新增 <b>{task.result.inserted}</b> 条技法（跳过重复 {task.result.skippedDuplicates} 条，
                        库总量 {task.result.libraryTotal}）：
                        <ul className={s.dlgList}>
                            {task.result.techniques.slice(0, 12).map(t => (
                                <li key={t.id}>[{t.department.replace(/^\d+_/, '')}] {t.name}</li>
                            ))}
                        </ul>
                        {task.result.failedDimensions?.length > 0 && (
                            <div className={s.dlgWarn}>失败维度：{task.result.failedDimensions.map(f => f.dimension).join('、')}</div>
                        )}
                    </div>
                )}

                {error && <div className={s.dlgWarn}>{error}</div>}

                <div className={s.dlgActions}>
                    <span className={s.fbMeta}>{chars} 字 · 约 {Math.max(1, Math.ceil(chars / 12000))} 个文本块</span>
                    <button className={s.cancelBtn} onClick={close}>{running ? '后台继续' : '关闭'}</button>
                    <button className={s.saveBtn} disabled={!canSubmit} onClick={submit}>
                        {running ? '提取中…' : '开始提取'}
                    </button>
                </div>
            </div>
        </div>
    );
}
