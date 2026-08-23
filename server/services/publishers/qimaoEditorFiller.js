const { addLog, takeScreenshot } = require('./PublisherBase');

async function fillTitle(page, platform, chapterTitle) {
    const titleInput = page.locator('input[placeholder="请输入章节名称，最多20个字"]').first();
    if (await titleInput.count()) {
        await titleInput.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(200);
        await page.keyboard.type(chapterTitle, { delay: 50 });
        await page.waitForTimeout(500);
        const val = await titleInput.inputValue().catch(() => '');
        addLog(platform, `章节名填入后: 期望=${chapterTitle} 实际=${val}`);
        if (val !== chapterTitle) {
            addLog(platform, '键盘输入不匹配，尝试JS设值...');
            await titleInput.evaluate((el, title) => {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(el, title);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, chapterTitle);
            await page.waitForTimeout(500);
            const val2 = await titleInput.inputValue().catch(() => '');
            addLog(platform, `JS设值后: 期望=${chapterTitle} 实际=${val2}`);
        }
    } else {
        throw new Error('七猫章节名输入框未找到');
    }
}

async function fillContent(page, platform, content) {
    const editor = page.locator('div.q-contenteditable.book[contenteditable="true"]').first();
    let activeEditor;

    if (await editor.count()) {
        activeEditor = editor;
    } else {
        addLog(platform, '未找到编辑器div.q-contenteditable.book，尝试通用选择器...');
        const fallbackEditor = page.locator('div[contenteditable="true"]').first();
        if (await fallbackEditor.count()) {
            activeEditor = fallbackEditor;
        } else {
            addLog(platform, '所有编辑器选择器均未找到！');
            await takeScreenshot(page, platform, 'qimao-no-editor');
            throw new Error('七猫编辑器未找到');
        }
    }

    await activeEditor.click();
    await page.waitForTimeout(500);
    await clearEditor(page, activeEditor);

    addLog(platform, `键盘输入正文: ${content.length}字`);
    await page.keyboard.type(content, { delay: 5 });
    await page.waitForTimeout(2000);

    const textLen = await activeEditor.evaluate(el => el.innerText?.length || 0);
    addLog(platform, `正文已填: ${textLen}字`);

    if (textLen < content.length * 0.8) {
        addLog(platform, `输入字数不足(期望${content.length}实际${textLen})，降低速度重试...`);
        await activeEditor.click();
        await clearEditor(page, activeEditor);
        await page.keyboard.type(content, { delay: 10 });
        await page.waitForTimeout(2000);
        const textLen2 = await activeEditor.evaluate(el => el.innerText?.length || 0);
        addLog(platform, `重试后正文: ${textLen2}字`);
    }

    return activeEditor;
}

async function clearEditor(page, editor) {
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    const remaining = await editor.evaluate(el => el.innerText?.trim()?.length || 0);
    if (remaining > 0) {
        await editor.evaluate(el => { el.innerHTML = '<p><br></p>'; });
        await page.waitForTimeout(500);
    }
}

async function detectEditor(page, platform) {
    const editorCheck = await page.evaluate(() => {
        const titleInput = document.querySelector('input[placeholder*="章节名称"], input[placeholder*="请输入章节"]');
        const contentEditor = document.querySelector('div.q-contenteditable.book[contenteditable="true"], div[contenteditable="true"]');
        const chapterLabel = document.body?.innerText?.match(/第\s*(\d+)\s*章/)?.[0] || '';
        const prevLabel = document.body?.innerText?.match(/上一章节[：:]\s*(.+)/)?.[1] || '';
        return {
            hasTitleInput: !!titleInput,
            titlePlaceholder: titleInput?.placeholder || '',
            titleValue: titleInput?.value || '',
            hasContentEditor: !!contentEditor,
            contentText: contentEditor?.innerText?.substring(0, 100) || '',
            chapterLabel, prevChapter: prevLabel
        };
    });
    addLog(platform, `编辑器检测: 标题框=${editorCheck.hasTitleInput}(${editorCheck.titlePlaceholder}) 编辑器=${editorCheck.hasContentEditor} 章节标签=${editorCheck.chapterLabel}`);
    return editorCheck;
}

module.exports = { fillTitle, fillContent, clearEditor, detectEditor };
