import { mkdir, writeFile } from 'node:fs/promises';

// Run only when updating packaged assets. The extension has no runtime CDN dependency.
const directory = new URL('../public/site-icons/', import.meta.url);
await mkdir(directory, { recursive: true });
const version = '13.21.0';
const slugs = ['youtube', 'netflix', 'twitch', 'vimeo', 'dailymotion', 'niconico', 'primevideo', 'crunchyroll', 'tiktok', 'kuaishou', 'kick', 'rumble', 'ted'];
const metadata = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@${version}/_data/simple-icons.json`).then(r => r.json());
const sources = slugs.map(slug => [slug, `https://cdn.jsdelivr.net/npm/simple-icons@${version}/icons/${slug}.svg`, 'svg']);
sources.push(['bilibili', 'https://www.bilibili.com/favicon.ico', 'ico'], ['iqiyi', 'https://www.iqiyi.com/favicon.ico', 'ico'], ['vqq', 'https://v.qq.com/favicon.ico', 'ico'], ['youku', 'https://www.youku.com/favicon.ico', 'ico']);
await Promise.all(sources.map(async ([id, url, extension]) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${id}: ${response.status}`);
  let bytes = Buffer.from(await response.arrayBuffer());
  if (extension === 'svg') {
    const brand = metadata.icons.find(icon => icon.title.toLowerCase().replace(/[^a-z0-9]/g, '') === id);
    if (!brand || !bytes.toString().includes('<svg')) throw new Error(`Invalid SVG: ${id}`);
    bytes = Buffer.from(bytes.toString().replace('<svg ', `<svg fill="#${brand.hex}" `));
  }
  await writeFile(new URL(`${id}.${extension}`, directory), bytes);
}));
await writeFile(new URL('SOURCES.txt', directory), `Brand icons identify the source of saved videos. Trademarks belong to their respective owners.\n\nSVG icons: Simple Icons ${version}, CC0-1.0\nhttps://github.com/simple-icons/simple-icons/tree/${version}\nhttps://github.com/simple-icons/simple-icons/blob/${version}/LICENSE.md\n\n${sources.map(([id, url]) => `${id}: ${url}`).join('\n')}\n`);
console.log(`Packaged ${sources.length} website icons.`);
