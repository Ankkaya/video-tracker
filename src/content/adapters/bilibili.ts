import { createVideoAdapter } from './shared';

/** B站适配器 */
export const bilibiliAdapter = createVideoAdapter({
  platform: 'bilibili',
  platformName: 'B站',

  detect(): boolean {
    return location.hostname.includes('bilibili.com');
  },

  metadata() {
    // 标题
    const titleEl =
      document.querySelector('.video-title') ||
      document.querySelector('h1.video-title') ||
      document.querySelector('[class*="video-title"]');
    const title = titleEl?.textContent?.trim() ?? document.title.replace(/_哔哩哔哩.*$/, '').trim();
    if (!title) return null;

    // 系列名（分P标题或合集）
    const seriesEl = document.querySelector('.video-section-list .active') ||
      document.querySelector('[class*="episode-item"][class*="active"]');
    const seriesName = seriesEl?.textContent?.trim() || title;

    // 集数：从URL提取 ?p=N
    const params = new URLSearchParams(location.search);
    const pageNum = params.get('p') || '1';
    const episode = pageNum !== '1' ? `P${pageNum}` : '正片';

    return {
      url: location.href,
      title,
      episode,
      seriesName,
      thumbnail: (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content,
    };
  },
});
