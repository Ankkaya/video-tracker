import { createVideoAdapter } from './shared';

/** 腾讯视频适配器 */
export const vqqAdapter = createVideoAdapter({
  platform: 'vqq',
  platformName: '腾讯视频',

  detect(): boolean {
    return location.hostname.includes('v.qq.com');
  },

  metadata() {

    // 标题
    const titleEl =
      document.querySelector('.video_title_cn a') ||
      document.querySelector('.site_player_site_txt') ||
      document.querySelector('h1');
    const title = titleEl?.textContent?.trim() ?? document.title.replace(/-.*腾讯视频.*$/, '').trim();
    if (!title) return null;

    // 集数
    const episodeEl =
      document.querySelector('.episode_list .current') ||
      document.querySelector('[class*="episode"][class*="active"]');
    const episode = episodeEl?.textContent?.trim() || '正片';

    return {
      url: location.href,
      title,
      episode,
    };
  },

  resumeParam: 'start',
});
