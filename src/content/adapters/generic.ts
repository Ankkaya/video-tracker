import { createVideoAdapter } from './shared';
import { videoMediaId } from '../../shared/videoIdentity';

/** Fallback metadata for sites without dedicated rules; frame selection stays external. */
export const genericAdapter = createVideoAdapter({
  platform: 'generic',
  platformName: '通用',
  detect: () => true,
  metadata(video) {
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
        currentUrl = u.href;
      } catch {
        currentUrl = location.href;
      }
    } else {
      currentUrl = location.href;
    }

    return {
      mediaId: videoMediaId(video),
      url: currentUrl,
      title,
      episode: '正片',
      platformName: location.hostname,
    };
  },
});
