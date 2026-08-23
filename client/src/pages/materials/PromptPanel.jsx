import styles from './materials.module.css';

export default function PromptPanel({ data, onClose }) {
    if (!data) return null;

    return (
        <div className="cyber-modal-overlay" onClick={onClose}>
            <div className={`cyber-modal ${styles.modalLarge}`} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>🔍 执笔人注入Prompt总览</h2>
                    <button className="cyber-btn cyber-btn-sm" onClick={onClose}>关闭</button>
                </div>

                <div className={styles.promptDesc}>
                    以下内容是Pipeline运行时自动注入到Writer和Reviewer提示词中的方言/风格规则。角色对话将按这些规则创作。
                </div>

                {data.characters.length > 0 && (
                    <div className={styles.promptSection}>
                        <h3 className={`${styles.promptSectionTitle} ${styles.textCyan}`}>
                            🎭 角色说话风味明细
                        </h3>
                        <div className={styles.promptCharList}>
                            {data.characters.map((char, idx) => (
                                <div key={idx} className={styles.promptCharCard}>
                                    <div className={styles.promptCharHeader}>
                                        <span className={styles.promptCharName}>{char.name}</span>
                                        {char.dialectRegion && (
                                            <span className={`${styles.promptTag} ${styles.promptTagDialect}`}>
                                                🗣 {char.dialectRegion}({char.dialectIntensity})
                                            </span>
                                        )}
                                        {char.speechStyle && (
                                            <span className={`${styles.promptTag} ${styles.promptTagStyle}`}>
                                                🎭 {char.speechStyle}({char.speechStyleIntensity})
                                            </span>
                                        )}
                                        {char.combinedNote && (
                                            <span className={styles.promptCombined}>⚡ {char.combinedNote}</span>
                                        )}
                                    </div>
                                    {char.dialectPrompt && (
                                        <div className={styles.promptSubBlock}>
                                            <div className={`${styles.promptSubLabel} ${styles.promptSubLabelDialect}`}>方言注入：</div>
                                            <div className={`${styles.promptSubContent} ${styles.promptSubContentDialect}`}>
                                                {char.dialectPrompt}
                                            </div>
                                        </div>
                                    )}
                                    {char.stylePrompt && (
                                        <div className={styles.promptSubBlock}>
                                            <div className={`${styles.promptSubLabel} ${styles.promptSubLabelStyle}`}>风格注入：</div>
                                            <div className={`${styles.promptSubContent} ${styles.promptSubContentStyle}`}>
                                                {char.stylePrompt}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {data.writerPrompt && (
                    <div className={styles.promptSection}>
                        <h3 className={`${styles.promptSectionTitle} ${styles.textOrange}`}>✍️ Writer完整注入块</h3>
                        <div className={`${styles.promptCodeBlock} ${styles.promptCodeBlockWriter}`}>
                            {data.writerPrompt}
                        </div>
                    </div>
                )}

                {data.reviewerPrompt && (
                    <div className={styles.promptSection}>
                        <h3 className={`${styles.promptSectionTitle} ${styles.textPurple}`}>🔎 Reviewer注入块</h3>
                        <div className={`${styles.promptCodeBlock} ${styles.promptCodeBlockReviewer}`}>
                            {data.reviewerPrompt}
                        </div>
                    </div>
                )}

                {data.characters.length === 0 && (
                    <div className={styles.promptEmpty}>
                        当前项目没有角色设置了方言或说话风格。<br />
                        编辑角色素材时在"🎭 说话风味"区域设置即可。
                    </div>
                )}
            </div>
        </div>
    );
}
