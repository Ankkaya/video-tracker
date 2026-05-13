import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from '../src/content/adapters/registry';
import type { VideoAdapter } from '../src/content/adapters/types';

function createMockAdapter(platform: string, hostname: string): VideoAdapter {
  return {
    platform,
    platformName: platform,
    detect() {
      return location.hostname.includes(hostname);
    },
    extract() {
      return null;
    },
    getVideoElement() {
      return null;
    },
    buildResumeUrl(url: string, currentTime: number) {
      return `${url}?t=${currentTime}`;
    },
  };
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  describe('register', () => {
    it('注册单个适配器', () => {
      const adapter = createMockAdapter('bilibili', 'bilibili.com');
      registry.register(adapter);
      expect(registry.getAll()).toHaveLength(1);
      expect(registry.getAll()[0].platform).toBe('bilibili');
    });

    it('注册多个适配器', () => {
      registry.register(createMockAdapter('bilibili', 'bilibili.com'));
      registry.register(createMockAdapter('youtube', 'youtube.com'));
      registry.register(createMockAdapter('iqiyi', 'iqiyi.com'));
      expect(registry.getAll()).toHaveLength(3);
    });
  });

  describe('detect', () => {
    it('无匹配适配器时返回 null', () => {
      registry.register(createMockAdapter('bilibili', 'bilibili.com'));
      // location.hostname 在 happy-dom 中通常是 'localhost'
      const detected = registry.detect();
      expect(detected).toBeNull();
    });

    it('空注册表返回 null', () => {
      const detected = registry.detect();
      expect(detected).toBeNull();
    });

    it('注册表为空时 getAll 返回空数组', () => {
      expect(registry.getAll()).toEqual([]);
    });
  });
});
