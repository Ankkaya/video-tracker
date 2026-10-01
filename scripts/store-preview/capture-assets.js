// Run with the Playwright browser_run_code tool after starting the preview Vite server.
async (page) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const output = 'C:/Users/Ankkaya/video-tracker/output/edge-store';
  const captures = [];
  async function capture(lang, name) {
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const path = `${output}/${lang}/${name}-1280x800.png`;
    await page.screenshot({ path, type: 'png', animations: 'disabled', scale: 'css' });
    captures.push(path);
  }
  for (const lang of ['zh-CN', 'en-US']) {
    const zh = lang === 'zh-CN';
    const url = `http://127.0.0.1:4173/scripts/store-preview/index.html?lang=${lang}`;
    const sampleTitle = zh ? '摄影入门：光线与构图' : 'Photography essentials: light and composition';
    await page.goto(url);
    await page.getByText(sampleTitle).waitFor();
    await capture(lang, '01-records');
    await page.getByRole('button', { name: zh ? '插件设置' : 'Settings', exact: true }).click();
    await page.getByText(zh ? '最低观看时长' : 'Minimum Watch Time', { exact: true }).waitFor();
    await capture(lang, '02-settings');
    await page.getByRole('button', { name: zh ? '站点管理' : 'Sites', exact: true }).click();
    await capture(lang, '03-sites');
    await page.goto(`${url}&view=popup`);
    await page.getByText(sampleTitle).waitFor();
    await capture(lang, '04-popup');
  }
  return captures;
}
