import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Render reproducible promotional artwork from the current real popup capture.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.route('**/*', route => route.abort());
  for (const locale of ['zh-CN', 'en-US']) {
    const zh = locale === 'zh-CN';
    const popup = (await readFile(resolve(root, `landing/assets/popup-${locale}.png`))).toString('base64');
    const icon = (await readFile(resolve(root, 'public/icon-128.png'))).toString('base64');
    for (const [size, width, height] of [['small', 440, 280], ['large', 1400, 560]]) {
      const small = size === 'small';
      await page.setViewportSize({ width, height });
      await page.setContent(`<!doctype html><html lang="${locale}"><meta charset="utf-8"><style>
        *{box-sizing:border-box}body{margin:0;font-family:'Segoe UI','Microsoft YaHei',sans-serif;color:#14243d;background:linear-gradient(115deg,#eef4ff,#fff 65%,#e6fbf2)}
        main{height:100vh;display:flex;align-items:center;justify-content:space-between;padding:${small ? '28px 32px' : '58px 80px'};gap:48px;overflow:hidden}
        .brand{display:flex;align-items:center;gap:12px;font-size:${small ? 19 : 25}px;font-weight:700}.brand img{width:${small ? 30 : 40}px;height:auto}
        h1{font-size:${small ? (zh ? 31 : 30) : (zh ? 62 : 56)}px;line-height:1.18;letter-spacing:-1px;margin:${small ? '20px 0 14px' : '34px 0 24px'}}
        p{font-size:${small ? 14 : 23}px;line-height:1.65;color:#53637b;margin:0}.note{font-size:${small ? 12 : 16}px;color:#56667e;margin-top:${small ? 16 : 30}px}
        .product{width:310px;max-height:470px;object-fit:contain;border:1px solid #e4e8f0;border-radius:18px;box-shadow:0 18px 50px #20325a22}
      </style><main><section><div class="brand"><img src="data:image/png;base64,${icon}" alt="">VideoTracker</div>
      <h1>${zh ? '接着上次看。<br>看完，也有记录。' : 'Pick up where<br>you left off.'}</h1>
      <p>${zh ? '继续观看 · 完成状态 · 可选加密同步' : 'Resume · Completion status · Optional encrypted sync'}</p>
      <div class="note">${zh ? '本地记录无需账号 · Chrome / Edge' : 'Local records, no account needed · Chrome / Edge'}</div></section>
      ${small ? '' : `<img class="product" src="data:image/png;base64,${popup}" alt="">`}</main></html>`);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
      if (await page.evaluate(() => [...document.querySelectorAll('h1,p,.note')].some(el => el.getBoundingClientRect().right > innerWidth || el.getBoundingClientRect().bottom > innerHeight))) throw new Error(`Promo overflow: ${locale}/${size}`);
      const png = await page.screenshot({ animations: 'disabled' });
      for (const store of ['chrome-store', 'edge-store']) await writeFile(resolve(root, `output/${store}/${locale}/promo-${size}-${width}x${height}.png`), png);
    }
  }
} finally { await browser.close(); }
console.log('Updated both stores: bilingual 440x280 and 1400x560 promotional images.');
