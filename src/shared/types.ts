/** 观看记录 */
export interface WatchRecord {
  id: string;
  url: string;
  title: string;
  episode: string;
  seriesName?: string;
  platform: string;
  platformName: string;
  currentTime: number;
  duration: number;
  progress: number; // 0-1 百分比
  thumbnail?: string;
  lastWatchedAt: number;
  createdAt: number;
  notes?: string;
}

/** 已删除记录的同步墓碑 */
export interface DeletedRecord {
  key: string;
  deletedAt: number;
}

/** 按域名控制自动记录，默认允许 */
export interface SiteRule {
  domain: string;
  autoRecord: boolean;
  updatedAt: number;
}

/** 插件设置 */
export interface Settings {
  autoRecord: boolean;
  autoSync: boolean;
  threshold: number; // 最低观看时长阈值（秒）
  shortcut: string;
  siteRules: SiteRule[];
}

/** 视频信息（Content Script 提取） */
export interface VideoInfo {
  /** pause/seeked 上报仅更新进度，不累计观看时长 */
  isPlaying?: boolean;
  url: string;
  title: string;
  episode: string;
  seriesName?: string;
  platform: string;
  platformName: string;
  currentTime: number;
  duration: number;
  thumbnail?: string;
}

/** 平台信息 */
export type Platform = 'bilibili' | 'youtube' | 'iqiyi' | 'vqq';
