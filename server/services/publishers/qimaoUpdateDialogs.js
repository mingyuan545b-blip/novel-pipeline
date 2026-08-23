const { addLog } = require('./PublisherBase');
const { detectDialog, handleAckDialog, selectAIDeclaration } = require('./qimaoDialogHandler');

async function handleUpdateDialogs(page, platform, maxRounds = 8) {
    for (let round = 0; round < maxRounds; round++) {
        await page.waitForTimeout(2000);
        const dialogInfo = await detectDialog(page);

        if (!dialogInfo.visible || !dialogInfo.text || dialogInfo.text.length < 5) {
            const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '').catch(() => '');
            if (/保存成功|修改成功|发布成功|操作成功|提交成功|审核中/.test(pageText)) {
                addLog(platform, '检测到成功关键词，修改完成！');
                return true;
            }
            if (round >= 5) break;
            continue;
        }

        addLog(platform, `弹窗内容(round${round}): "${dialogInfo.text.substring(0, 150)}"`);

        if (/重要提醒|我已知晓|我已阅读|著作权|违规内容/.test(dialogInfo.text)) {
            await handleAckDialog(page, platform, dialogInfo, ['阅读', '知晓', '确认']);
            continue;
        }

        if (/原创|AI生成|确认发布|含AI|内容声明/.test(dialogInfo.text)) {
            await selectAIDeclaration(page, platform);
            for (const btn of dialogInfo.buttons) {
                if (btn.text.includes('确认发布') || btn.text.includes('确认') || btn.text.includes('发布')) {
                    const loc = page.locator(`.el-dialog ${btn.tag.toLowerCase()}`).filter({ hasText: btn.text }).first();
                    if (await loc.count()) {
                        await loc.click({ timeout: 5000 }).catch(async () => loc.click({ force: true }).catch(() => {}));
                    }
                    break;
                }
            }
            await page.waitForTimeout(2000);
            continue;
        }

        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(1000);
    }
    return false;
}

module.exports = { handleUpdateDialogs };
