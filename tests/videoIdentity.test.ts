import { describe, expect, it } from 'vitest';
import { findVideoRecord, videoIdentity } from '../src/shared/videoIdentity';
import { buildRecordResumeUrl } from '../src/shared/resume';
import type { WatchRecord } from '../src/shared/types';

describe('video identity', () => {
  it('does not rewrite a foreign URL merely because an imported record has a platform label', () => {
    expect(videoIdentity({ platform: 'bilibili', url: 'https://example.com/video/0' }).url).toBe('https://example.com/video/0');
  });
  it('matches YouTube watch, short and embed URLs independently of timestamps and playlists', () => {
    const keys = [
      'https://www.youtube.com/watch?v=abc&t=20&list=playlist&index=2',
      'https://youtu.be/abc?si=tracking', 'https://www.youtube.com/embed/abc',
      'https://www.youtube.com/shorts/abc',
    ].map(url => videoIdentity({ url, platform: 'generic' }).key);
    expect(new Set(keys).size).toBe(1);
    expect(videoIdentity({ url: 'https://youtube.com/watch?v=other', platform: 'youtube' }).key).not.toBe(keys[0]);
  });

  it('distinguishes Bilibili parts and repairs legacy records with an episode but no p parameter', () => {
    const url = 'https://www.bilibili.com/video/BV123';
    const first = videoIdentity({ url, platform: 'bilibili' });
    const second = videoIdentity({ url: url + '?p=2&t=30&spm_id_from=abc', platform: 'bilibili' });
    expect(first.key).not.toBe(second.key);
    expect(videoIdentity({ url, episode: 'P2', platform: 'bilibili' })).toEqual(second);
    const replay = buildRecordResumeUrl({ id: 'old', url, episode: 'P2', platform: 'bilibili', currentTime: 30 });
    expect(new URL(replay).searchParams.get('p')).toBe('2');
    expect(new URL(replay).searchParams.get('vt_record')).toBe('old');
    expect(videoIdentity({ url: replay, platform: 'bilibili' }).key).toBe(second.key);
  });

  it('keeps content parameters and hash routes on generic websites', () => {
    const key = (url: string) => videoIdentity({ url, platform: 'generic' }).key;
    expect(key('https://example.com/watch?episode=2&t=40&utm_source=x')).toBe(key('https://example.com/watch?episode=2'));
    expect(key('https://example.com/watch?episode=2')).not.toBe(key('https://example.com/watch?episode=3'));
    expect(key('https://example.com/#/watch/2')).not.toBe(key('https://example.com/#/watch/3'));
  });

  it('matches individual Tencent and iQIYI videos across page variants', () => {
    expect(videoIdentity({ platform: 'vqq', url: 'https://v.qq.com/x/page/video123.html' }).key)
      .toBe(videoIdentity({ platform: 'vqq', url: 'https://v.qq.com/x/cover/series/video123.html?start=20' }).key);
    expect(videoIdentity({ platform: 'iqiyi', url: 'https://www.iqiyi.com/v_abc.html?t=10' }).key)
      .toBe(videoIdentity({ platform: 'iqiyi', url: 'https://m.iqiyi.com/v_abc.html' }).key);
  });

  it('does not match a different video on the same generic page', () => {
    const record = { id: 'a', url: 'https://example.com/watch', platform: 'generic', mediaId: 'one', title: 'A', duration: 100 } as WatchRecord;
    expect(findVideoRecord([record], { ...record, mediaId: 'two' })).toBeUndefined();
    expect(findVideoRecord([record], record)).toBe(record);
    const legacy = { ...record, mediaId: undefined };
    expect(findVideoRecord([legacy], record)).toBe(legacy);
    expect(findVideoRecord([legacy], { ...record, title: 'B', duration: 200 })).toBeUndefined();
  });
});
