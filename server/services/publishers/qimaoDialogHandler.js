const { addLog, takeScreenshot } = require('./PublisherBase');

const AI_DECLARATION_TEXTS = ['含AI生成内容', 'AI生成内容', '含AI辅助创作', 'AI辅助'];

async function detectDialog(page) {
    const dialogInfo = await page.evaluate(() => {
        const wrappers = document.querySelectorAll('.el-dialog__wrapper');
        for (const w of wrappers) {
            const style = window.getComputedStyle(w);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            const dialog = w.querySelector('.el-dialog');
            if (!dialog) continue;
            const text = (dialog.innerText || '').trim();
            const buttons = Array.from(dialog.querySelectorAll('a, button')).map(el => ({
                tag: el.tagName, text: (el.innerText || '').trim(),
                cls: (el.className || '').toString().substring(0, 60)
            }));
            return { text: text.substring(0, 500), buttons, visible: true };
        }
        return { text: '', buttons: [], visible: false };
    });
    return dialogInfo;
}

async function handleAckDialog(page, platform, dialogInfo, keywords) {
    let clicked = false;
    for (const btn of dialogInfo.buttons) {
        if (keywords.some(kw => btn.text.includes(kw))) {
            addLog(platform, `找到确认按钮: <${btn.tag}> "${btn.text}"`);
            const loc = page.locator(`.el-dialog ${btn.tag.toLowerCase()}`).filter({ hasText: btn.text }).first();
            if (await loc.count()) {
                await loc.click({ timeout: 5000 }).catch(async () => loc.click({ force: true }).catch(() => {}));
                clicked = true;
            }
            break;
        }
    }
    if (!clicked) {
        const jsKeywords = keywords.join('|');
        await page.evaluate((kw) => {
            const wrappers = document.querySelectorAll('.el-dialog__wrapper');
            for (const w of wrappers) {
                if (window.getComputedStyle(w).display === 'none') continue;
                const dialog = w.querySelector('.el-dialog');
                if (!dialog) continue;
                const all = dialog.querySelectorAll('a, button, span, div');
                for (const el of all) {
                    const t = (el.innerText || '').trim();
                    if (new RegExp(kw).test(t) && t.length < 20) {
                        el.click();
                        if (el.parentElement) el.parentElement.click();
                        return;
                    }
                }
            }
        }, jsKeywords);
    }
    await page.waitForTimeout(2000);
}

async function selectAIDeclaration(page, platform) {
    const currentSelectValue = await page.evaluate(() => {
        const wrappers = document.querySelectorAll('.el-dialog__wrapper');
        for (const w of wrappers) {
            if (window.getComputedStyle(w).display === 'none') continue;
            const dialog = w.querySelector('.el-dialog');
            if (!dialog) continue;
            const input = dialog.querySelector('.el-select .el-input__inner');
            if (input) return input.value || '';
        }
        return '';
    });
    addLog(platform, `当前内容声明值: "${currentSelectValue}"`);

    const needSelectAI = !AI_DECLARATION_TEXTS.some(t => currentSelectValue.includes(t));
    if (!needSelectAI) {
        addLog(platform, `内容声明已正确设置为"${currentSelectValue}"`);
        return;
    }

    addLog(platform, '需要选择AI声明，点击下拉框...');
    const selectInput = page.locator('.el-dialog__wrapper:not([style*="display: none"]) .el-select .el-input__inner').first();
    if (await selectInput.count()) {
        await selectInput.click({ timeout: 3000 }).catch(async () => selectInput.click({ force: true }).catch(() => {}));
        await page.waitForTimeout(1500);

        const aiOption = page.locator('.el-select-dropdown__item').filter({ hasText: '含AI生成内容' }).first();
        if (await aiOption.count()) {
            const box = await aiOption.boundingBox().catch(() => null);
            if (box) {
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            } else {
                await aiOption.click({ timeout: 3000 }).catch(async () => aiOption.click({ force: true }).catch(() => {}));
            }
            addLog(platform, '已选择"含AI生成内容"');
            await page.waitForTimeout(1000);
        } else {
            await page.evaluate((targetTexts) => {
                const dropdowns = document.querySelectorAll('.el-select-dropdown');
                for (const dd of dropdowns) {
                    if (window.getComputedStyle(dd).display === 'none') continue;
                    const items = dd.querySelectorAll('.el-select-dropdown__item');
                    for (const item of items) {
                        const text = (item.textContent || '').trim();
                        if (targetTexts.some(t => text.includes(t))) {
                            item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                            item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                            return;
                        }
                    }
                }
            }, AI_DECLARATION_TEXTS);
            await page.waitForTimeout(1000);
        }
    }
}

async function clickConfirmPublish(page, platform) {
    const confirmBtn = page.locator('.el-dialog a.qm-btn.important:has-text("确认发布"), .el-dialog a:has-text("确认发布"), .el-dialog button:has-text("确认发布")').first();
    if (await confirmBtn.count()) {
        await confirmBtn.click({ timeout: 5000 }).catch(async () => confirmBtn.click({ force: true }).catch(() => {}));
        addLog(platform, '已点击"确认发布"');
    } else {
        addLog(platform, 'Playwright未找到确认按钮，用JS...');
        await page.evaluate(() => {
            const wrappers = document.querySelectorAll('.el-dialog__wrapper');
            for (const w of wrappers) {
                if (window.getComputedStyle(w).display === 'none') continue;
                const dialog = w.querySelector('.el-dialog');
                if (!dialog) continue;
                const all = dialog.querySelectorAll('a, button');
                for (const el of all) {
                    const text = (el.innerText || '').trim();
                    if (text.includes('确认发布') || text.includes('发布')) { el.click(); return; }
                }
            }
        });
    }
    await page.waitForTimeout(3000);
}

module.exports = { detectDialog, handleAckDialog, selectAIDeclaration, clickConfirmPublish, AI_DECLARATION_TEXTS };
