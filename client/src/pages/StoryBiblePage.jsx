/**
 * StoryBiblePage — 全书设定（/story-bible）
 *
 * 用户诉求（2026-10-01）："控制整本书的设定走向 —— 什么类型什么走向、角色用的方言性格背景，
 * 可以手动编辑，编辑保存后会同步到后台素材数据库，整本书后续规划的 agent 能同步到一起"。
 *
 * 同步链路（已核实并补强）：
 *   保存 → store 写入 → 路由 resetDataContext + memory.invalidateCache
 *   → 后续章节的 agentRunner / intent-planner 经 DataContext 读到新值
 *   ⚠ 已生成章节不回溯（想改历史章节需重跑该章）
 */
import useStoryBibleState from './storybible/useStoryBibleState';
import useCharacterSettings from './storybible/useCharacterSettings';
import ProjectSettingForm from './storybible/ProjectSettingForm';
import CharacterSettingPanel from './storybible/CharacterSettingPanel';
import s from './storybible/storyBible.module.css';

export default function StoryBiblePage() {
    const st = useStoryBibleState();
    const cs = useCharacterSettings(st.projectId);

    if (!st.projectId) {
        return <div className={s.page}><div className={s.empty}>请先在顶栏选择一个项目</div></div>;
    }

    return (
        <div className={s.page}>
            <header className={s.head}>
                <div>
                    <h2 className={s.title}>📖 全书设定</h2>
                    <p className={s.sub}>
                        {st.currentProject?.name || ''} · 改动保存后对<strong>后续章节</strong>立即生效（已生成章节不回溯）
                    </p>
                </div>
            </header>

            <div className={s.noticeBar}>
                这里改的是"整本书的规矩"：类型与走向决定后续章节怎么规划，角色的方言/性格/背景决定他怎么说话、怎么做事。
                保存即写入素材库，后续 agent 会按新设定执行。
            </div>

            <ProjectSettingForm st={st} />
            <CharacterSettingPanel cs={cs} />
        </div>
    );
}
