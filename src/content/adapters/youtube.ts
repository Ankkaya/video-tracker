import { createVideoAdapter } from './shared';

/** YouTube 适配器 */
export const youtubeAdapter = createVideoAdapter({
  platform: 'youtube',
  platformName: 'YouTube',

  detect(): boolean {
    return location.hostname.includes('youtube.com') || location.hostname === 'youtu.be';
  },

  metadata() {

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
      url: location.href,
      title,
      episode,
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : undefined,
    };
  },

  preferredVideoSelector: 'video.html5-main-video',
});
