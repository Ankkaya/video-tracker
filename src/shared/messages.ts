import type { VideoInfo, WatchRecord, Settings } from './types';
import { MSG } from './constants';

/** 消息基础结构 */
interface BaseMessage<T extends string, D = void> {
  type: T;
  data: D;
}

/** Content -> Background: 心跳 */
export type HeartbeatMessage = BaseMessage<typeof MSG.HEARTBEAT, VideoInfo>;

/** Content -> Background: 手动保存 */
export type ManualSaveMessage = BaseMessage<typeof MSG.MANUAL_SAVE, VideoInfo>;

/** Content -> Background: 页面卸载 */
export type PageUnloadMessage = BaseMessage<typeof MSG.PAGE_UNLOAD, { url: string }>;

/** Content -> Background: 视频切换 */
export type VideoChangedMessage = BaseMessage<typeof MSG.VIDEO_CHANGED, VideoInfo>;

/** Popup -> Background: 获取记录 */
export type GetRecordsMessage = BaseMessage<typeof MSG.GET_RECORDS, void>;

/** Popup -> Background: 删除记录 */
export type DeleteRecordMessage = BaseMessage<typeof MSG.DELETE_RECORD, { id: string }>;

/** Popup/Options -> Background: 获取设置 */
export type GetSettingsMessage = BaseMessage<typeof MSG.GET_SETTINGS, void>;

/** Options -> Background: 更新设置 */
export type UpdateSettingsMessage = BaseMessage<typeof MSG.UPDATE_SETTINGS, Partial<Settings>>;

/** Background -> Content: 手动保存请求（快捷键触发） */
export type ManualSaveRequestMessage = BaseMessage<typeof MSG.MANUAL_SAVE_REQUEST, void>;

/** Background -> Content: 自动记录已落库（首次新建时） */
export type AutoSavedMessage = BaseMessage<typeof MSG.AUTO_SAVED, VideoInfo>;

/** Options -> Background: 设置站点自动记录规则 */
export type SetSiteRuleMessage = BaseMessage<typeof MSG.SET_SITE_RULE, { domain: string; autoRecord: boolean }>;

/** Options -> Background: 获取全部记录 */
export type GetAllRecordsMessage = BaseMessage<typeof MSG.GET_ALL_RECORDS, void>;

/** Options -> Background: 批量删除记录 */
export type DeleteRecordsMessage = BaseMessage<typeof MSG.DELETE_RECORDS, { ids: string[] }>;

/** Popup -> Background: 添加示例记录 */
export type AddSampleRecordMessage = BaseMessage<typeof MSG.ADD_SAMPLE_RECORD, {
  title?: string;
  episode?: string;
  platformName?: string;
}>;

/** 所有消息联合类型 */
export type Message =
  | HeartbeatMessage
  | ManualSaveMessage
  | PageUnloadMessage
  | VideoChangedMessage
  | GetRecordsMessage
  | DeleteRecordMessage
  | DeleteRecordsMessage
  | GetSettingsMessage
  | UpdateSettingsMessage
  | ManualSaveRequestMessage
  | AutoSavedMessage
  | SetSiteRuleMessage
  | GetAllRecordsMessage
  | AddSampleRecordMessage;

/** 创建消息辅助函数 */
export function createMessage<T extends typeof MSG[keyof typeof MSG]>(
  type: T,
  data?: any
): BaseMessage<T, any> {
  return { type, data } as any;
}
