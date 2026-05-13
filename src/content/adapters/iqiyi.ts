import type { VideoInfo } from '../../shared/types';
import type { VideoAdapter } from './types';

/** 爱奇艺适配器 */
export const iqiyiAdapter: VideoAdapter = {
  platform: 'iqiyi',
  platformName: '爱奇艺',

  detect(): boolean {
    return location.hostname.includes('iqiyi.com');
  },

  extract(): VideoInfo | null {
    const video = this.getVideoElement();
    if (!video) return null;

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
      url: location.href.split('?')[0],
      title,
      episode,
      platform: this.platform,
      platformName: this.platformName,
      currentTime: video.currentTime,
      duration: video.duration || 0,
    };
  },

  getVideoElement(): HTMLVideoElement | null {
    return document.querySelector('video');
  },

  buildResumeUrl(url: string, currentTime: number): string {
    const u = new URL(url);
    u.searchParams.set('t', Math.floor(currentTime).toString());
    return u.toString();
  },
};
