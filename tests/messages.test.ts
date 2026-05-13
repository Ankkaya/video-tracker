import { describe, it, expect } from 'vitest';
import { MSG } from '../src/shared/constants';
import type {
  HeartbeatMessage,
  ManualSaveMessage,
  PageUnloadMessage,
  VideoChangedMessage,
  GetRecordsMessage,
  DeleteRecordMessage,
  GetSettingsMessage,
  UpdateSettingsMessage,
  ManualSaveRequestMessage,
  Message,
} from '../src/shared/messages';
import type { WatchRecord, Settings, VideoInfo, Platform } from '../src/shared/types';

describe('消息类型定义完整性', () => {
  it('MSG 常量包含所有消息类型', () => {
    expect(MSG.HEARTBEAT).toBe('HEARTBEAT');
    expect(MSG.MANUAL_SAVE).toBe('MANUAL_SAVE');
    expect(MSG.PAGE_UNLOAD).toBe('PAGE_UNLOAD');
    expect(MSG.VIDEO_CHANGED).toBe('VIDEO_CHANGED');
    expect(MSG.MANUAL_SAVE_REQUEST).toBe('MANUAL_SAVE_REQUEST');
    expect(MSG.GET_RECORDS).toBe('GET_RECORDS');
    expect(MSG.DELETE_RECORD).toBe('DELETE_RECORD');
    expect(MSG.GET_SETTINGS).toBe('GET_SETTINGS');
    expect(MSG.UPDATE_SETTINGS).toBe('UPDATE_SETTINGS');
  });

  it('MSG 常量共 15 个消息类型', () => {
    expect(Object.keys(MSG)).toHaveLength(15);
  });

  it('包含 AUTO_SAVED 通知消息', () => {
    expect(MSG.AUTO_SAVED).toBe('AUTO_SAVED');
  });

  it('MSG 值互不重复', () => {
    const values = Object.values(MSG);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('MSG 是 as const 不可变', () => {
    // TypeScript as const 保证类型层面不可变
    // 运行时验证类型
    expect(typeof MSG.HEARTBEAT).toBe('string');
  });
});

describe('类型定义完整性', () => {
  it('WatchRecord 包含所有必要字段', () => {
    const record: WatchRecord = {
      id: 'test_id',
      url: 'https://example.com',
      title: '标题',
      episode: '正片',
      platform: 'bilibili',
      platformName: 'B站',
      currentTime: 60,
      duration: 300,
      progress: 0.2,
      lastWatchedAt: Date.now(),
      createdAt: Date.now(),
    };
    expect(record.id).toBeDefined();
    expect(record.url).toBeDefined();
    expect(record.title).toBeDefined();
    expect(record.episode).toBeDefined();
    expect(record.platform).toBeDefined();
    expect(record.platformName).toBeDefined();
    expect(record.currentTime).toBeDefined();
    expect(record.duration).toBeDefined();
    expect(record.progress).toBeDefined();
    expect(record.lastWatchedAt).toBeDefined();
    expect(record.createdAt).toBeDefined();
  });

  it('WatchRecord 可选字段可以不传', () => {
    const record: WatchRecord = {
      id: 'test_id',
      url: 'https://example.com',
      title: '标题',
      episode: '正片',
      platform: 'bilibili',
      platformName: 'B站',
      currentTime: 60,
      duration: 300,
      progress: 0.2,
      lastWatchedAt: Date.now(),
      createdAt: Date.now(),
      // seriesName, thumbnail, notes 都是可选的
    };
    expect(record.seriesName).toBeUndefined();
    expect(record.thumbnail).toBeUndefined();
    expect(record.notes).toBeUndefined();
  });

  it('Settings 包含所有必要字段', () => {
    const settings: Settings = {
      autoRecord: true,
      threshold: 30,
      shortcut: 'Ctrl+Shift+V',
      customSites: [],
    };
    expect(typeof settings.autoRecord).toBe('boolean');
    expect(typeof settings.threshold).toBe('number');
    expect(typeof settings.shortcut).toBe('string');
    expect(Array.isArray(settings.customSites)).toBe(true);
  });

  it('VideoInfo 包含所有必要字段', () => {
    const videoInfo: VideoInfo = {
      url: 'https://example.com',
      title: '标题',
      episode: '正片',
      platform: 'bilibili',
      platformName: 'B站',
      currentTime: 60,
      duration: 300,
    };
    expect(videoInfo.url).toBeDefined();
    expect(videoInfo.title).toBeDefined();
    expect(videoInfo.episode).toBeDefined();
    expect(videoInfo.platform).toBeDefined();
    expect(videoInfo.platformName).toBeDefined();
    expect(videoInfo.currentTime).toBeDefined();
    expect(videoInfo.duration).toBeDefined();
  });

  it('VideoInfo 可选字段可以不传', () => {
    const videoInfo: VideoInfo = {
      url: 'https://example.com',
      title: '标题',
      episode: '正片',
      platform: 'bilibili',
      platformName: 'B站',
      currentTime: 60,
      duration: 300,
    };
    expect(videoInfo.seriesName).toBeUndefined();
    expect(videoInfo.thumbnail).toBeUndefined();
  });

  it('Platform 类型包含 4 个平台', () => {
    const platforms: Platform[] = ['bilibili', 'youtube', 'iqiyi', 'vqq'];
    expect(platforms).toHaveLength(4);
  });
});

describe('消息类型匹配验证', () => {
  it('HeartbeatMessage data 类型是 VideoInfo', () => {
    const msg: HeartbeatMessage = {
      type: MSG.HEARTBEAT,
      data: {
        url: 'https://example.com',
        title: '标题',
        episode: '正片',
        platform: 'bilibili',
        platformName: 'B站',
        currentTime: 60,
        duration: 300,
      },
    };
    expect(msg.type).toBe('HEARTBEAT');
    expect(msg.data.currentTime).toBe(60);
  });

  it('ManualSaveMessage data 类型是 VideoInfo', () => {
    const msg: ManualSaveMessage = {
      type: MSG.MANUAL_SAVE,
      data: {
        url: 'https://example.com',
        title: '标题',
        episode: '正片',
        platform: 'youtube',
        platformName: 'YouTube',
        currentTime: 120,
        duration: 600,
      },
    };
    expect(msg.type).toBe('MANUAL_SAVE');
  });

  it('PageUnloadMessage data 包含 url', () => {
    const msg: PageUnloadMessage = {
      type: MSG.PAGE_UNLOAD,
      data: { url: 'https://example.com' },
    };
    expect(msg.data.url).toBeDefined();
  });

  it('DeleteRecordMessage data 包含 id', () => {
    const msg: DeleteRecordMessage = {
      type: MSG.DELETE_RECORD,
      data: { id: 'record_123' },
    };
    expect(msg.data.id).toBe('record_123');
  });

  it('GetRecordsMessage data 是 void', () => {
    const msg: GetRecordsMessage = {
      type: MSG.GET_RECORDS,
      data: undefined as any,
    };
    expect(msg.type).toBe('GET_RECORDS');
  });

  it('GetSettingsMessage data 是 void', () => {
    const msg: GetSettingsMessage = {
      type: MSG.GET_SETTINGS,
      data: undefined as any,
    };
    expect(msg.type).toBe('GET_SETTINGS');
  });

  it('UpdateSettingsMessage data 是 Partial<Settings>', () => {
    const msg: UpdateSettingsMessage = {
      type: MSG.UPDATE_SETTINGS,
      data: { threshold: 60 },
    };
    expect(msg.data.threshold).toBe(60);
  });

  it('ManualSaveRequestMessage data 是 void', () => {
    const msg: ManualSaveRequestMessage = {
      type: MSG.MANUAL_SAVE_REQUEST,
      data: undefined as any,
    };
    expect(msg.type).toBe('MANUAL_SAVE_REQUEST');
  });
});
