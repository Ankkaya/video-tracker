import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
await mkdir('output/onboarding/records', { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' });
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = 'http://127.0.0.1:4173/scripts/store-preview/index.html';
try {
  for (const lang of ['zh-CN', 'en-US']) {
    const zh = lang === 'zh-CN';
    for (const view of ['popup', 'records']) {
      await page.goto(`${base}?view=${view}&state=empty&lang=${lang}`);
      await page.getByText(zh ? '暂无观看记录' : 'No watch records yet', { exact: true }).waitFor();
      assert.equal(await page.locator('.recording-guide').count(), 0);
      assert.equal(await page.getByText(zh ? '保存你的第一个视频' : 'Save your first video', { exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: zh ? '去 B站选视频' : 'Find a video on Bilibili', exact: true }).count(), 0);
      if (view === 'popup') {
        await page.evaluate(() => {
          document.querySelector('.showcase-copy').remove();
          Object.assign(document.querySelector('.showcase').style, { width: '380px', height: 'auto', padding: '0', display: 'block' });
        });
        await page.locator('.popup-frame').screenshot({ path: `output/onboarding/records/${lang}-popup-empty.png` });
        await page.evaluate(() => chrome.storage.local.set({ theme: 'dark' }));
        await page.locator('.popup-frame').screenshot({ path: `output/onboarding/records/${lang}-popup-empty-dark.png` });
      } else {
        await page.screenshot({ path: `output/onboarding/records/${lang}-records-empty.png` });
      }
    }
  }

  for (const view of ['popup', 'records']) {
    await page.goto(`${base}?view=${view}`);
    await page.getByText('摄影入门：光线与构图', { exact: true }).waitFor();
    await page.getByPlaceholder('搜索视频标题...').fill('找不到的视频');
    await page.getByText('没有符合条件的记录', { exact: true }).waitFor();
    await page.getByRole('button', { name: view === 'popup' ? '清除搜索' : '清除筛选', exact: true }).click();
    await page.getByText('摄影入门：光线与构图', { exact: true }).waitFor();
    await page.evaluate(() => {
      chrome.tabs.create = async ({ url }) => { window.__resumeUrl = url; return { id: 2 }; };
    });
    const button = view === 'popup' ? page.locator('.record-item .resume-btn').first()
      : page.locator('.record-actions').first().getByRole('button', { name: '继续观看', exact: true });
    await button.click();
    await page.waitForFunction(() => !!window.__resumeUrl);
    const url = await page.evaluate(() => window.__resumeUrl);
    assert.ok(url.includes('example.com/video/0') && url.includes('754'), `Unexpected resume URL: ${url}`);
  }
  assert.deepEqual(errors, []);
  console.log('Records UI passed: simple empty states in both views and languages, dark popup, search/reset and resume.');
} finally { await browser.close(); }
