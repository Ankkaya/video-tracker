import { siteBrands } from '../../src/shared/siteBrand';
import type { WatchRecord } from '../../src/shared/types';

/** UI-only fixtures; these are never loaded by extension entrypoints. */
export function createSiteIconSamples(now: number, zh: boolean): WatchRecord[] {
  const records: WatchRecord[] = siteBrands.map((site, index) => {
    const duration = 600 + index * 120;
    const currentTime = Math.round(duration * (0.15 + index % 5 * 0.12));
    return {
      id: `icon-preview-${site.id}`,
      platform: 'generic',
      platformName: site.name,
      title: zh ? `${site.name}｜视频网站图标核对 · 示例记录` : `${site.name} | Video site icon preview`,
      url: `https://${site.domains[0]}/watch/icon-preview`,
      episode: `${site.domains[0]} · ${zh ? '临时测试数据' : 'Temporary sample'}`,
      currentTime, duration, progress: currentTime / duration,
      lastWatchedAt: now - (index + 1) * 60000, createdAt: now,
    };
  });
  records.push({
    id: 'icon-preview-unknown', platform: 'generic', platformName: zh ? '未匹配网站' : 'Unknown website',
    title: zh ? '未匹配网站｜通用图标回退效果' : 'Unknown website | Fallback icon',
    url: 'https://video.example.org/watch/icon-preview', episode: `video.example.org · ${zh ? '临时测试数据' : 'Temporary sample'}`,
    currentTime: 60, duration: 600, progress: 0.1, lastWatchedAt: now - 18 * 60000, createdAt: now,
  });
  return records;
}

export function showSiteIconPreviewNotice(zh: boolean) {
  document.title = zh ? '视频网站图标核对 · 临时预览' : 'Video site icons · Temporary preview';
  document.documentElement.style.overflowY = 'auto';
  const notice = document.createElement('aside');
  notice.className = 'site-icon-preview-notice';
  notice.innerHTML = `
    <div class="site-icon-preview-heading">
      <div><strong>${zh ? '临时图标测试 · 17 个网站 + 1 个通用图标' : 'Temporary icon preview · 17 sites + 1 fallback'}</strong>
      <p>${zh ? '下方使用当前内置图标。仅预览数据，刷新后重置，不影响真实观看记录。' : 'Current packaged icons below. Preview data resets on reload and does not affect your saved records.'}</p></div>
      <a href="?view=records&lang=${zh ? 'zh-CN' : 'en-US'}">${zh ? '退出测试预览' : 'Exit preview'}</a>
    </div>
    <div class="site-icon-comparison">
      <span><img src="/site-icons/bilibili.svg" alt="" /><span>${zh ? 'B站：旧版图标（已停用）' : 'Bilibili: previous icon (replaced)'}<small>Simple Icons</small></span></span>
      <span><img src="/site-icons/bilibili.ico" alt="" /><span>${zh ? 'B站：官网蓝色图标（已采用）' : 'Bilibili: official blue icon (active)'}<small>www.bilibili.com/favicon.ico</small></span></span>
    </div>`;
  document.querySelector('.page-content')?.prepend(notice);
}
