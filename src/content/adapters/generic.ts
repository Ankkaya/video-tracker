import type { VideoInfo } from '../../shared/types';
import type { VideoAdapter } from './types';
import { findVideoElements, pickBestVideo } from '../videoProbe';

/**
 * 通用适配器
 * 用于自定义站点（非内置平台）
 * 依赖通用 DOM API，无需专有选择器
 */
export const genericAdapter: VideoAdapter = {
  platform: 'generic',
  platformName: '通用',

  detect(): boolean {
    // 通用适配器不通过域名判断，由外部逻辑决定是否使用
    return true;
  },

  extract(): VideoInfo | null {
    const video = this.getVideoElement();
    if (!video) return null;

    const isInIframe = window !== window.top;

    // 标题：优先使用当前 document.title，iframe 中可能为空则回退
    let title = document.title?.trim() || '';
    if (!title || title === 'about:blank') {
      title = '未命名视频';
    }

    // URL：iframe 中使用 referrer（即顶层页面 URL），否则使用当前页面 URL
    let currentUrl: string;
    if (isInIframe && document.referrer) {
      try {
        const u = new URL(document.referrer);
        currentUrl = u.origin + u.pathname + u.search;
      } catch {
        currentUrl = location.origin + location.pathname + location.search;
      }
    } else {
      currentUrl = location.origin + location.pathname + location.search;
    }

    return {
      url: currentUrl,
      title,
      episode: '正片',
      platform: this.platform,
      platformName: this.platformName,
      currentTime: video.currentTime,
      duration: video.duration || 0,
    };
  },

  getVideoElement(): HTMLVideoElement | null {
    // 方式1：标准方式 + open shadow DOM
    const video = pickBestVideo(findVideoElements());
    if (video) return video;

    // 方式2：查找 player 容器内的 video
    const playerContainer = document.querySelector(
      '[data-video], [data-player], .player, .video-player, #player, #video-player, .artplayer-app, .art-video-player'
    );
    if (playerContainer) {
      const playerVideo = playerContainer.querySelector('video');
      if (playerVideo) return playerVideo;
    }

    // 方式3：查找同源 iframe 内的 video（跨域 iframe 由 allFrames 处理）
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeVideo = iframeDoc.querySelector('video');
          if (iframeVideo) return iframeVideo;
        }
      } catch {
        // 跨域限制，由 allFrames content script 在 iframe 内部处理
      }
    }

    return null;
  },

  buildResumeUrl(url: string, currentTime: number): string {
    try {
      const u = new URL(url, location.origin);
      u.searchParams.set('t', Math.floor(currentTime).toString());
      return u.toString();
    } catch {
      return url;
    }
  },
};
