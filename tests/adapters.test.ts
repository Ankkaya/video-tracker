import { describe, it, expect, beforeEach, vi } from 'vitest';

// ===== B站适配器测试 =====
describe('Bilibili Adapter', () => {
  beforeEach(() => {
    // 重置 location mock
    vi.restoreAllMocks();
  });

  it('detect: bilibili.com 域名匹配', async () => {
    const { bilibiliAdapter } = await import('../src/content/adapters/bilibili');
    // mock location
    const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'www.bilibili.com' },
      writable: true,
      configurable: true,
    });
    expect(bilibiliAdapter.detect()).toBe(true);
    // 恢复
    if (origDescriptor) Object.defineProperty(window, 'location', origDescriptor);
  });

  it('detect: 非 bilibili 域名不匹配', async () => {
    const { bilibiliAdapter } = await import('../src/content/adapters/bilibili');
    const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'www.youtube.com' },
      writable: true,
      configurable: true,
    });
    expect(bilibiliAdapter.detect()).toBe(false);
    if (origDescriptor) Object.defineProperty(window, 'location', origDescriptor);
  });

  it('extract: 无 video 元素时返回 null', async () => {
    const { bilibiliAdapter } = await import('../src/content/adapters/bilibili');
    document.body.innerHTML = '';
    const result = bilibiliAdapter.extract();
    expect(result).toBeNull();
  });

  it('extract: 有 video 元素时提取信息', async () => {
    const { bilibiliAdapter } = await import('../src/content/adapters/bilibili');
    // mock location
    const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        hostname: 'www.bilibili.com',
        href: 'https://www.bilibili.com/video/BV1xx411c7mD?p=2',
        search: '?p=2',
        origin: 'https://www.bilibili.com',
        pathname: '/video/BV1xx411c7mD',
      },
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = `
      <div class="video-title">测试B站视频标题</div>
      <video src="test.mp4"></video>
      <meta property="og:image" content="https://example.com/thumb.jpg" />
    `;

    // mock video 属性
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 120, writable: true });
    Object.defineProperty(video, 'duration', { value: 600, writable: true });

    const result = bilibiliAdapter.extract();
    expect(result).not.toBeNull();
    expect(result!.title).toBe('测试B站视频标题');
    expect(result!.platform).toBe('bilibili');
    expect(result!.platformName).toBe('B站');
    expect(result!.episode).toBe('P2');
    expect(result!.currentTime).toBe(120);
    expect(result!.duration).toBe(600);
    expect(result!.thumbnail).toBe('https://example.com/thumb.jpg');

    if (origDescriptor) Object.defineProperty(window, 'location', origDescriptor);
  });

  it('extract: p=1 时 episode 为"正片"', async () => {
    const { bilibiliAdapter } = await import('../src/content/adapters/bilibili');
    const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        hostname: 'www.bilibili.com',
        href: 'https://www.bilibili.com/video/BV1xx411c7mD',
        search: '',
        origin: 'https://www.bilibili.com',
        pathname: '/video/BV1xx411c7mD',
      },
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = `
      <h1 class="video-title">单P视频</h1>
      <video src="test.mp4"></video>
    `;
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 0, writable: true });
    Object.defineProperty(video, 'duration', { value: 100, writable: true });

    const result = bilibiliAdapter.extract();
    expect(result!.episode).toBe('正片');

    if (origDescriptor) Object.defineProperty(window, 'location', origDescriptor);
  });

  it('buildResumeUrl: 正确添加 t 参数', async () => {
    const { bilibiliAdapter } = await import('../src/content/adapters/bilibili');
    const url = bilibiliAdapter.buildResumeUrl('https://www.bilibili.com/video/BV1', 123.5);
    expect(url).toBe('https://www.bilibili.com/video/BV1?t=123');
  });

  it('getVideoElement: 返回页面中的 video 元素', async () => {
    const { bilibiliAdapter } = await import('../src/content/adapters/bilibili');
    document.body.innerHTML = '<video src="test.mp4"></video>';
    const video = bilibiliAdapter.getVideoElement();
    expect(video).not.toBeNull();
    expect(video!.tagName).toBe('VIDEO');
  });

  it('getVideoElement: 无 video 时返回 null', async () => {
    const { bilibiliAdapter } = await import('../src/content/adapters/bilibili');
    document.body.innerHTML = '';
    const video = bilibiliAdapter.getVideoElement();
    expect(video).toBeNull();
  });
});

// ===== YouTube 适配器测试 =====
describe('YouTube Adapter', () => {
  it('detect: youtube.com 域名匹配', async () => {
    const { youtubeAdapter } = await import('../src/content/adapters/youtube');
    const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'www.youtube.com' },
      writable: true,
      configurable: true,
    });
    expect(youtubeAdapter.detect()).toBe(true);
    if (origDescriptor) Object.defineProperty(window, 'location', origDescriptor);
  });

  it('detect: youtu.be 域名匹配', async () => {
    const { youtubeAdapter } = await import('../src/content/adapters/youtube');
    const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'youtu.be' },
      writable: true,
      configurable: true,
    });
    expect(youtubeAdapter.detect()).toBe(true);
    if (origDescriptor) Object.defineProperty(window, 'location', origDescriptor);
  });

  it('extract: 无 video 元素时返回 null', async () => {
    const { youtubeAdapter } = await import('../src/content/adapters/youtube');
    document.body.innerHTML = '';
    const result = youtubeAdapter.extract();
    expect(result).toBeNull();
  });

  it('extract: 有 video 元素时提取信息', async () => {
    const { youtubeAdapter } = await import('../src/content/adapters/youtube');
    const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        hostname: 'www.youtube.com',
        href: 'https://www.youtube.com/watch?v=abc123',
        search: '?v=abc123',
        origin: 'https://www.youtube.com',
        pathname: '/watch',
      },
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = `
      <h1 class="ytd-watch-metadata"><yt-formatted-string>YouTube 测试视频</yt-formatted-string></h1>
      <video class="html5-main-video" src="test.mp4"></video>
    `;
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 60, writable: true });
    Object.defineProperty(video, 'duration', { value: 300, writable: true });

    const result = youtubeAdapter.extract();
    expect(result).not.toBeNull();
    expect(result!.title).toBe('YouTube 测试视频');
    expect(result!.platform).toBe('youtube');
    expect(result!.platformName).toBe('YouTube');
    expect(result!.currentTime).toBe(60);
    expect(result!.thumbnail).toContain('abc123');

    if (origDescriptor) Object.defineProperty(window, 'location', origDescriptor);
  });

  it('buildResumeUrl: 正确设置 t 参数并移除 start', async () => {
    const { youtubeAdapter } = await import('../src/content/adapters/youtube');
    const url = youtubeAdapter.buildResumeUrl('https://www.youtube.com/watch?v=abc&start=100', 200);
    expect(url).toContain('t=200');
    expect(url).not.toContain('start=');
  });
});

// ===== 爱奇艺适配器测试 =====
describe('iQiyi Adapter', () => {
  it('detect: iqiyi.com 域名匹配', async () => {
    const { iqiyiAdapter } = await import('../src/content/adapters/iqiyi');
    const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'www.iqiyi.com' },
      writable: true,
      configurable: true,
    });
    expect(iqiyiAdapter.detect()).toBe(true);
    if (origDescriptor) Object.defineProperty(window, 'location', origDescriptor);
  });

  it('extract: 无 video 时返回 null', async () => {
    const { iqiyiAdapter } = await import('../src/content/adapters/iqiyi');
    document.body.innerHTML = '';
    expect(iqiyiAdapter.extract()).toBeNull();
  });

  it('extract: 正确提取信息', async () => {
    const { iqiyiAdapter } = await import('../src/content/adapters/iqiyi');
    const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        hostname: 'www.iqiyi.com',
        href: 'https://www.iqiyi.com/v_123.html',
        search: '',
        origin: 'https://www.iqiyi.com',
        pathname: '/v_123.html',
      },
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = `
      <div class="videoTitle"><a>爱奇艺测试剧</a></div>
      <div class="episodeList"><span class="active">第3集</span></div>
      <video src="test.mp4"></video>
    `;
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 300, writable: true });
    Object.defineProperty(video, 'duration', { value: 2400, writable: true });

    const result = iqiyiAdapter.extract();
    expect(result).not.toBeNull();
    expect(result!.title).toBe('爱奇艺测试剧');
    expect(result!.episode).toBe('第3集');
    expect(result!.platform).toBe('iqiyi');

    if (origDescriptor) Object.defineProperty(window, 'location', origDescriptor);
  });
});

// ===== 腾讯视频适配器测试 =====
describe('VQQ Adapter', () => {
  it('detect: v.qq.com 域名匹配', async () => {
    const { vqqAdapter } = await import('../src/content/adapters/vqq');
    const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: { ...window.location, hostname: 'v.qq.com' },
      writable: true,
      configurable: true,
    });
    expect(vqqAdapter.detect()).toBe(true);
    if (origDescriptor) Object.defineProperty(window, 'location', origDescriptor);
  });

  it('extract: 无 video 时返回 null', async () => {
    const { vqqAdapter } = await import('../src/content/adapters/vqq');
    document.body.innerHTML = '';
    expect(vqqAdapter.extract()).toBeNull();
  });

  it('extract: 正确提取信息', async () => {
    const { vqqAdapter } = await import('../src/content/adapters/vqq');
    const origDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        hostname: 'v.qq.com',
        href: 'https://v.qq.com/x/cover/abc/xyz.html',
        search: '',
        origin: 'https://v.qq.com',
        pathname: '/x/cover/abc/xyz.html',
      },
      writable: true,
      configurable: true,
    });

    document.body.innerHTML = `
      <div class="video_title_cn"><a>腾讯视频测试剧</a></div>
      <div class="episode_list"><span class="current">第5集</span></div>
      <video src="test.mp4"></video>
    `;
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 500, writable: true });
    Object.defineProperty(video, 'duration', { value: 3000, writable: true });

    const result = vqqAdapter.extract();
    expect(result).not.toBeNull();
    expect(result!.title).toBe('腾讯视频测试剧');
    expect(result!.episode).toBe('第5集');
    expect(result!.platform).toBe('vqq');

    if (origDescriptor) Object.defineProperty(window, 'location', origDescriptor);
  });

  it('buildResumeUrl: 使用 start 参数', async () => {
    const { vqqAdapter } = await import('../src/content/adapters/vqq');
    const url = vqqAdapter.buildResumeUrl('https://v.qq.com/x/cover/abc.html', 456);
    expect(url).toContain('start=456');
  });
});
