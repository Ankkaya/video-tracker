import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome.storage.local
const mockStorage: Record<string, any> = {};
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => {
        return { [key]: mockStorage[key] };
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        Object.assign(mockStorage, items);
      }),
    },
  },
};

// @ts-ignore
global.chrome = chromeMock;

// 动态导入以使用 mock
const { StorageManager } = await import('../src/shared/storage');

describe('StorageManager', () => {
  beforeEach(() => {
    // 清空 mock 存储
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    vi.clearAllMocks();
  });

  describe('getRecords', () => {
    it('存储为空时返回空数组', async () => {
      const records = await StorageManager.getRecords();
      expect(records).toEqual([]);
    });

    it('返回已存储的记录', async () => {
      const testRecords = [
        { id: '1', url: 'https://bilibili.com/video/BV1', title: '测试视频', episode: '正片', platform: 'bilibili', platformName: 'B站', currentTime: 60, duration: 300, progress: 0.2, lastWatchedAt: 1000, createdAt: 1000 },
      ];
      mockStorage['video_tracker_records'] = testRecords;
      const records = await StorageManager.getRecords();
      expect(records).toEqual(testRecords);
    });
  });

  describe('saveRecord', () => {
    it('新记录插入到列表头部', async () => {
      const record = { id: '1', url: 'https://bilibili.com/video/BV1', title: '视频1', episode: '正片', platform: 'bilibili', platformName: 'B站', currentTime: 60, duration: 300, progress: 0.2, lastWatchedAt: 1000, createdAt: 1000 };
      await StorageManager.saveRecord(record);
      expect(chromeMock.storage.local.set).toHaveBeenCalled();
      // 验证记录被写入
      const savedData = mockStorage['video_tracker_records'];
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('1');
    });

    it('更新已有记录（upsert）', async () => {
      const existing = [{ id: '1', url: 'https://bilibili.com/video/BV1', title: '旧标题', episode: '正片', platform: 'bilibili', platformName: 'B站', currentTime: 30, duration: 300, progress: 0.1, lastWatchedAt: 1000, createdAt: 1000 }];
      mockStorage['video_tracker_records'] = [...existing];

      const updated = { ...existing[0], title: '新标题', currentTime: 120 };
      await StorageManager.saveRecord(updated);

      const savedData = mockStorage['video_tracker_records'];
      expect(savedData).toHaveLength(1);
      expect(savedData[0].title).toBe('新标题');
      expect(savedData[0].currentTime).toBe(120);
    });

    it('多条记录时正确 upsert', async () => {
      const records = [
        { id: '1', url: 'url1', title: '视频1', episode: '正片', platform: 'bilibili', platformName: 'B站', currentTime: 10, duration: 100, progress: 0.1, lastWatchedAt: 1000, createdAt: 1000 },
        { id: '2', url: 'url2', title: '视频2', episode: '正片', platform: 'youtube', platformName: 'YouTube', currentTime: 20, duration: 200, progress: 0.1, lastWatchedAt: 2000, createdAt: 2000 },
      ];
      mockStorage['video_tracker_records'] = [...records];

      const updated = { ...records[1], title: '更新的视频2' };
      await StorageManager.saveRecord(updated);

      const savedData = mockStorage['video_tracker_records'];
      expect(savedData).toHaveLength(2);
      // id='2' 被更新
      expect(savedData.find((r: any) => r.id === '2').title).toBe('更新的视频2');
    });
  });

  describe('findRecordByUrl', () => {
    it('找到匹配的记录', async () => {
      const records = [
        { id: '1', url: 'https://example.com/video1', title: '视频1', episode: '正片', platform: 'bilibili', platformName: 'B站', currentTime: 10, duration: 100, progress: 0.1, lastWatchedAt: 1000, createdAt: 1000 },
      ];
      mockStorage['video_tracker_records'] = records;

      const found = await StorageManager.findRecordByUrl('https://example.com/video1');
      expect(found).toBeDefined();
      expect(found!.id).toBe('1');
    });

    it('未找到返回 undefined', async () => {
      mockStorage['video_tracker_records'] = [];
      const found = await StorageManager.findRecordByUrl('https://nonexistent.com');
      expect(found).toBeUndefined();
    });
  });

  describe('deleteRecord', () => {
    it('删除指定记录', async () => {
      const records = [
        { id: '1', url: 'url1', title: '视频1', episode: '正片', platform: 'bilibili', platformName: 'B站', currentTime: 10, duration: 100, progress: 0.1, lastWatchedAt: 1000, createdAt: 1000 },
        { id: '2', url: 'url2', title: '视频2', episode: '正片', platform: 'youtube', platformName: 'YouTube', currentTime: 20, duration: 200, progress: 0.1, lastWatchedAt: 2000, createdAt: 2000 },
      ];
      mockStorage['video_tracker_records'] = [...records];

      await StorageManager.deleteRecord('1');
      const savedData = mockStorage['video_tracker_records'];
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('2');
      expect(mockStorage['video_tracker_deleted_records']).toEqual([
        { key: 'bilibili::url1', deletedAt: expect.any(Number) },
      ]);
    });

    it('删除不存在的记录不报错', async () => {
      mockStorage['video_tracker_records'] = [{ id: '1', url: 'url1', title: '视频1', episode: '正片', platform: 'bilibili', platformName: 'B站', currentTime: 10, duration: 100, progress: 0.1, lastWatchedAt: 1000, createdAt: 1000 }];
      await StorageManager.deleteRecord('nonexistent');
      expect(mockStorage['video_tracker_records']).toHaveLength(1);
    });

    it('空列表中删除不报错', async () => {
      mockStorage['video_tracker_records'] = [];
      await StorageManager.deleteRecord('any');
      expect(mockStorage['video_tracker_records']).toHaveLength(0);
    });

    it('保存更新晚于墓碑的记录时清除删除标记', async () => {
      mockStorage['video_tracker_deleted_records'] = [{ key: 'youtube::url1', deletedAt: 1000 }];
      await StorageManager.saveRecord({
        id: '1',
        url: 'url1',
        title: '视频1',
        episode: '正片',
        platform: 'youtube',
        platformName: 'YouTube',
        currentTime: 20,
        duration: 200,
        progress: 0.1,
        lastWatchedAt: 2000,
        createdAt: 1000,
      });

      expect(mockStorage['video_tracker_deleted_records']).toEqual([]);
    });
  });

  describe('getSettings', () => {
    it('无存储时返回默认设置', async () => {
      const settings = await StorageManager.getSettings();
      expect(settings.autoRecord).toBe(false);
      expect(settings.threshold).toBe(30);
      expect(settings.shortcut).toBe('Ctrl+Shift+V');
    });

    it('合并已存储的设置', async () => {
      mockStorage['video_tracker_settings'] = { threshold: 60 };
      const settings = await StorageManager.getSettings();
      expect(settings.threshold).toBe(60);
      expect(settings.autoRecord).toBe(false); // 默认值
    });

    it('完全自定义设置', async () => {
      mockStorage['video_tracker_settings'] = { autoRecord: false, threshold: 120, shortcut: 'Ctrl+Shift+S' };
      const settings = await StorageManager.getSettings();
      expect(settings.autoRecord).toBe(false);
      expect(settings.threshold).toBe(120);
      expect(settings.shortcut).toBe('Ctrl+Shift+S');
    });
  });

  describe('updateSettings', () => {
    it('部分更新设置', async () => {
      mockStorage['video_tracker_settings'] = { autoRecord: true, threshold: 30, shortcut: 'Ctrl+Shift+V' };
      await StorageManager.updateSettings({ threshold: 60 });
      const settings = mockStorage['video_tracker_settings'];
      expect(settings.threshold).toBe(60);
      expect(settings.autoRecord).toBe(true);
      expect(settings.shortcut).toBe('Ctrl+Shift+V');
    });

    it('从默认设置开始更新', async () => {
      await StorageManager.updateSettings({ autoRecord: false });
      const settings = mockStorage['video_tracker_settings'];
      expect(settings.autoRecord).toBe(false);
      expect(settings.threshold).toBe(30); // 默认值保留
    });
  });
});
