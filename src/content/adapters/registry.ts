import type { VideoAdapter } from './types';

/** 适配器注册中心 */
export class AdapterRegistry {
  private adapters: VideoAdapter[] = [];

  /** 注册适配器 */
  register(adapter: VideoAdapter): void {
    this.adapters.push(adapter);
  }

  /** 检测当前页面对应的适配器 */
  detect(): VideoAdapter | null {
    return this.adapters.find((a) => a.detect()) ?? null;
  }

  /** 获取所有已注册适配器 */
  getAll(): VideoAdapter[] {
    return this.adapters;
  }
}

/** 全局单例 */
export const registry = new AdapterRegistry();
