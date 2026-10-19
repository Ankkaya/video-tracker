import { describe, expect, it, vi } from 'vitest';
import { isPlaybackPage } from '../src/shared/playbackPage';
import { bilibiliAdapter } from '../src/content/adapters/bilibili';
import { youtubeAdapter } from '../src/content/adapters/youtube';
import { iqiyiAdapter } from '../src/content/adapters/iqiyi';
import { vqqAdapter } from '../src/content/adapters/vqq';
import { genericAdapter } from '../src/content/adapters/generic';

const blocked = [
  'https://www.bilibili.com/?vt_record=1792396776103_o3iosn',
  'https://search.bilibili.com/all?keyword=test',
  'https://www.bilibili.com/v/popular/all',
  'https://www.youtube.com/',
  'https://www.youtube.com/results?search_query=test&v=abc',
  'https://www.youtube.com/feed/subscriptions',
  'https://www.youtube.com/watch',
  'https://www.youtube.com/playlist?list=abc',
  'https://www.youtube.com/embed/videoseries?list=abc',
  'https://www.iqiyi.com/',
  'https://so.iqiyi.com/so/q_test?tvid=123',
  'https://www.iqiyi.com/a_123.html',
  'https://v.qq.com/',
  'https://v.qq.com/x/search/?q=test&vid=123',
  'https://v.qq.com/channel/tv',
];
const allowed = [
  'https://www.bilibili.com/video/BV1xx411c7mD?p=2',
  'https://www.bilibili.com/video/av123/',
  'https://www.bilibili.com/bangumi/play/ep123',
  'https://www.bilibili.com/bangumi/play/ss123',
  'https://player.bilibili.com/player.html?bvid=BV1xx411c7mD',
  'https://www.youtube.com/watch?v=abc123',
  'https://youtu.be/abc123?t=10',
  'https://www.youtube.com/shorts/abc123',
  'https://www.youtube.com/live/abc123',
  'https://www.youtube-nocookie.com/embed/abc123',
  'https://www.iqiyi.com/v_123.html',
  'https://www.iqiyi.com/w_123.html',
  'https://v.qq.com/x/cover/abc/xyz.html',
  'https://v.qq.com/x/cover/abc.html',
  'https://v.qq.com/x/page/xyz.html',
  'https://v.qq.com/iframe/player.html?vid=xyz',
  'https://example.com/',
  'https://example.com/custom/watch',
];
describe('playback page filtering', () => {
  it.each(blocked)('rejects preview page %s', url => expect(isPlaybackPage(url)).toBe(false));
  it.each(allowed)('preserves playback or generic page %s', url => expect(isPlaybackPage(url)).toBe(true));
  it.each(blocked)('cannot bypass filtering with a generic adapter: %s', url => {
    const original = Object.getOwnPropertyDescriptor(window, 'location')!;
    Object.defineProperty(window, 'location', { configurable: true, value: new URL(url) });
    document.title = 'Preview';
    document.body.innerHTML = '<video></video>';
    Object.defineProperty(document.querySelector('video'), 'duration', { value: 100 });
    try {
      for (const adapter of [bilibiliAdapter, youtubeAdapter, iqiyiAdapter, vqqAdapter, genericAdapter]) {
        expect(adapter.extract()).toBeNull();
      }
    } finally {
      Object.defineProperty(window, 'location', original);
      document.body.innerHTML = '';
      document.title = '';
      vi.restoreAllMocks();
    }
  });
});
