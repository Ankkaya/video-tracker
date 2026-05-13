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

/** Options -> Background: 添加自定义站点 */
export type AddCustomSiteMessage = BaseMessage<typeof MSG.ADD_CUSTOM_SITE, { domain: string }>;

/** Options -> Background: 删除自定义站点 */
export type RemoveCustomSiteMessage = BaseMessage<typeof MSG.REMOVE_CUSTOM_SITE, { domain: string }>;

/** Options -> Background: 获取全部记录 */
export type GetAllRecordsMessage = BaseMessage<typeof MSG.GET_ALL_RECORDS, void>;

/** Options -> Background: 批量删除记录 */
export type DeleteRecordsMessage = BaseMessage<typeof MSG.DELETE_RECORDS, { ids: string[] }>;

/** Content -> Background: 获取自定义站点列表 */
export type GetCustomSitesMessage = BaseMessage<typeof MSG.GET_CUSTOM_SITES, void>;

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
  | AddCustomSiteMessage
  | RemoveCustomSiteMessage
  | GetAllRecordsMessage
  | GetCustomSitesMessage;

/** 创建消息辅助函数 */
export function createMessage<T extends typeof MSG[keyof typeof MSG]>(
  type: T,
  data?: any
): BaseMessage<T, any> {
  return { type, data } as any;
}
