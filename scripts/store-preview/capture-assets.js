import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
// Real components with fictional local data; never send requests to cloud services.
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function capture(locale, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(root, 'output/edge-store', locale, `${name}-1280x800.png`), type: 'png', animations: 'disabled', scale: 'css' });
  await page.screenshot({ path: resolve(root, 'output/chrome-store', locale, `${name}-1280x800.jpg`), type: 'jpeg', quality: 95, animations: 'disabled', scale: 'css' });
}
try {
  for (const locale of ['zh-CN', 'en-US']) {
    const zh = locale === 'zh-CN';
    const url = `http://127.0.0.1:4173/scripts/store-preview/index.html?lang=${locale}`;
    for (const store of ['chrome-store', 'edge-store']) await mkdir(resolve(root, 'output', store, locale), { recursive: true });
    await page.goto(url);
    await page.getByText(zh ? '摄影入门：光线与构图' : 'Photography essentials: light and composition', { exact: true }).waitFor();
    await capture(locale, '01-records');
    await page.locator('.record-actions').first().getByRole('button', { name: zh ? '标记已看完' : 'Mark completed', exact: true }).click();
    await page.locator('.n-radio__label').getByText(zh ? '已看完' : 'Completed', { exact: true }).click();
    await page.getByRole('button', { name: zh ? '重新观看' : 'Watch again', exact: true }).waitFor();
    await page.screenshot({ path: resolve(root, 'landing/assets', `completed-${locale}.png`), animations: 'disabled' });
    await page.locator('.n-radio__label').getByText(zh ? '观看中' : 'Watching', { exact: true }).click();
    await page.getByRole('button', { name: zh ? '插件设置' : 'Settings', exact: true }).click();
    await page.getByText(zh ? '最低观看时长' : 'Minimum Watch Time', { exact: true }).waitFor();
    await page.getByRole('switch').first().waitFor();
    await capture(locale, '02-settings');
    await page.getByRole('button', { name: zh ? '站点过滤' : 'Site exclusions', exact: true }).click();
    await page.getByText('example.com', { exact: true }).waitFor();
    await capture(locale, '03-sites');
    await page.getByRole('button', { name: zh ? '反馈问题' : 'Report an issue', exact: true }).click();
    await page.getByRole('textbox', { name: zh ? '反馈内容' : 'Feedback', exact: true }).fill(zh ? '点击观看记录后，视频没有恢复到上次播放的位置，希望可以检查一下。' : 'Opening a saved record did not restore the last playback position. Please check the resume behavior.');
    await page.getByText('0/1', { exact: false }).waitFor();
    if (await page.locator('.feedback-receipt').count()) throw new Error('Feedback references must not be displayed');
    await capture(locale, '05-feedback');
    await page.goto(`${url}&view=popup`);
    await page.getByText(zh ? '摄影入门：光线与构图' : 'Photography essentials: light and composition', { exact: true }).waitFor();
    await capture(locale, '04-popup');
    await page.locator('.popup-frame').screenshot({ path: resolve(root, 'landing/assets', `popup-${locale}.png`), animations: 'disabled' });
  }
  for (const languagePath of ['landing/index.html', 'landing/en/index.html']) {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`http://127.0.0.1:4173/${languagePath}`);
      await page.locator('.feature-card').last().waitFor();
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error(`Website overflow: ${languagePath} at ${width}px`);
      await mkdir(resolve(root, 'output/website-preview'), { recursive: true });
      await page.screenshot({ path: resolve(root, 'output/website-preview', `${languagePath.includes('/en/') ? 'en-US' : 'zh-CN'}-homepage-${width}.png`), fullPage: true, animations: 'disabled' });
    }
  }
  if (errors.length) throw new Error(`Preview page errors: ${errors.join('; ')}`);
  for (const store of ['chrome-store', 'edge-store']) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`http://127.0.0.1:4173/output/${store}/index.html`);
    await page.locator('img').evaluateAll(async images => {
      for (const image of images) {
        image.loading = 'eager';
        await image.decode();
        if (image.naturalWidth !== 1280 || image.naturalHeight !== 800) throw new Error('Store screenshot dimensions must be 1280x800');
      }
    });
  }
  console.log('Captured 5 bilingual screenshots for each store; desktop/mobile website checks passed. No external requests sent.');
} finally { await browser.close(); }
