import type { VideoInfo } from '../../shared/types';
import type { VideoAdapter } from './types';

/** 腾讯视频适配器 */
export const vqqAdapter: VideoAdapter = {
  platform: 'vqq',
  platformName: '腾讯视频',

  detect(): boolean {
    return location.hostname.includes('v.qq.com');
  },

  extract(): VideoInfo | null {
    const video = this.getVideoElement();
    if (!video) return null;

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
    // 方式1：标准方式
    const video = document.querySelector('video');
    if (video) return video;

    // 方式2：querySelectorAll
    const videos = document.querySelectorAll('video');
    if (videos.length > 0) return videos[0];

    // 方式3：查找 iframe 内的 video（腾讯视频常用 iframe 播放器）
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeVideo = iframeDoc.querySelector('video');
          if (iframeVideo) return iframeVideo;
        }
      } catch {
        // 跨域限制，静默忽略
      }
    }

    return null;
  },

  buildResumeUrl(url: string, currentTime: number): string {
    const u = new URL(url);
    u.searchParams.set('start', Math.floor(currentTime).toString());
    return u.toString();
  },
};
