const { addLog, takeScreenshot } = require('./PublisherBase');
const { detectDialog, handleAckDialog, selectAIDeclaration, clickConfirmPublish } = require('./qimaoDialogHandler');

async function handlePublishDialogs(page, platform, maxRounds = 8) {
    for (let round = 0; round < maxRounds; round++) {
        await page.waitForTimeout(2000);
        const dialogInfo = await detectDialog(page);

        if (!dialogInfo.visible || !dialogInfo.text || dialogInfo.text.length < 5) {
            const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '').catch(() => '');
            if (/发布成功|上传成功|保存成功|已发布|审核中|操作成功|提交成功/.test(pageText)) {
                addLog(platform, '检测到成功关键词，发布完成！');
                return true;
            }
            if (round >= 5) break;
            continue;
        }

        addLog(platform, `弹窗内容(round${round}): "${dialogInfo.text.substring(0, 150)}"`);

        if (/重要提醒|我已知晓|我已阅读|著作权|违规内容/.test(dialogInfo.text)) {
            addLog(platform, '检测到"重要提醒"弹窗，点击确认...');
            await handleAckDialog(page, platform, dialogInfo, ['阅读', '知晓', '确认']);
            continue;
        }

        if (/原创|AI生成|确认发布|含AI|内容声明/.test(dialogInfo.text)) {
            addLog(platform, '检测到发布确认弹窗，处理"内容声明"...');
            await selectAIDeclaration(page, platform);
            await takeScreenshot(page, platform, 'qimao-ai-selected');
            addLog(platform, '等待5秒让AI声明生效...');
            await page.waitForTimeout(5000);
            await clickConfirmPublish(page, platform);

            const ackResult = await handleSecondaryAckDialogs(page, platform);
            if (ackResult === 'published') return true;
            break;
        }

        addLog(platform, '未知弹窗内容，尝试关闭...');
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(1000);
    }
    return false;
}

async function handleSecondaryAckDialogs(page, platform) {
    for (let ackRound = 0; ackRound < 5; ackRound++) {
        await page.waitForTimeout(2000);
        const ackDialogInfo = await detectDialog(page);

        if (!ackDialogInfo.visible || !ackDialogInfo.text || ackDialogInfo.text.length < 5) {
            const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '').catch(() => '');
            if (/发布成功|上传成功|保存成功|已发布|审核中|操作成功|提交成功/.test(pageText)) {
                addLog(platform, '检测到成功关键词，发布完成！');
                return 'published';
            }
            if (ackRound >= 3) break;
            continue;
        }

        if (/我已阅读|我已阅读知晓|阅读并知晓|AI生成内容声明/.test(ackDialogInfo.text)) {
            addLog(platform, '检测到"我已阅读知晓"弹窗...');
            await page.waitForTimeout(5000);
            await handleAckDialog(page, platform, ackDialogInfo, ['我已阅读', '阅读知晓', '知晓', '确认', '确定']);
            continue;
        }

        if (/立即发布确认|确认发布/.test(ackDialogInfo.text)) {
            addLog(platform, '检测到二次"确认发布"弹窗...');
            await page.waitForTimeout(5000);
            await clickConfirmPublish(page, platform);
            continue;
        }

        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(1000);
    }
    return 'unknown';
}

module.exports = { handlePublishDialogs, handleSecondaryAckDialogs };
