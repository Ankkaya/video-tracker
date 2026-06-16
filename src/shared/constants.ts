import type { Settings } from './types';

/** 默认设置 */
export const DEFAULT_SETTINGS: Settings = {
  autoRecord: false,
  autoSync: false,
  threshold: 30,
  shortcut: 'Ctrl+Shift+V',
  customSites: [],
};

/** 心跳间隔（毫秒） */
export const HEARTBEAT_INTERVAL = 5000;

/** 可选阈值列表（秒） */
export const THRESHOLD_OPTIONS = [0, 10, 30, 60, 120];

/** 平台显示名称映射 */
export const PLATFORM_NAMES: Record<string, string> = {
  bilibili: 'B站',
  youtube: 'YouTube',
  iqiyi: '爱奇艺',
  vqq: '腾讯视频',
};

/** 存储键名 */
export const STORAGE_KEYS = {
  RECORDS: 'video_tracker_records',
  SETTINGS: 'video_tracker_settings',
  SYNC_META: 'video_tracker_sync_meta',
  AUTH_META: 'video_tracker_auth_meta',
  AUTH_PENDING: 'video_tracker_auth_pending',
  ENCRYPTION_DEVICE_KEY: 'video_tracker_encryption_device_key',
} as const;

/** 消息类型 */
export const MSG = {
  HEARTBEAT: 'HEARTBEAT',
  MANUAL_SAVE: 'MANUAL_SAVE',
  PAGE_UNLOAD: 'PAGE_UNLOAD',
  VIDEO_CHANGED: 'VIDEO_CHANGED',
  MANUAL_SAVE_REQUEST: 'MANUAL_SAVE_REQUEST',
  AUTO_SAVED: 'AUTO_SAVED',
  GET_RECORDS: 'GET_RECORDS',
  DELETE_RECORD: 'DELETE_RECORD',
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  ADD_CUSTOM_SITE: 'ADD_CUSTOM_SITE',
  REMOVE_CUSTOM_SITE: 'REMOVE_CUSTOM_SITE',
  GET_ALL_RECORDS: 'GET_ALL_RECORDS',
  DELETE_RECORDS: 'DELETE_RECORDS',
  GET_CUSTOM_SITES: 'GET_CUSTOM_SITES',
  /** Popup 手动添加当前页面记录（不依赖 content script） */
  MANUAL_ADD_RECORD: 'MANUAL_ADD_RECORD',
  /** Popup 添加示例记录，便于首次使用和商店审核验证 */
  ADD_SAMPLE_RECORD: 'ADD_SAMPLE_RECORD',
  /** Content Script 请求 Background 探测 iframe 中的 video */
  PROBE_IFRAME_VIDEO: 'PROBE_IFRAME_VIDEO',
  /** Content Script 请求 Background 在当前 frame 的 MAIN world 安装播放器桥接 */
  INSTALL_MAIN_BRIDGE: 'INSTALL_MAIN_BRIDGE',
  /** Popup 请求 Content Script 启动 DOM 选择器模式 */
  START_PICKER: 'START_PICKER',
  /** Content Script 通知 Background 选择完成的结果 */
  PICKER_RESULT: 'PICKER_RESULT',
  /** Content Script 从回调页面提取的认证 token */
  AUTH_CALLBACK: 'AUTH_CALLBACK',
} as const;
