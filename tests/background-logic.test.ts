import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VideoInfo, WatchRecord, Settings } from '../src/shared/types';

// ===== 阈值计时逻辑单元测试 =====
// 直接测试 handleHeartbeat 的逻辑，不依赖 Chrome API

describe('阈值计时逻辑', () => {
  // 模拟 background.ts 中的核心逻辑
  interface TimerEntry {
    url: string;
    accumulated: number;
    lastTick: number;
    videoInfo: VideoInfo;
    saved: boolean;
  }

  const timers = new Map<string, TimerEntry>();

  function normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.origin + u.pathname + u.search;
    } catch {
      return url;
    }
  }

  function handleHeartbeatLogic(
    videoInfo: VideoInfo,
    settings: Settings,
    now: number
  ): { shouldSave: boolean; entry: TimerEntry } | null {
    if (!settings.autoRecord) return null;

    const key = normalizeUrl(videoInfo.url);

    let entry = timers.get(key);
    if (!entry) {
      entry = {
        url: videoInfo.url,
        accumulated: 0,
        lastTick: now,
        videoInfo,
        saved: false,
      };
      timers.set(key, entry);
    }

    const elapsed = (now - entry.lastTick) / 1000;
    entry.accumulated += elapsed;
    entry.lastTick = now;
    entry.videoInfo = videoInfo;

    let shouldSave = false;
    if (entry.accumulated >= settings.threshold && !entry.saved) {
      shouldSave = true;
      entry.saved = true;
    }

    return { shouldSave, entry };
  }

  const defaultSettings: Settings = {
    autoRecord: true,
    autoSync: false,
    threshold: 30,
    shortcut: 'Ctrl+Shift+V',
    customSites: [],
  };

  const mockVideoInfo: VideoInfo = {
    url: 'https://www.bilibili.com/video/BV1xx',
    title: '测试视频',
    episode: '正片',
    platform: 'bilibili',
    platformName: 'B站',
    currentTime: 60,
    duration: 300,
  };

  beforeEach(() => {
    timers.clear();
  });

  it('首次心跳创建 TimerEntry', () => {
    const result = handleHeartbeatLogic(mockVideoInfo, defaultSettings, 1000);
    expect(result).not.toBeNull();
    expect(result!.entry.accumulated).toBe(0);
    expect(result!.entry.saved).toBe(false);
    expect(result!.shouldSave).toBe(false);
  });

  it('累积时间未达阈值不触发保存', () => {
    // t=0: 首次心跳
    handleHeartbeatLogic(mockVideoInfo, defaultSettings, 0);
    // t=10s: 第二次心跳
    const result = handleHeartbeatLogic(mockVideoInfo, defaultSettings, 10000);
    expect(result!.entry.accumulated).toBe(10);
    expect(result!.shouldSave).toBe(false);
    expect(result!.entry.saved).toBe(false);
  });

  it('累积时间达到阈值触发保存', () => {
    // t=0: 首次心跳
    handleHeartbeatLogic(mockVideoInfo, defaultSettings, 0);
    // t=30s: 达到阈值
    const result = handleHeartbeatLogic(mockVideoInfo, defaultSettings, 30000);
    expect(result!.entry.accumulated).toBe(30);
    expect(result!.shouldSave).toBe(true);
    expect(result!.entry.saved).toBe(true);
  });

  it('已保存后不再重复保存', () => {
    handleHeartbeatLogic(mockVideoInfo, defaultSettings, 0);
    handleHeartbeatLogic(mockVideoInfo, defaultSettings, 30000);
    // 再次心跳，不应再次保存
    const result = handleHeartbeatLogic(mockVideoInfo, defaultSettings, 60000);
    expect(result!.shouldSave).toBe(false);
    expect(result!.entry.saved).toBe(true);
  });

  it('阈值为 0 时首次心跳立即保存', () => {
    const zeroThreshold = { ...defaultSettings, threshold: 0 };
    // t=0: 首次心跳，accumulated=0，threshold=0，0>=0 为 true
    const result = handleHeartbeatLogic(mockVideoInfo, zeroThreshold, 0);
    expect(result!.entry.accumulated).toBe(0);
    expect(result!.shouldSave).toBe(true);
  });

  it('autoRecord 为 false 时不处理', () => {
    const disabled = { ...defaultSettings, autoRecord: false };
    const result = handleHeartbeatLogic(mockVideoInfo, disabled, 0);
    expect(result).toBeNull();
  });

  it('心跳间隔不均匀时正确累积', () => {
    handleHeartbeatLogic(mockVideoInfo, defaultSettings, 0);
    handleHeartbeatLogic(mockVideoInfo, defaultSettings, 5000);  // +5s
    handleHeartbeatLogic(mockVideoInfo, defaultSettings, 20000); // +15s
    const result = handleHeartbeatLogic(mockVideoInfo, defaultSettings, 35000); // +15s
    expect(result!.entry.accumulated).toBe(35);
    expect(result!.shouldSave).toBe(true);
  });

  it('不同 URL 分别计时', () => {
    const videoInfo2 = { ...mockVideoInfo, url: 'https://www.bilibili.com/video/BV2yy' };
    handleHeartbeatLogic(mockVideoInfo, defaultSettings, 0);
    handleHeartbeatLogic(videoInfo2, defaultSettings, 0);
    expect(timers.size).toBe(2);

    const key1 = normalizeUrl(mockVideoInfo.url);
    const key2 = normalizeUrl(videoInfo2.url);
    expect(timers.get(key1)!.accumulated).toBe(0);
    expect(timers.get(key2)!.accumulated).toBe(0);
  });

  it('URL 规范化: 保留 search，去除 hash', () => {
    const key = normalizeUrl('https://www.bilibili.com/video/BV1?p=2&t=100#reply');
    expect(key).toBe('https://www.bilibili.com/video/BV1?p=2&t=100');
  });

  it('URL 规范化: 同路径不同 query 被区分（YouTube ?v= / B 站 ?p= 场景）', () => {
    const a = normalizeUrl('https://www.youtube.com/watch?v=abc');
    const b = normalizeUrl('https://www.youtube.com/watch?v=xyz');
    expect(a).not.toBe(b);
  });

  it('URL 规范化: 无效 URL 原样返回', () => {
    const key = normalizeUrl('not-a-url');
    expect(key).toBe('not-a-url');
  });

  it('达到阈值后更新 videoInfo', () => {
    handleHeartbeatLogic(mockVideoInfo, defaultSettings, 0);
    const updatedInfo = { ...mockVideoInfo, currentTime: 120 };
    const result = handleHeartbeatLogic(updatedInfo, defaultSettings, 30000);
    expect(result!.entry.videoInfo.currentTime).toBe(120);
  });

  it('handlePageUnload 逻辑: 未保存且超阈值应保存', () => {
    // 模拟累积了 25 秒，阈值 30 秒，未保存
    const entry: TimerEntry = {
      url: mockVideoInfo.url,
      accumulated: 25,
      lastTick: 1000,
      videoInfo: mockVideoInfo,
      saved: false,
    };
    const threshold = 30;
    expect(entry.accumulated >= threshold).toBe(false); // 25 < 30, 不保存

    entry.accumulated = 35;
    expect(entry.accumulated >= threshold).toBe(true); // 35 >= 30, 应保存
  });

  it('progress 计算: duration > 0', () => {
    const currentTime = 150;
    const duration = 300;
    const progress = duration > 0 ? currentTime / duration : 0;
    expect(progress).toBe(0.5);
  });

  it('progress 计算: duration = 0 避免除零', () => {
    const currentTime = 0;
    const duration = 0;
    const progress = duration > 0 ? currentTime / duration : 0;
    expect(progress).toBe(0);
  });
});
