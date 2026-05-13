import type { VideoInfo } from '../../shared/types';

/** 视频适配器接口 */
export interface VideoAdapter {
  /** 平台标识 */
  platform: string;
  /** 平台显示名称 */
  platformName: string;

  /** 检测当前页面是否属于该平台 */
  detect(): boolean;

  /** 从页面提取视频信息 */
  extract(): VideoInfo | null;

  /** 获取 video 元素 */
  getVideoElement(): HTMLVideoElement | null;

  /** 构建恢复播放 URL（含时间点） */
  buildResumeUrl(url: string, currentTime: number): string;
}
