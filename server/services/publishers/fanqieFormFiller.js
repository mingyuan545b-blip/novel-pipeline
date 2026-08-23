const { addLog } = require('./PublisherBase');

async function fillSerialInput(page, platform, chapterNum) {
    addLog(platform, `填写章节序号(纯阿拉伯数字): ${chapterNum}`);

    const selectors = [
        '.serial-editor-title-left .left-input input.serial-input',
        '.serial-editor-title-left input.serial-input',
        '.left-input input.serial-input',
    ];

    for (const sel of selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count()) {
            const ph = await loc.getAttribute('placeholder').catch(() => '');
            if (ph && ph.includes('标题')) {
                addLog(platform, `跳过选择器 ${sel} (匹配到了标题框)`);
                continue;
            }

            addLog(platform, `找到序号框(${sel})，用键盘输入...`);
            await loc.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(200);
            await page.keyboard.type(chapterNum, { delay: 80 });
            await page.waitForTimeout(300);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);

            const val = await loc.inputValue().catch(() => '');
            addLog(platform, `序号框填入后值: 期望=${chapterNum} 实际=${val}`);
            if (val === chapterNum) {
                addLog(platform, `章节序号已填: ${chapterNum}`);
                return true;
            }

            addLog(platform, `fill()值不匹配，尝试JS直接设值+触发事件...`);
            await loc.evaluate((el, num) => {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(el, num);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, chapterNum);
            await page.waitForTimeout(500);
            const val2 = await loc.inputValue().catch(() => '');
            addLog(platform, `JS设值后: 期望=${chapterNum} 实际=${val2}`);
            if (val2 === chapterNum) {
                addLog(platform, `章节序号已填(JS): ${chapterNum}`);
                return true;
            }
        }
    }

    addLog(platform, '选择器全部未匹配，用JS按DOM结构精确定位+键盘输入...');
    const found = await page.evaluate(() => {
        const leftInput = document.querySelector('.serial-editor-title-left .left-input');
        if (leftInput) return !!leftInput.querySelector('input');
        const allInputs = Array.from(document.querySelectorAll('input.serial-input'));
        const serialInput = allInputs.find(el => !el.placeholder || el.placeholder === '');
        return !!serialInput;
    });

    if (found) {
        const jsSel = '.serial-editor-title-left .left-input input, input.serial-input:not([placeholder])';
        const loc = page.locator(jsSel).first();
        if (await loc.count()) {
            await loc.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(200);
            await page.keyboard.type(chapterNum, { delay: 80 });
            await page.waitForTimeout(300);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);

            const val = await loc.inputValue().catch(() => '');
            addLog(platform, `JS定位+键盘输入后: 期望=${chapterNum} 实际=${val}`);
            if (val === chapterNum) return true;
        }
    }

    addLog(platform, `章节序号未能填入！`);
    return false;
}

async function fillTitleInput(page, platform, chapterTitle) {
    addLog(platform, `填写标题(不含"第X章"): ${chapterTitle}`);

    const selectors = [
        '.serial-editor-title-right .serial-editor-input-hint input[placeholder="请输入标题"]',
        '.serial-editor-title-right input[placeholder="请输入标题"]',
        'input.serial-input.serial-editor-input-hint-area[placeholder="请输入标题"]',
        'input[placeholder="请输入标题"]',
    ];

    for (const sel of selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count()) {
            addLog(platform, `找到标题框(${sel})，用键盘输入...`);
            await loc.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(300);
            await page.keyboard.press('Control+a');
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(200);
            await page.keyboard.type(chapterTitle, { delay: 50 });
            await page.waitForTimeout(300);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);

            const val = await loc.inputValue().catch(() => '');
            addLog(platform, `标题框填入后值: 期望=${chapterTitle} 实际=${val}`);
            if (val === chapterTitle) {
                addLog(platform, `标题已填: ${chapterTitle}`);
                return true;
            }

            addLog(platform, `键盘输入值不匹配，尝试JS直接设值...`);
            await loc.evaluate((el, title) => {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(el, title);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, chapterTitle);
            await page.waitForTimeout(500);
            const val2 = await loc.inputValue().catch(() => '');
            if (val2 === chapterTitle) {
                addLog(platform, `标题已填(JS): ${chapterTitle}`);
                return true;
            }
        }
    }

    addLog(platform, `标题未能填入！`);
    return false;
}

module.exports = {
    fillSerialInput,
    fillTitleInput
};
