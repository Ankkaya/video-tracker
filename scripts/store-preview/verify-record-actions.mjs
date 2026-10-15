import assert from 'node:assert/strict';
import { mkdir, readdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = 'output/record-actions';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = 'http://127.0.0.1:4173/scripts/store-preview/index.html';
try {
  for (const language of ['zh-CN', 'en-US']) {
    const zh = language === 'zh-CN';
    await page.goto(`${base}?lang=${language}`);
    await page.locator('.record-card').first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.site-icon img')].every(img => img.complete && img.naturalWidth > 0));
    const actions = page.locator('.record-actions').first();
    const labels = zh ? ['继续观看', '标记已看完', '删除记录'] : ['Continue watching', 'Mark completed', 'Delete record'];
    for (const label of labels) {
      const button = actions.getByRole('button', { name: label, exact: true });
      assert.equal((await button.textContent()).trim(), '');
      await button.hover();
      await page.locator('.n-tooltip').getByText(label, { exact: true }).waitFor();
    }
    const boxes = await actions.getByRole('button').evaluateAll(buttons => buttons.map(button => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }));
    assert.ok(boxes.every(box => box.width === 36 && box.height === 36 && box.y === boxes[0].y));
    assert.equal(boxes[1].x - boxes[0].x, 44);
    await page.evaluate(() => { chrome.tabs.create = async ({ url }) => { window.__resumeUrl = url; return { id: 2 }; }; });
    await actions.getByRole('button', { name: labels[0], exact: true }).click();
    assert.ok((await page.evaluate(() => window.__resumeUrl)).includes('754'));
    await actions.getByRole('button', { name: labels[1], exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.record-card').length === 2);
    await page.locator('.n-radio-group').getByText(zh ? '已看完' : 'Completed', { exact: true }).click();
    await actions.getByRole('button', { name: zh ? '重新观看' : 'Watch again', exact: true }).waitFor();
    assert.equal(await actions.getByRole('button', { name: zh ? '标记未看完' : 'Mark unfinished', exact: true }).getAttribute('aria-pressed'), 'true');
    await actions.getByRole('button', { name: zh ? '标记未看完' : 'Mark unfinished', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.record-card').length === 0);
    await page.locator('.n-radio-group').getByText(zh ? '观看中' : 'Watching', { exact: true }).click();
    await actions.getByRole('button', { name: labels[1], exact: true }).waitFor();
    await actions.getByRole('button', { name: labels[2], exact: true }).click();
    await page.locator('.n-popconfirm').waitFor();
    assert.equal(await page.locator('.record-card').count(), 3);
    await page.locator('.n-popconfirm__action').getByRole('button').last().click();
    await page.waitForFunction(() => document.querySelectorAll('.record-card').length === 2);
  }
  await page.goto(base);
  await page.locator('.record-card').first().waitFor();
  await page.locator('.record-actions').first().getByRole('button', { name: '继续观看', exact: true }).hover();
  await page.locator('.n-tooltip').getByText('继续观看', { exact: true }).waitFor();
  await page.waitForTimeout(300); // Let the tooltip entrance animation settle for the design capture.
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.mouse.move(0, 0);
  await page.locator('.n-tooltip').waitFor({ state: 'hidden' });
  await page.evaluate(() => chrome.storage.local.set({ theme: 'dark' }));
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.record-card')).backgroundColor !== 'rgb(255, 255, 255)');
  await page.screenshot({ path: `${output}/dark.png`, fullPage: true, animations: 'disabled' });
  await page.evaluate(() => chrome.storage.local.set({ theme: 'light' }));
  await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true, animations: 'disabled' });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page overflows');
  const mobileBoxes = await page.locator('.record-actions').first().getByRole('button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().y));
  assert.ok(mobileBoxes.every(y => y === mobileBoxes[0]), 'Mobile actions must remain horizontal');
  // Decode every packaged icon with all external requests blocked.
  const assets = (await readdir('public/site-icons')).filter(file => /\.(svg|ico)$/.test(file));
  for (const file of assets) {
    assert.ok(await page.evaluate(file => new Promise(resolve => {
      const img = new Image(); img.onload = () => resolve(img.naturalWidth > 0); img.onerror = () => resolve(false); img.src = `/site-icons/${file}`;
    }), file), `Could not decode ${file}`);
  }
  await page.goto(`${base}?view=popup`);
  await page.waitForFunction(() => document.querySelectorAll('.site-icon img').length === 3 && [...document.querySelectorAll('.site-icon img')].every(img => img.complete && img.naturalWidth > 0));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}?view=records&state=site-icons`);
  await page.waitForFunction(() => document.querySelectorAll('.record-card').length === 18);
  await page.waitForFunction(() => document.querySelectorAll('.site-icon img').length === 17 && [...document.querySelectorAll('img')].every(img => img.complete && img.naturalWidth > 0));
  assert.equal(await page.locator('.site-icon-comparison img').count(), 2);
  assert.equal(await page.locator('.record-card').last().locator('.site-icon svg').count(), 1);
  assert.equal(await page.locator('.record-card').first().locator('.site-icon img').getAttribute('src'), '/site-icons/bilibili.ico');
  assert.ok(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight));
  await page.screenshot({ path: `${output}/site-icons-preview.png`, animations: 'disabled' });
  await page.locator('.site-icon-preview-notice').screenshot({ path: `${output}/bilibili-comparison.png`, animations: 'disabled' });
  await page.locator('.record-card').last().scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => scrollY > 0), 'Every test record must be reachable by scrolling');
  // The default fixture stays unchanged when leaving the optional preview mode.
  await page.goto(base);
  await page.waitForFunction(() => document.querySelectorAll('.record-card').length === 3);
  assert.equal(await page.locator('.site-icon-preview-notice').count(), 0);
  await page.evaluate(() => {
    window.__originalSendMessage = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = async message => message.type === 'SET_RECORD_COMPLETED'
      ? { error: 'Unknown message type' } : window.__originalSendMessage(message);
    chrome.runtime.reload = () => { window.__reloadRequested = true; };
  });
  await page.locator('.status-action').first().click();
  await page.locator('.completion-error').getByText('扩展后台未响应或版本尚未更新，请重新加载扩展后重试。观看记录会保留。').waitFor();
  assert.equal(await page.locator('.status-action').first().getAttribute('aria-pressed'), 'false');
  await page.getByRole('button', { name: '重新加载扩展', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__reloadRequested), true);
  await page.evaluate(() => {
    chrome.runtime.sendMessage = async message => message.type === 'SET_RECORD_COMPLETED'
      ? { success: false, error: 'QUOTA_BYTES quota exceeded' } : window.__originalSendMessage(message);
  });
  await page.locator('.status-action').first().click();
  await page.locator('.completion-error').getByText('无法更新观看状态：QUOTA_BYTES quota exceeded').waitFor();
  assert.equal(await page.getByRole('button', { name: '重新加载扩展', exact: true }).count(), 0);
  assert.equal(await page.locator('.status-action').first().getAttribute('aria-pressed'), 'false');
  await page.evaluate(() => { chrome.runtime.sendMessage = window.__originalSendMessage; });
  await page.locator('.status-action').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.record-card').length === 2);
  await page.locator('.n-radio-group').getByText('已看完', { exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.status-action')?.getAttribute('aria-pressed') === 'true');
  assert.equal(await page.locator('.completion-error').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Passed: 17 offline icons, horizontal icon actions, hover tooltips, resume, completion, delete confirmation, Chinese/English, mobile, popup, and 18 isolated icon preview records with Bilibili comparison.');
} finally { await browser.close(); }
