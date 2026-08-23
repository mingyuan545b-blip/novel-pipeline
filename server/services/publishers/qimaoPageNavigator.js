const { addLog } = require('./PublisherBase');

async function getPageInfo(page, platform) {
    const pageInfo = await page.evaluate(() => {
        const chapterNums = [];
        const tableRows = document.querySelectorAll('.el-table__row');
        for (const row of tableRows) {
            const text = row.innerText || '';
            const numMatch = text.match(/第\s*(\d+)\s*章/);
            if (numMatch) chapterNums.push(parseInt(numMatch[1], 10));
        }
        const uniqueNums = [...new Set(chapterNums)].sort((a, b) => a - b);
        const maxChapter = uniqueNums[uniqueNums.length - 1] || 0;
        const itemsPerPage = uniqueNums.length;
        const totalPages = itemsPerPage > 0 ? Math.ceil(maxChapter / itemsPerPage) : 1;
        return { totalPages, chapterNums: uniqueNums, minChapter: uniqueNums[0] || 0, maxChapter, itemsPerPage };
    });
    addLog(platform, `页面信息: 总页数=${pageInfo.totalPages} 当前页章节=${pageInfo.minChapter}-${pageInfo.maxChapter} 每页${pageInfo.itemsPerPage}章`);
    return pageInfo;
}

function calculateTargetPage(pageInfo, targetChapterNum) {
    if (pageInfo.itemsPerPage > 0 && pageInfo.maxChapter > 0) {
        const targetPage = Math.ceil((pageInfo.maxChapter - targetChapterNum + 1) / pageInfo.itemsPerPage);
        return Math.max(1, Math.min(targetPage, pageInfo.totalPages));
    }
    return 1;
}

async function findAndClickModify(page, platform, chapterNum, pageInfo, bookId, targetPage) {
    const tryFindAndClickModify = async () => {
        const result = await page.evaluate((num) => {
            const tableRows = document.querySelectorAll('.el-table__row');
            for (const row of tableRows) {
                const text = row.innerText || '';
                const numMatch = text.match(/第\s*(\d+)\s*章/);
                if (numMatch && numMatch[1] === num) {
                    const links = row.querySelectorAll('a, button');
                    for (const link of links) {
                        const linkText = (link.innerText || '').trim();
                        const href = link.href || link.getAttribute('href') || '';
                        if (linkText === '修改' || linkText === '编辑' || href.includes('book-upload') || href.includes('edit')) {
                            link.click();
                            return { found: true, method: 'click', linkText, href: href.substring(0, 100) };
                        }
                    }
                }
            }
            return { found: false };
        }, chapterNum);
        return result;
    };

    let editClicked = await tryFindAndClickModify();

    if (!editClicked.found) {
        addLog(platform, `第${targetPage}页未找到，搜索相邻页...`);
        const searchPages = [];
        for (let offset = 1; offset <= 3; offset++) {
            if (targetPage - offset >= 1) searchPages.push(targetPage - offset);
            if (targetPage + offset <= pageInfo.totalPages) searchPages.push(targetPage + offset);
        }
        for (const pageIdx of searchPages) {
            await page.goto(`https://zuozhe.qimao.com/front/book-manage/manage?id=${bookId}&page=${pageIdx}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(2000);
            editClicked = await tryFindAndClickModify();
            if (editClicked.found) break;
        }
    }

    if (!editClicked?.found) {
        for (let pageIdx = 1; pageIdx <= pageInfo.totalPages; pageIdx++) {
            if (Math.abs(pageIdx - targetPage) <= 3) continue;
            await page.goto(`https://zuozhe.qimao.com/front/book-manage/manage?id=${bookId}&page=${pageIdx}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(2000);
            editClicked = await tryFindAndClickModify();
            if (editClicked.found) break;
        }
    }

    if (!editClicked?.found) {
        const chapterRow = page.locator(`tr:has-text("第${chapterNum}章"), .el-table__row:has-text("第${chapterNum}章")`).first();
        if (await chapterRow.count()) {
            const editBtn = chapterRow.locator('a:has-text("修改"), button:has-text("修改")').first();
            if (await editBtn.count()) {
                await editBtn.click({ timeout: 5000 }).catch(async () => editBtn.click({ force: true }).catch(() => {}));
                editClicked = { found: true, method: 'playwright' };
            }
        }
    }

    if (editClicked?.found) {
        addLog(platform, `已点击修改按钮: ${JSON.stringify(editClicked)}`);
        return true;
    }
    return false;
}

async function waitForEditor(page, platform, currentUrl, bookId, targetPage, chapterNum) {
    const quickCheck = await page.evaluate(() => !!document.querySelector('div.q-contenteditable.book[contenteditable="true"], div[contenteditable="true"]'));
    if (quickCheck) return true;

    addLog(platform, '编辑器未立即出现，等待页面加载...');
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    currentUrl = page.url();

    if (currentUrl.includes('book-manage') && !quickCheck) {
        addLog(platform, '仍在章节管理页且编辑器未出现，尝试Playwright直接点击...');
        const modifyBtn = page.locator(`tr:has-text("第${chapterNum}章") a:has-text("修改"), tr:has-text("第${chapterNum}章") button:has-text("修改")`).first();
        if (await modifyBtn.count()) {
            await modifyBtn.click({ timeout: 5000 }).catch(async () => modifyBtn.click({ force: true }).catch(() => {}));
            await page.waitForTimeout(5000);
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        }
    }

    const editorCheck2 = await page.evaluate(() => !!document.querySelector('div.q-contenteditable.book[contenteditable="true"], div[contenteditable="true"]'));
    if (editorCheck2) return true;

    if (!currentUrl.includes('book-upload') && !currentUrl.includes('edit') && !currentUrl.includes('book-manage')) {
        await page.goto(`https://zuozhe.qimao.com/front/book-manage/manage?id=${bookId}&page=${targetPage}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        const retryEditBtn = page.locator('text=修改').first();
        if (await retryEditBtn.count()) {
            await retryEditBtn.click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(3000);
        }
    }

    return await page.evaluate(() => !!document.querySelector('div.q-contenteditable.book[contenteditable="true"], div[contenteditable="true"]'));
}

module.exports = { getPageInfo, calculateTargetPage, findAndClickModify, waitForEditor };
