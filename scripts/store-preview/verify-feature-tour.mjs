import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
await mkdir('output/onboarding/feature-tour', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' });
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = 'http://127.0.0.1:4173/scripts/store-preview/index.html?tour=1';
async function waitForStep(step) {
  await page.locator(`.feature-tour[data-step="${step}"] .tour-panel`).waitFor();
  await page.waitForFunction(() => {
    const next = document.querySelector('.tour-next');
    return next && !next.disabled;
  });
  const rect = await page.locator('.tour-panel').boundingBox();
  const viewport = page.viewportSize();
  assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width + 1
    && rect.y + rect.height <= viewport.height + 1, `Tooltip outside viewport: ${JSON.stringify(rect)}`);
}
async function capture(name) {
  await page.screenshot({ path: `output/onboarding/feature-tour/${name}.png` });
}
async function checkTourAppearance() {
  const appearance = await page.evaluate(() => {
    const panel = document.querySelector('.tour-panel');
    const pointer = document.querySelector('.tour-pointer');
    const highlight = document.querySelector('.tour-highlight');
    const rect = highlight.getBoundingClientRect();
    const panelStyle = getComputedStyle(panel);
    const pointerStyle = pointer && getComputedStyle(pointer);
    const radius = parseFloat(getComputedStyle(highlight).borderTopLeftRadius);
    return {
      panelBorder: panelStyle.borderTopColor,
      panelFill: panelStyle.backgroundColor,
      pointerBorder: pointerStyle && (pointer.classList.contains('below') ? pointerStyle.borderTopColor : pointerStyle.borderBottomColor),
      pointerFill: pointerStyle?.backgroundColor,
      radius,
      // The rounded corner must remain shaded; the interior must allow interaction.
      cornerShaded: document.elementFromPoint(rect.left + 1, rect.top + 1)?.classList.contains('tour-mask-path'),
      interiorShaded: document.elementFromPoint(rect.left + radius, rect.top + radius)?.classList.contains('tour-mask-path'),
    };
  });
  if (appearance.pointerBorder) {
    assert.equal(appearance.pointerBorder, appearance.panelBorder, 'Arrow border differs from tooltip border');
    assert.equal(appearance.pointerFill, appearance.panelFill, 'Arrow fill differs from tooltip fill');
  }
  assert.ok(appearance.radius > 0);
  assert.equal(appearance.cornerShaded, true, 'Spotlight leaves a square unshaded corner');
  assert.equal(appearance.interiorShaded, false, 'Spotlight blocks its highlighted controls');
}
try {
  await page.goto(base);
  await waitForStep(0);
  await page.getByRole('heading', { name: '这里保存你的观看记录', exact: true }).waitFor();
  await checkTourAppearance();
  await capture('01-records');
  await page.evaluate(() => chrome.storage.local.set({ theme: 'dark' }));
  await checkTourAppearance();
  await capture('01-records-dark');
  await page.evaluate(() => chrome.storage.local.set({ theme: 'light' }));
  const initialSettings = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }));
  assert.equal(initialSettings.settings.autoRecord, false);
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await waitForStep(1);
  await checkTourAppearance();
  await capture('02-auto-record');
  await page.evaluate(() => {
    const original = chrome.runtime.sendMessage;
    let failNextSave = true;
    chrome.runtime.sendMessage = async message => {
      if (message.type === 'UPDATE_SETTINGS' && failNextSave) {
        failNextSave = false;
        return { success: false, error: 'Preview save failure' };
      }
      return original(message);
    };
  });
  await page.getByRole('switch', { name: '自动记录', exact: true }).click();
  await page.getByText('设置未保存成功，请重试。', { exact: true }).waitFor();
  const failedSave = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }));
  assert.equal(failedSave.settings.autoRecord, false);
  await page.getByRole('switch', { name: '自动记录', exact: true }).click();
  await page.waitForFunction(async () => (await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })).settings.autoRecord);
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await waitForStep(2);
  await capture('03-threshold');
  await page.locator('[data-tour="threshold"] .n-base-selection').click();
  await page.getByText('10 秒', { exact: true }).click();
  await page.waitForFunction(async () => (await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })).settings.threshold === 10);
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await waitForStep(3);
  await page.locator('[data-tour="shortcut"] kbd').getByText('Ctrl+Shift+V', { exact: true }).waitFor();
  await capture('04-shortcut');
  await page.getByRole('button', { name: '上一步', exact: true }).click();
  await waitForStep(2);
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await waitForStep(3);
  await page.getByRole('button', { name: '完成，开始使用', exact: true }).click();
  await page.locator('.feature-tour').waitFor({ state: 'hidden' });
  const finished = await page.evaluate(() => chrome.storage.local.get('video_tracker_feature_tour'));
  assert.equal(finished.video_tracker_feature_tour.status, 'completed');
  await page.getByRole('heading', { name: '记录管理', exact: true }).waitFor();
  await page.getByText('暂无观看记录', { exact: true }).waitFor();
  assert.equal(await page.locator('.recording-guide').count(), 0);
  await page.getByRole('button', { name: '功能引导', exact: true }).click();
  await waitForStep(0);
  await page.keyboard.press('Escape');
  await page.locator('.feature-tour').waitFor({ state: 'hidden' });
  const skipped = await page.evaluate(() => chrome.storage.local.get('video_tracker_feature_tour'));
  assert.equal(skipped.video_tracker_feature_tour.status, 'skipped');

  await page.goto(`${base}&lang=en-US`);
  await waitForStep(0);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await waitForStep(1);
  await page.evaluate(() => chrome.storage.local.set({ theme: 'dark' }));
  await checkTourAppearance();
  await capture('en-dark-auto-record');

  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto(base);
  await page.evaluate(() => document.documentElement.style.overflow = 'auto');
  for (let step = 0; step < 4; step++) {
    await waitForStep(step);
    await capture(`mobile-${step + 1}`);
    if (step < 3) await page.getByRole('button', { name: '下一步', exact: true }).click();
  }
  assert.deepEqual(errors, []);
  console.log('Feature tour passed: four anchors, real switch and threshold controls, back, finish, skip, replay, English, dark theme, mobile positioning.');
} finally { await browser.close(); }
