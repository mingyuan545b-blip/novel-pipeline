const { addLog, takeScreenshot, handleInterceptors } = require('./PublisherBase');

async function clickNextAndHandleGates(page, platform) {
    addLog(platform, '等待"下一步"按钮启用...');
    const nextBtn = page.locator('.publish-button.auto-editor-next').first();
    try {
        await nextBtn.waitFor({ state: 'visible', timeout: 5000 });
        const isDisabled = await nextBtn.isDisabled().catch(() => true);
        if (isDisabled) {
            addLog(platform, '"下一步"按钮当前disabled，等待启用(最多30秒)...');
            for (let wait = 0; wait < 30; wait++) {
                await page.waitForTimeout(1000);
                const stillDisabled = await nextBtn.isDisabled().catch(() => true);
                if (!stillDisabled) {
                    addLog(platform, '"下一步"按钮已启用！');
                    break;
                }
            }
            const finalDisabled = await nextBtn.isDisabled().catch(() => true);
            if (finalDisabled) {
                addLog(platform, '"下一步"按钮仍disabled，尝试force click...');
                await takeScreenshot(page, platform, 'next-still-disabled');
            }
        }
    } catch (e) {
        addLog(platform, `等待"下一步"按钮异常: ${e.message?.substring(0, 80)}`);
    }

    addLog(platform, '点击"下一步"...');
    if (await nextBtn.count()) {
        const isDisabled2 = await nextBtn.isDisabled().catch(() => false);
        if (isDisabled2) {
            addLog(platform, '按钮仍disabled，使用force click...');
            await nextBtn.click({ force: true }).catch(() => {});
        } else {
            await nextBtn.click();
        }
    } else {
        const fallbackNext = page.locator('button').filter({ hasText: '下一步' }).first();
        await fallbackNext.click({ timeout: 5000 }).catch(async () => fallbackNext.click({ timeout: 5000, force: true }));
    }
    await page.waitForTimeout(2000);
    await takeScreenshot(page, platform, 'after-next');

    addLog(platform, '处理拦路弹窗...');
    const gateResult = await handleInterceptors(page, platform);
    await takeScreenshot(page, platform, 'after-interceptors');
    addLog(platform, `弹窗处理结果: ${gateResult}`);
    return gateResult;
}

async function confirmPublishModal(page, platform) {
    const publishModal = page.locator('.arco-modal.publish-confirm-container-new').last();
    if (!await publishModal.count()) {
        addLog(platform, '未检测到最终发布弹窗，尝试再次点击下一步...');
        const retryNext = page.locator('.publish-button.auto-editor-next, button').filter({ hasText: '下一步' }).first();
        if (await retryNext.count()) {
            await retryNext.click().catch(async () => retryNext.click({ force: true }));
            await page.waitForTimeout(2000);
        }
        const retryGate = await handleInterceptors(page, platform);
        addLog(platform, `重试弹窗处理结果: ${retryGate}`);
        const retryModal = page.locator('.arco-modal.publish-confirm-container-new').last();
        if (!await retryModal.count()) {
            throw new Error(`未检测到最终发布弹窗。retryGate=${retryGate}`);
        }
    }

    addLog(platform, '处理"是否使用AI"选项...');
    const noLabel = publishModal.locator('label').filter({ hasText: '否' }).first();
    if (await noLabel.count()) {
        await noLabel.click().catch(async () => noLabel.click({ force: true }));
        await page.waitForTimeout(500);
    }

    const selectedAiNo = await publishModal.evaluate((el) => {
        const textNodes = Array.from(el.querySelectorAll('label, .arco-radio, .arco-radio-wrapper, [role="radio"], span, div'));
        for (const node of textNodes) {
            const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
            if (text !== '否') continue;
            const cls = String(node.className || '');
            const checked = cls.includes('checked') || node.getAttribute('aria-checked') === 'true';
            const nestedChecked = !!node.querySelector('.checked, .arco-radio-checked, [aria-checked="true"]');
            if (checked || nestedChecked) return true;
        }
        return false;
    }).catch(() => false);

    if (!selectedAiNo) {
        addLog(platform, '未成功选中"是否使用AI=否"，尝试再次点击...');
        const radioNo = publishModal.locator('[role="radio"], .arco-radio').filter({ hasText: '否' }).first();
        if (await radioNo.count()) {
            await radioNo.click().catch(async () => radioNo.click({ force: true }));
            await page.waitForTimeout(500);
        }
    }

    await takeScreenshot(page, platform, 'modal-ai-no');

    addLog(platform, '点击"确认发布"...');
    const confirmBtn = publishModal.locator('button').filter({ hasText: '确认发布' }).first();
    if (!await confirmBtn.count()) {
        throw new Error('未找到"确认发布"按钮');
    }
    await confirmBtn.click().catch(async () => confirmBtn.click({ force: true }));
    await page.waitForTimeout(2500);

    const stillOnPublishModal = await page.locator('.arco-modal.publish-confirm-container-new').last().count();
    if (stillOnPublishModal) {
        addLog(platform, '点击"确认发布"后弹窗未关闭，可能"是否使用AI"未正确选中');
        await takeScreenshot(page, platform, 'modal-still-open');
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(3000);
    }

    await takeScreenshot(page, platform, 'after-confirm');
}

module.exports = {
    clickNextAndHandleGates,
    confirmPublishModal
};
