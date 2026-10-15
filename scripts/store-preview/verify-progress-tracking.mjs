import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
await mkdir('output/progress-tracking', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = 'http://127.0.0.1:4173/scripts/store-preview/index.html';
try {
  for (const lang of ['zh-CN', 'en-US']) {
    const zh = lang === 'zh-CN';
    await page.goto(`${base}?view=records&lang=${lang}`);
    await page.locator('.record-card').first().waitFor();
    assert.equal(await page.locator('.n-radio-group .n-radio-button').count(), 2);
    assert.equal(await page.locator('.n-radio-group').getByText(zh ? '全部' : 'All', { exact: true }).count(), 0);
    assert.equal(await page.locator('.record-card').count(), 3);
    const initialTime = await page.evaluate(async () => (await chrome.storage.local.get('video_tracker_records')).video_tracker_records[0].currentTime);
    await page.getByRole('button', { name: zh ? '标记已看完' : 'Mark completed', exact: true }).first().click();
    await page.waitForFunction(() => document.querySelectorAll('.record-card').length === 2);
    assert.equal(await page.evaluate(async () => (await chrome.storage.local.get('video_tracker_records')).video_tracker_records[0].currentTime), initialTime);
    await page.locator('.n-radio-group').getByText(zh ? '已看完' : 'Completed', { exact: true }).click();
    await page.getByRole('button', { name: zh ? '重新观看' : 'Watch again', exact: true }).waitFor();
    assert.equal(await page.locator('.record-card').count(), 1);
    await page.getByPlaceholder(zh ? '搜索视频标题...' : 'Search video title...').fill('no-match');
    await page.getByText(zh ? '没有符合条件的记录' : 'No matching records', { exact: true }).waitFor();
    await page.getByRole('button', { name: zh ? '🔄 重置' : '🔄 Reset', exact: true }).click();
    await page.getByRole('button', { name: zh ? '重新观看' : 'Watch again', exact: true }).waitFor();
    assert.equal(await page.locator('.record-card').count(), 1, 'Reset should keep the current status category');
    await page.evaluate(() => { chrome.tabs.create = async ({ url }) => { window.__openedVideo = url; return { id: 2 }; }; });
    await page.getByRole('button', { name: zh ? '重新观看' : 'Watch again', exact: true }).click();
    await page.waitForFunction(() => !!window.__openedVideo);
    const replay = new URL(await page.evaluate(() => window.__openedVideo));
    assert.equal(replay.searchParams.has('t'), false);
    assert.equal(replay.searchParams.get('vt_record'), 'sample-0');
    await page.screenshot({ path: `output/progress-tracking/${lang}-completed.png` });
    await page.getByRole('button', { name: zh ? '标记未看完' : 'Mark unfinished', exact: true }).click();
    await page.getByText(zh ? '没有符合条件的记录' : 'No matching records', { exact: true }).waitFor();
    await page.locator('.n-radio-group').getByText(zh ? '观看中' : 'Watching', { exact: true }).click();
    assert.equal(await page.locator('.record-card').count(), 3);
    await page.setViewportSize({ width: 600, height: 850 });
    await page.screenshot({ path: `output/progress-tracking/${lang}-narrow.png` });
    const overflowing = await page.locator('.record-card').evaluateAll(cards => cards.some(card => card.scrollWidth > card.clientWidth + 2));
    assert.equal(overflowing, false);
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto(`${base}?view=popup&lang=${lang}`);
    await page.locator('.record-item').first().waitFor();
    assert.equal(await page.locator('.record-item').count(), 3);
    await page.evaluate(async () => {
      const key = 'video_tracker_records';
      const records = (await chrome.storage.local.get(key))[key];
      records[0] = { ...records[0], completed: true };
      await chrome.storage.local.set({ [key]: records });
    });
    await page.waitForFunction(() => document.querySelectorAll('.record-item').length === 2);
    await page.evaluate(async () => {
      const key = 'video_tracker_records';
      const records = (await chrome.storage.local.get(key))[key];
      await chrome.storage.local.set({ [key]: records.map(record => ({ ...record, completed: true })) });
    });
    await page.getByText(zh ? '记录中的视频都已看完' : 'All recorded videos are completed', { exact: true }).waitFor();
    assert.equal(await page.locator('.record-item').count(), 0);
    await page.locator('.popup-frame').screenshot({ path: `output/progress-tracking/${lang}-popup-completed.png` });
  }
  assert.deepEqual(errors, []);
  console.log('Progress UI passed: completion filters, manual status without progress loss, replay identity, narrow layouts, popup live filtering, Chinese and English.');
} finally { await browser.close(); }
