import { describe, expect, it } from 'vitest';
import { buildRecordResumeUrl, parseResumeTimeFromUrl, parseTimeValue } from '../src/shared/resume';

describe('resume helpers', () => {
  it('builds a YouTube resume URL with t and removes old start', () => {
    const url = buildRecordResumeUrl({
      url: 'https://www.youtube.com/watch?v=abc&start=10',
      platform: 'youtube',
      currentTime: 95.9,
    });

    expect(url).toBe('https://www.youtube.com/watch?v=abc&t=95');
  });

  it('builds a Tencent Video resume URL with start', () => {
    const url = buildRecordResumeUrl({
      url: 'https://v.qq.com/x/cover/abc.html?t=10',
      platform: 'vqq',
      currentTime: 120,
    });

    expect(url).toBe('https://v.qq.com/x/cover/abc.html?start=120');
  });

  it('returns the cleaned URL when currentTime is zero', () => {
    const url = buildRecordResumeUrl({
      url: 'https://www.bilibili.com/video/BV1?t=10',
      platform: 'bilibili',
      currentTime: 0,
    });

    expect(url).toBe('https://www.bilibili.com/video/BV1');
  });

  it('parses numeric and h/m/s resume time values', () => {
    expect(parseTimeValue('90')).toBe(90);
    expect(parseTimeValue('1m30s')).toBe(90);
    expect(parseTimeValue('1h02m03s')).toBe(3723);
  });

  it('parses resume time from URL query params', () => {
    expect(parseResumeTimeFromUrl('https://example.com/watch?t=88')).toBe(88);
    expect(parseResumeTimeFromUrl('https://example.com/watch?start=77')).toBe(77);
    expect(parseResumeTimeFromUrl('https://example.com/watch')).toBeNull();
  });
});
