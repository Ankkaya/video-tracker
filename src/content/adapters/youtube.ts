import type { VideoInfo } from '../../shared/types';
import type { VideoAdapter } from './types';

/** YouTube 适配器 */
export const youtubeAdapter: VideoAdapter = {
  platform: 'youtube',
  platformName: 'YouTube',

  detect(): boolean {
    return location.hostname.includes('youtube.com') || location.hostname === 'youtu.be';
  },

  extract(): VideoInfo | null {
    const video = this.getVideoElement();
    if (!video) return null;

    // 标题
    const titleEl =
      document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
      document.querySelector('h1.title') ||
      document.querySelector('#title h1');
    const title = titleEl?.textContent?.trim() ?? document.title.replace(/ - YouTube$/, '').trim();
    if (!title) return null;

    // 集数：播放列表或单集
    const playlistEl = document.querySelector('yt-formatted-string.ytd-playlist-panel-renderer');
    const episode = playlistEl?.textContent?.trim() || '正片';

    const videoId = new URLSearchParams(location.search).get('v');
    return {
      url: location.href.split('&t=')[0].split('?t=')[0],
      title,
      episode,
      platform: this.platform,
      platformName: this.platformName,
      currentTime: video.currentTime,
      duration: video.duration || 0,
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : undefined,
    };
  },

  getVideoElement(): HTMLVideoElement | null {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  },

  buildResumeUrl(url: string, currentTime: number): string {
    const u = new URL(url);
    u.searchParams.set('t', Math.floor(currentTime).toString());
    u.searchParams.delete('start'); // 移除旧的 start 参数
    return u.toString();
  },
};
