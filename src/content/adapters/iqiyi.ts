import { createVideoAdapter } from './shared';

/** 爱奇艺适配器 */
export const iqiyiAdapter = createVideoAdapter({
  platform: 'iqiyi',
  platformName: '爱奇艺',

  detect(): boolean {
    return location.hostname.includes('iqiyi.com');
  },

  metadata() {

    // 标题
    const titleEl =
      document.querySelector('.videoTitle a') ||
      document.querySelector('[class*="video-title"]') ||
      document.querySelector('h1');
    const title = titleEl?.textContent?.trim() ?? document.title.replace(/-.*爱奇艺.*$/, '').trim();
    if (!title) return null;

    // 集数
    const episodeEl =
      document.querySelector('.episodeList .active') ||
      document.querySelector('[class*="episode"][class*="active"]');
    const episode = episodeEl?.textContent?.trim() || '正片';

    return {
      url: location.href,
      title,
      episode,
    };
  },
});
