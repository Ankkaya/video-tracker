import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = await readFile(resolve(root, 'PRIVACY_POLICY.md'), 'utf8');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const inline = text => escape(text).replace(/https:\/\/[^\s)]+/g, url => `<a href="${url}">${url}</a>`);
const paragraphs = source.split(/\r?\n\s*\r?\n/).map(block => {
  const match = /^(#{1,3})\s+([^\r\n]+)(?:\r?\n([\s\S]*))?$/.exec(block);
  if (!match) return `<p>${inline(block.replace(/\r?\n/g, ' '))}</p>`;
  const level = match[1].length;
  return `<h${level}>${inline(match[2])}</h${level}>${match[3] ? `<p>${inline(match[3].replace(/\r?\n/g, ' '))}</p>` : ''}`;
}).join('\n');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VideoTracker Privacy Policy</title><style>body{max-width:850px;margin:40px auto;padding:0 24px;font:16px/1.7 system-ui;color:#243047}h1,h2,h3{line-height:1.3}h2{margin-top:48px}a{color:#245acc;overflow-wrap:anywhere}@media(prefers-color-scheme:dark){body{background:#181824;color:#eeeef6}a{color:#a6b4ff}}</style></head><body><main>${paragraphs}</main></body></html>\n`;
for (const path of ['privacy-policy.html', 'landing/privacy-policy.html', 'public/privacy-policy.html']) await writeFile(resolve(root, path), html);
console.log('Updated packaged and website privacy policies.');
