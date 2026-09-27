/**
 * 全局命令面板（Ctrl+K / Ctrl+P 唤起）
 *
 * 功能：
 * - 模糊搜索并跳转任意页面（长篇/漫剧/系统导航）
 * - 快捷动作：切换6种皮肤、折叠/展开侧边栏
 * - 全键盘操作：↑↓ 选择、Enter 执行、Esc 关闭
 *
 * 文件位置：client/src/components/CommandPalette.jsx
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { NOVEL_NAV, COMIC_NAV, SYSTEM_NAV } from './navConstants';
import { THEMES, THEME_LABEL } from '../shared/themes';
import { showSuccess } from './notifications';
import { IconEnter, IconSearch, IconBrush, IconCollapse } from './Icons';
import s from './CommandPalette.module.css';

export default function CommandPalette() {
    const navigate = useNavigate();
    const open = useAppStore(st => st.paletteOpen);
    const setOpen = useAppStore(st => st.setPaletteOpen);
    const theme = useAppStore(st => st.theme);
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const items = useMemo(() => {
        const nav = [
            ...NOVEL_NAV.map(n => ({ group: '导航 · 长篇', label: n.label, hint: n.path, icon: n.icon, run: () => navigate(n.path) })),
            ...COMIC_NAV.map(n => ({ group: '导航 · 漫剧', label: n.label, hint: n.path, icon: n.icon, run: () => navigate(n.path) })),
            ...SYSTEM_NAV.map(n => ({ group: '导航 · 系统', label: n.label, hint: n.path, icon: n.icon, run: () => navigate(n.path) }))
        ];
        const actions = [
            ...THEMES.map(t => ({
                group: '动作 · 皮肤', label: `切换皮肤：${t.label}`, hint: t.key, icon: IconBrush,
                run: () => { useAppStore.getState().setTheme(t.key); showSuccess(`已切换皮肤：${t.label}`); }
            })),
            {
                group: '动作 · 布局', label: '折叠 / 展开侧边栏', hint: 'Ctrl+B', icon: IconCollapse,
                run: () => useAppStore.getState().toggleSidebar()
            }
        ];
        const q = query.trim().toLowerCase();
        const all = [...nav, ...actions];
        if (!q) return all;
        return all.filter(it => it.label.toLowerCase().includes(q) || it.hint.toLowerCase().includes(q) || it.group.toLowerCase().includes(q));
    }, [query, navigate]);

    useEffect(() => {
        if (open) {
            setQuery('');
            setCursor(0);
            setTimeout(() => inputRef.current?.focus(), 30);
        }
    }, [open]);


    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                setOpen(!useAppStore.getState().paletteOpen);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [setOpen]);

    const close = () => setOpen(false);
    const execute = (item) => { item.run(); close(); };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); if (items[cursor]) execute(items[cursor]); }
        else if (e.key === 'Escape') { close(); }
    };

    useEffect(() => {
        // scrollIntoView 在 jsdom 中不存在，需可选调用
        listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView?.({ block: 'nearest' });
    }, [cursor]);

    if (!open) return null;

    let lastGroup = null;
    return (
        <div className={s.overlay} onMouseDown={close} role="dialog" aria-modal="true" aria-label="命令面板">
            <div className={s.panel} onMouseDown={e => e.stopPropagation()}>
                <div className={s.inputRow}>
                    <IconSearch size={16} />
                    <input
                        ref={inputRef}
                        className={s.input}
                        placeholder="搜索页面或动作…  (↑↓ 选择, Enter 执行, Esc 关闭)"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setCursor(0); }}
                        onKeyDown={onKeyDown}
                    />
                </div>
                <div className={s.list} ref={listRef}>
                    {items.length === 0 && <div className={s.empty}>没有匹配项</div>}
                    {items.map((it, idx) => {
                        const showGroup = it.group !== lastGroup;
                        lastGroup = it.group;
                        const IconComp = it.icon;
                        return (
                            <div key={it.group + it.label}>
                                {showGroup && <div className={s.group}>{it.group}</div>}
                                <div
                                    data-idx={idx}
                                    className={`${s.item} ${idx === cursor ? s.itemActive : ''}`}
                                    onMouseEnter={() => setCursor(idx)}
                                    onClick={() => execute(it)}
                                >
                                    <span className={s.itemIcon}><IconComp size={15} /></span>
                                    <span className={s.itemLabel}>{it.label}</span>
                                    <span className={s.itemHint}>{it.hint}</span>
                                    {idx === cursor && <span className={s.itemEnter}><IconEnter size={13} /></span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className={s.footer}>
                    <span>{items.length} 项</span>
                    <span>当前皮肤：{THEME_LABEL[theme]}</span>
                </div>
            </div>
        </div>
    );
}
