import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
const markdown = (await readFile(resolve(root, 'docs/STORE_LISTING.md'), 'utf8')).replace(/\r\n/g, '\n');
const date = markdown.match(/更新日期：(\d{4}-\d{2}-\d{2})/)?.[1];
if (!date) throw new Error('Missing materials update date');
const homepage = 'https://video-tracker.ankkaya.top/';
const privacyPolicy = `${homepage}privacy-policy.html`;
const support = 'https://github.com/Ankkaya/video-tracker/issues';
let localPackage;
try {
  const filename = `video-tracker-${version}-chrome-mv3.zip`;
  const receipt = JSON.parse(await readFile(resolve(root, 'releases', filename.replace(/\.zip$/, '.json')), 'utf8'));
  const archive = await readFile(resolve(root, 'releases', filename));
  if (receipt.materialsDate === date && receipt.version === version && receipt.sha256 === createHash('sha256').update(archive).digest('hex')) localPackage = receipt;
} catch { /* Materials can be prepared before building a release package. */ }
const screenshotNames = ['01-records', '02-settings', '03-sites', '04-popup', '05-feedback'];
function section(title) {
  const start = markdown.indexOf(`## ${title}\n`);
  if (start < 0) throw new Error(`Missing section: ${title}`);
  const body = markdown.slice(start + title.length + 4);
  return body.slice(0, body.indexOf('\n## ') < 0 ? undefined : body.indexOf('\n## ')).trim();
}
const descriptions = { 'zh-CN': section('详细描述（中文）'), 'en-US': section('Detailed description (English)') };
const releaseNotes = {
  'zh-CN': `当前源码 ${version} 更新说明（${date}）\n${section(`当前源码更新说明（${version}）`).replace(/^- /gm, '• ')}\n`,
  'en-US': `Current source ${version} update notes (${date})\n${section('Current source update notes (English)').replace(/^- /gm, '• ')}\n`,
};
const captions = {
  'zh-CN': ['切换观看中与已看完，按标题、分集和日期筛选，支持标记完成与批量删除。虚构示例记录。', '自动记录默认关闭，可设置最低观看时长；本地记录无需账号，云同步需登录后主动选择。截图展示开启后的状态。', '域名或网页链接加入排除名单，停止该域名及子域名自动新增；移出恢复，已有记录继续跟踪。', '工具栏聚焦未看完的视频，按标题搜索并继续观看。示例记录。', '反馈最多 500 字，可附一张不超过 5 MB 的 PNG/JPG/WebP 图片及邮箱。首次提交前确认用途；此截图不发送反馈。'],
  'en-US': ['Switch Watching / Completed, search titles and episodes, filter dates, mark completion and delete selected records. Fictional sample records.', 'Automatic recording is off by default. Choose a viewing threshold; local recording needs no account and optional sync requires sign-in. Enabled state shown.', 'Exclude a domain or webpage URL and its subdomains from new automatic records. Saved records continue tracking; manual saving still works.', 'Focus on unfinished videos in the toolbar, search titles and resume watching. Sample records shown.', 'Send up to 500 characters, one optional PNG/JPG/WebP image up to 5 MB and optional email. First-submission consent required; this screenshot sends no feedback.'],
};
const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const write = (path, value) => writeFile(resolve(root, path), value, 'utf8');
const json = (path, value) => write(path, `${JSON.stringify(value, null, 2)}\n`);
for (const store of ['chrome-store', 'edge-store']) {
  const base = `output/${store}`;
  const listings = [];
  for (const locale of ['zh-CN', 'en-US']) {
    const zh = locale === 'zh-CN';
    await mkdir(resolve(root, base, locale), { recursive: true });
    const messages = JSON.parse(await readFile(resolve(root, 'public/_locales', zh ? 'zh_CN' : 'en_US', 'messages.json'), 'utf8'));
    const listing = {
      locale, name: messages.extensionName.message, shortDescription: messages.extensionDescription.message,
      description: descriptions[locale], searchTerms: zh ? ['视频观看进度', '视频记录', '断点续播', 'B站', 'YouTube', '加密同步', 'video tracker'] : ['video progress', 'watch history', 'resume video', 'Bilibili', 'YouTube', 'encrypted sync', 'video tracker'],
      captions: captions[locale], screenshots: screenshotNames.map(name => `${name}-1280x800.${store === 'chrome-store' ? 'jpg' : 'png'}`),
      version, updatedAt: date, materialStatus: 'repository_only_not_uploaded', homepage, privacyPolicy, support,
      releaseNotes: releaseNotes[locale].trim(),
    };
    if (listing.searchTerms.length > 7 || listing.shortDescription.length > 132) throw new Error('Store field limits exceeded');
    await json(`${base}/${locale}/listing.json`, listing);
    await write(`${base}/${locale}/description.txt`, `${listing.description}\n`);
    await write(`${base}/${locale}/release-notes.txt`, releaseNotes[locale]);
    listings.push(listing);
  }
  const deliveryPath = `${base}/delivery.json`;
  let previous;
  try { previous = JSON.parse(await readFile(resolve(root, deliveryPath), 'utf8')); } catch {}
  if (previous && previous.status !== 'repository_materials_updated_not_uploaded') {
    await mkdir(resolve(root, base, 'archive'), { recursive: true });
    const historicalPath = `${base}/archive/delivery-before-${date}.json`;
    try { await access(resolve(root, historicalPath)); } catch { await json(historicalPath, previous); }
  }
  await json(deliveryPath, {
    version, date, status: 'repository_materials_updated_not_uploaded', locales: ['zh-CN', 'en-US'], screenshotsPerLocale: 5,
    screenshotOrder: listings[0].screenshots, screenshotSource: 'Current Vue components with fictional records and excluded example.com; isolated preview without cloud access. Feedback screenshot sends no request.',
    homepage, privacyPolicy, support, preview: 'index.html',
    packageStatus: localPackage ? 'Latest version built locally; not uploaded to either store or published as a GitHub Release.' : 'No verified package receipt for this version; build a matching package before submission.',
    ...(localPackage ? { package: `releases/${localPackage.filename}`, sha256: localPackage.sha256, bytes: localPackage.bytes } : {}),
    historicalDelivery: `archive/delivery-before-${date}.json`,
    pending: [...(localPackage ? [] : ['Build a package containing the described features and use an acceptable new version when updating an existing store package.']), 'Verify authentication and sync with the formal extension ID.', 'Upload localized descriptions, screenshots and updated privacy disclosures when authorized.', 'Submit for store review when authorized.'],
  });
  const gallery = listings.map(listing => `<section><h2>${escape(listing.locale)} · ${escape(listing.name)}</h2><p>${escape(listing.shortDescription)}</p><textarea readonly aria-label="${escape(listing.locale)} description">${escape(listing.description)}</textarea><pre>${escape(listing.releaseNotes)}</pre><div class="shots">${listing.screenshots.map((name, i) => `<figure><a href="${listing.locale}/${name}"><img loading="lazy" src="${listing.locale}/${name}" alt="${escape(listing.captions[i])}"></a><figcaption>${escape(listing.captions[i])}</figcaption></figure>`).join('')}</div><p><a href="${listing.locale}/listing.json">全部字段</a> · <a href="${listing.locale}/description.txt">详情文本</a> · <a href="${listing.locale}/promo-small-440x280.png">440×280 宣传图</a> · <a href="${listing.locale}/promo-large-1400x560.png">1400×560 宣传图</a></p></section>`).join('');
  await write(`${base}/index.html`, `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VideoTracker ${version} · ${store}</title><style>body{max-width:1100px;margin:40px auto;padding:0 24px;font:16px/1.7 system-ui;color:#243047;background:#f7f8fb}section{background:white;padding:24px;margin:24px 0;border-radius:16px}img{max-width:100%;border:1px solid #ddd;border-radius:8px}textarea{width:100%;box-sizing:border-box;height:260px;font:14px/1.6 system-ui}a{color:#245acc}.shots{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}pre{white-space:pre-wrap}.status{padding:16px;background:#fff2d6}@media(max-width:650px){.shots{grid-template-columns:1fr}}</style></head><body><h1>VideoTracker ${version} · ${store}</h1><p class="status">资料更新：${date}。仅同步仓库，未上传商店、未提交审核。以下功能基于当前源码，提交前需构建匹配的安装包。</p><p><a href="README.md">使用说明</a> · <a href="../../docs/STORE_LISTING.md">统一文案与审核说明</a> · <a href="delivery.json">资料状态</a> · <a href="${privacyPolicy}">完整隐私政策</a></p>${gallery}</body></html>\n`);
  await write(`${base}/README.md`, `# ${store === 'chrome-store' ? 'Chrome Web Store' : 'Edge Add-ons'} 资料\n\n适用当前源码：${version}。更新日期：${date}。仅更新仓库，未上传或提交审核。旧上传记录保留在 archive/delivery-before-${date}.json，历史状态不代表本次资料已上传。请使用与当前素材一致的版本安装包。\n\n- 中英文名称、短描述、详情、截图说明与更新内容：各语言目录的 listing.json、description.txt、release-notes.txt。\n- 每种语言 5 张 1280×800 ${store === 'chrome-store' ? 'JPG' : '无损 PNG'}：记录、设置、站点排除、弹窗、反馈。来自当前真实 Vue 组件和虚构数据，无真实账号，反馈预览不发送请求。\n- 宣传图：每种语言 440×280 和 1400×560；使用当前功能文案。\n- 官网：${homepage}\n- 隐私政策：${privacyPolicy}\n- 支持：${support}\n- 统一权限说明与审核步骤：../../docs/STORE_LISTING.md；Edge 专用说明：../../docs/edge-certification-notes.md。\n\n更新统一文案后运行 npm run generate:store。宣传图运行 node scripts/store-preview/capture-promos.mjs；截图可运行 node scripts/store-preview/capture-assets.js（需先启动该目录的 Vite 预览配置）。\n\n发布前构建包含当前源码功能的安装包，更新既有商店包时使用商店接受的新版本号；核对正式扩展 ID 的认证回调并验证登录、同步与反馈。审核账号只填私密字段。填写最新数据披露、上传中英文素材后再按授权提交审核。本次没有更新安装包、操作商店后台或提交审核。\n`);
  if (localPackage) {
    const readme = await readFile(resolve(root, base, 'README.md'), 'utf8');
    await write(`${base}/README.md`, readme.replace('本次没有更新安装包、操作商店后台或提交审核。', `本地已构建 ${localPackage.filename}，SHA-256 见 delivery.json；未上传商店或提交审核。`));
    const preview = await readFile(resolve(root, base, 'index.html'), 'utf8');
    await write(`${base}/index.html`, preview.replace('以下功能基于当前源码，提交前需构建匹配的安装包。', `匹配的 ${version} 安装包已在本地构建，文件及校验值见 delivery.json。`));
  }
  const edgeReviewerNotes = await readFile(resolve(root, 'docs/edge-certification-notes.md'), 'utf8');
  const notes = edgeReviewerNotes.match(/```text\r?\n([\s\S]*?)\r?\n```/)?.[1];
  if (!notes) throw new Error('Missing reviewer notes');
  await write(`${base}/reviewer-notes.txt`, `${notes}\n`);
}
await json('output/chrome-store/privacy-form.json', {
  version, updatedAt: date, extensionId: 'khcbepelehjlhplgepkmapfhcjimgedf',
  purpose: '保存和恢复跨网站视频观看进度，可选端到端加密同步及与该用途相关的主动问题反馈。', remoteCode: false, privacyPolicy,
  selectedDataCategories: {
    '个人身份信息': '主动登录的邮箱及账号标识；主动反馈时可选的联系邮箱，登录邮箱仅预填且可删除。',
    '身份验证信息': '登录凭据、授权及会话令牌；反馈不自动附带密码或令牌。',
    '位置': '认证、同步、反馈和图片请求的 IP 连接信息；反馈限流存储加盐 IP 哈希，不采集 GPS。',
    '网络记录': '视频网址、标题及观看时间；不是全部浏览历史。',
    '用户活动': '视频播放位置、时长及观看进度；不记录通用鼠标或键盘日志。',
    '网站内容': '视频标题、链接、封面网址，以及用户主动提交的反馈文字和图片（图片可能含原始元数据）。',
    '个人通讯': '用户主动向开发者发送的支持反馈文字、图片及可选邮箱，仅用于排查与回复。',
  },
  unselectedDataCategories: ['健康信息', '财务和付款信息'],
  feedback: { consent: '首次提交前确认用途，取消不发送。', limits: '500 字；1 张 PNG/JPG/WebP，最大 5 MB。', storage: 'Supabase 私有图片存储；反馈可由开发者阅读，独立于端到端加密同步。', metadata: '加盐 IP 哈希、随机请求编号、内容哈希和处理时间状态。', deletion: '联系开发者，提供提交时间、内容或邮箱协助定位；不在公开 issue 发布私人资料。' },
  limitedUse: { noSaleOrUnapprovedTransfer: true, noUnrelatedUse: true, noCreditOrLendingUse: true },
  sources: ['PRIVACY_POLICY.md', 'docs/STORE_LISTING.md', 'https://developer.chrome.com/docs/webstore/cws-dashboard-privacy', 'https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements'],
  dashboardStatus: 'Repository reference only; actual dashboard selections unchanged. Confirm category definitions at submission.',
});
// Historical receipts do not mark regenerated source materials as uploaded.
let publication;
try { publication = JSON.parse(await readFile(resolve(root, 'releases', `PUBLISH_STATUS_${version}.json`), 'utf8')); } catch {}
for (const store of ['chrome-store', 'edge-store']) {
  const base = `output/${store}`;
  let submission;
  try { submission = JSON.parse(await readFile(resolve(root, base, 'submission-status.json'), 'utf8')); } catch {}
  const delivery = JSON.parse(await readFile(resolve(root, base, 'delivery.json'), 'utf8'));
  delivery.sourceScope = `Version ${version} source and materials dated ${date}. Store submission status is separate from GitHub publication.`;
  if (publication?.version === version) {
    delivery.release = publication.release;
    delivery.packageStatus = 'Published as a GitHub Release; not uploaded to either extension store by this workflow.';
  }
  if (submission?.version === version && submission.date === date && submission.descriptionsSaved) {
    delivery.status = submission.status;
    delivery.submission = submission;
    delivery.pending = submission.submittedForReview ? ['Await store review result.'] : ['Submit the saved materials for review.'];
    for (const locale of ['zh-CN', 'en-US']) {
      const listingPath = `${base}/${locale}/listing.json`;
      const listing = JSON.parse(await readFile(resolve(root, listingPath), 'utf8'));
      listing.materialStatus = 'saved_to_dashboard';
      listing.dashboardStatus = submission.status;
      await json(listingPath, listing);
    }
    const stateText = `${version} 中英文资料和安装包已提交商店审核，后台状态为 ${submission.dashboardStatus}；线上仍为 ${submission.liveVersionAtSubmission}，待审核通过。`;
    const readme = await readFile(resolve(root, base, 'README.md'), 'utf8');
    await write(`${base}/README.md`, readme.replace('仅更新仓库，未上传或提交审核。', stateText).replace('未上传商店或提交审核。', stateText));
    const preview = await readFile(resolve(root, base, 'index.html'), 'utf8');
    await write(`${base}/index.html`, preview.replace('仅同步仓库，未上传商店、未提交审核。', escape(stateText)));
  } else if (submission) delivery.historicalSubmission = submission;
  await json(`${base}/delivery.json`, delivery);
}
console.log(`Generated source materials dated ${date}; historical publication receipts preserved separately. No dashboard actions performed.`);
