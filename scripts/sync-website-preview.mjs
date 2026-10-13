import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const homepage = 'https://video-tracker.ankkaya.top/';
for (const [path, locale, asset, home] of [
  ['landing/index.html', 'zh-CN', 'assets/popup-zh-CN.png', homepage],
  ['landing/en/index.html', 'en-US', '../assets/popup-en-US.png', `${homepage}en/`],
]) {
  let html = await readFile(resolve(root, path), 'utf8');
  html = html.replace(/http:\/\/video-tracker\.ankkaya\.top\//g, homepage);
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${home}">`);
  html = html.replace(/<link rel="alternate" hreflang="zh-CN"[^>]*>/, `<link rel="alternate" hreflang="zh-CN" href="${homepage}">`);
  html = html.replace(/<link rel="alternate" hreflang="en"[^>]*>/, `<link rel="alternate" hreflang="en" href="${homepage}en/">`);
  if (!html.includes('preview.css')) html = html.replace(/(<link rel="stylesheet" href="(?:\.\.\/)?style.css">)/, `$1\n  <link rel="stylesheet" href="${locale === 'zh-CN' ? '' : '../'}preview.css">`);
  const description = locale === 'zh-CN'
    ? '保存和恢复跨网站视频观看进度。默认本地存储，无需账号；可选加密云同步，支持站点排除和插件内问题反馈。'
    : 'Save and resume video progress across sites. Local by default, with optional encrypted sync, site exclusions and in-extension feedback.';
  html = html.replace(/(<meta (?:name="(?:description|twitter:description)"|property="og:description") content=")[^"]*(">)/g, `$1${description}$2`);
  const preview = `      <div class="hero-visual">\n        <figure class="product-preview"><img src="${asset}" width="380" alt="${locale === 'zh-CN' ? 'VideoTracker 当前弹窗：搜索、观看进度与反馈入口' : 'Current VideoTracker popup with search, watch progress and feedback'}"><figcaption>${locale === 'zh-CN' ? '当前真实界面 · 虚构示例记录' : 'Current interface · Fictional sample records'}</figcaption></figure>\n      </div>\n    </div>\n  </section>\n\n`;
  html = html.replace(/      <div class="hero-visual">[\s\S]*?(?=  <!-- Features -->)/, preview);
  await writeFile(resolve(root, path), html, 'utf8');
}
console.log('Updated website metadata and bilingual actual-interface previews.');
