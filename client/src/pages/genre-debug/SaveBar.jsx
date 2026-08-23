import s from './layout.module.css';

export default function SaveBar({ saveStatus, saveMutation, onReset, onSave }) {
    return (
        <div className={s.saveBar}>
            <div>
                {saveStatus && (
                    <span className={`${s.saveStatus} ${saveStatus.type === 'success' ? s.saveStatusSuccess : s.saveStatusError}`}>
                        {saveStatus.type === 'success' ? '✅' : '❌'} {saveStatus.message || ''}
                    </span>
                )}
            </div>
            <div className={s.saveActions}>
                <button className={s.btnReset} onClick={onReset}>↩ 重置</button>
                <button
                    className={`${s.btnSave} ${saveMutation.isPending ? s.btnSaveDisabled : ''}`}
                    onClick={onSave}
                    disabled={saveMutation.isPending}
                >
                    {saveMutation.isPending ? '⏳ 保存中...' : '💾 保存到内存（立即生效）'}
                </button>
            </div>
        </div>
    );
}
