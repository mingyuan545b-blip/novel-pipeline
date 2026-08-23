const { addLog } = require('./constants');

async function dismissEditorGuides(page, platform) {
    const maxRounds = 8;
    for (let round = 1; round <= maxRounds; round++) {
        const guide = page.locator('.reactour__helper, .publish-guide, [role="dialog"], .arco-modal, .byte-modal').last();
        if (!await guide.count()) break;
        const text = ((await guide.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
        let handled = false;
        const labels = ['知道了', '我知道了', '下一步', '完成', '跳过', '关闭'];
        for (const label of labels) {
            const btn = guide.locator('button, div, span').filter({ hasText: label }).first();
            if (await btn.count()) { await btn.click({ timeout: 3000 }).catch(async () => btn.click({ timeout: 3000, force: true })); handled = true; await page.waitForTimeout(800); break; }
        }
        if (!handled) {
            const closeBtn = guide.locator('[aria-label="Close"], .reactour__close-button, .arco-modal-close-icon, .byte-modal-close-icon').first();
            if (await closeBtn.count()) { await closeBtn.click({ timeout: 3000 }).catch(async () => closeBtn.click({ timeout: 3000, force: true })); handled = true; await page.waitForTimeout(800); }
        }
        if (!handled && /\d+\s*\/\s*\d+/.test(text)) { await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(500); handled = true; }
        if (!handled) break;
    }
}

async function handleInterceptors(page, platform) {
    const maxRounds = 10;
    for (let round = 1; round <= maxRounds; round++) {
        const publishModal = page.locator('.arco-modal.publish-confirm-container-new').last();
        if (await publishModal.count()) return 'publish-modal';
        const dialog = page.locator('.arco-modal[role="dialog"], .byte-modal[role="dialog"], .reactour__helper[role="dialog"], .reactour__helper, .arco-modal, .byte-modal').last();
        if (await dialog.count()) {
            const text = ((await dialog.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
            const isSpellcheck = /错别字|智能纠错|是否确定提交|发布提示|敏感词|替换全部|忽略全部/.test(text);
            const isRiskDetection = /是否进行内容风险检测|风险检测/.test(text);
            const isGuide = /知道了|我知道了|下一步|跳过|完成|欢迎|引导|卡文锦囊|AI帮你/.test(text);
            let candidates = [];
            if (isSpellcheck) candidates = ['忽略全部', '替换全部', '全部替换', '确认替换', '提交'];
            else if (isRiskDetection) candidates = ['确定'];
            else if (isGuide) candidates = ['我知道了', '知道了', '下一步', '完成', '跳过', '关闭'];
            let handled = false;
            for (const label of candidates) {
                const btn = dialog.locator('button').filter({ hasText: label }).first();
                if (await btn.count()) { addLog(platform, `处理拦路弹窗 round${round}: [${label}] ${text.slice(0, 80)}`); await btn.click().catch(async () => btn.click({ force: true })); await page.waitForTimeout(1800); handled = true; break; }
            }
            const publishModal2 = page.locator('.arco-modal.publish-confirm-container-new').last();
            if (await publishModal2.count()) return 'publish-modal';
            const anyDialog = page.locator('.arco-modal[role="dialog"], .byte-modal[role="dialog"], .reactour__helper[role="dialog"], .reactour__helper, .arco-modal, .byte-modal').last();
            if (!(await anyDialog.count())) continue;
            if (!handled && isGuide) { const closeBtn = anyDialog.locator('[aria-label="Close"], .reactour__close-button, .arco-modal-close-icon, .byte-modal-close-icon').first(); if (await closeBtn.count()) { await closeBtn.click().catch(async () => closeBtn.click({ force: true })); await page.waitForTimeout(1500); continue; } }
            if (!handled && isSpellcheck) { addLog(platform, `敏感词/错别字弹窗未处理，尝试Escape关闭...`); await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(1500); continue; }
            if (!handled && isRiskDetection) return 'blocked:risk-detection';
            if (!handled && !isGuide) return 'blocked:unknown-dialog';
        }
        await page.waitForTimeout(1200);
    }
    return 'unknown';
}

async function debugPageInputs(page, platform) {
    const inputInfo = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(el => ({ tag: el.tagName, type: el.type, placeholder: el.placeholder || '', name: el.name || '', className: el.className || '', id: el.id || '', value: el.value || '', visible: el.offsetWidth > 0 && el.offsetHeight > 0, ariaLabel: el.getAttribute('aria-label') || '', role: el.getAttribute('role') || '' }));
    });
    addLog(platform, `页面input元素(${inputInfo.length}个): ${JSON.stringify(inputInfo.slice(0, 20))}`);
    return inputInfo;
}

async function fillSerialInput(page, platform, chapterNum) {
    addLog(platform, `填写章节序号(纯阿拉伯数字): ${chapterNum}`);
    const selectors = ['.serial-editor-title-left .left-input input.serial-input', '.serial-editor-title-left input.serial-input', '.left-input input.serial-input'];
    for (const sel of selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count()) {
            const ph = await loc.getAttribute('placeholder').catch(() => '');
            if (ph && ph.includes('标题')) { addLog(platform, `跳过选择器 ${sel} (匹配到了标题框)`); continue; }
            addLog(platform, `找到序号框(${sel})，用键盘输入...`);
            await loc.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300); await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace'); await page.waitForTimeout(200); await page.keyboard.type(chapterNum, { delay: 80 }); await page.waitForTimeout(300); await page.keyboard.press('Tab'); await page.waitForTimeout(500);
            const val = await loc.inputValue().catch(() => '');
            addLog(platform, `序号框填入后值: 期望=${chapterNum} 实际=${val}`);
            if (val === chapterNum) { addLog(platform, `章节序号已填: ${chapterNum}`); return true; }
            addLog(platform, `fill()值不匹配，尝试JS直接设值+触发事件...`);
            await loc.evaluate((el, num) => { const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; nativeInputValueSetter.call(el, num); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, chapterNum);
            await page.waitForTimeout(500);
            const val2 = await loc.inputValue().catch(() => '');
            addLog(platform, `JS设值后: 期望=${chapterNum} 实际=${val2}`);
            if (val2 === chapterNum) { addLog(platform, `章节序号已填(JS): ${chapterNum}`); return true; }
        }
    }
    addLog(platform, '选择器全部未匹配，用JS按DOM结构精确定位+键盘输入...');
    const found = await page.evaluate(() => { const leftInput = document.querySelector('.serial-editor-title-left .left-input'); if (leftInput) return !!leftInput.querySelector('input'); const allInputs = Array.from(document.querySelectorAll('input.serial-input')); const serialInput = allInputs.find(el => !el.placeholder || el.placeholder === ''); return !!serialInput; });
    if (found) {
        const jsSel = '.serial-editor-title-left .left-input input, input.serial-input:not([placeholder])';
        const loc = page.locator(jsSel).first();
        if (await loc.count()) { await loc.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300); await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace'); await page.waitForTimeout(200); await page.keyboard.type(chapterNum, { delay: 80 }); await page.waitForTimeout(300); await page.keyboard.press('Tab'); await page.waitForTimeout(500); const val = await loc.inputValue().catch(() => ''); addLog(platform, `JS定位+键盘输入后: 期望=${chapterNum} 实际=${val}`); if (val === chapterNum) return true; }
    }
    addLog(platform, `章节序号未能填入！`); return false;
}

async function fillTitleInput(page, platform, chapterTitle) {
    addLog(platform, `填写标题(不含"第X章"): ${chapterTitle}`);
    const selectors = ['.serial-editor-title-right .serial-editor-input-hint input[placeholder="请输入标题"]', '.serial-editor-title-right input[placeholder="请输入标题"]', 'input.serial-input.serial-editor-input-hint-area[placeholder="请输入标题"]', 'input[placeholder="请输入标题"]'];
    for (const sel of selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count()) {
            addLog(platform, `找到标题框(${sel})，用键盘输入...`);
            await loc.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300); await page.keyboard.press('Control+a'); await page.keyboard.press('Backspace'); await page.waitForTimeout(200); await page.keyboard.type(chapterTitle, { delay: 50 }); await page.waitForTimeout(300); await page.keyboard.press('Tab'); await page.waitForTimeout(500);
            const val = await loc.inputValue().catch(() => '');
            addLog(platform, `标题框填入后值: 期望=${chapterTitle} 实际=${val}`);
            if (val === chapterTitle) { addLog(platform, `标题已填: ${chapterTitle}`); return true; }
            addLog(platform, `键盘输入值不匹配，尝试JS直接设值...`);
            await loc.evaluate((el, title) => { const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; nativeInputValueSetter.call(el, title); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, chapterTitle);
            await page.waitForTimeout(500);
            const val2 = await loc.inputValue().catch(() => '');
            if (val2 === chapterTitle) { addLog(platform, `标题已填(JS): ${chapterTitle}`); return true; }
        }
    }
    addLog(platform, `标题未能填入！`); return false;
}

module.exports = { dismissEditorGuides, handleInterceptors, debugPageInputs, fillSerialInput, fillTitleInput };
