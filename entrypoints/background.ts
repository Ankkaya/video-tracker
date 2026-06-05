import { StorageManager } from '../src/shared/storage';
import type { VideoInfo, WatchRecord } from '../src/shared/types';
import { MSG, STORAGE_KEYS } from '../src/shared/constants';
import { ICON_SIZES, drawVideoTrackerIcon } from '../src/shared/icon';
import { logger } from '../src/shared/logger';
import { supabase, type Record as CloudRecord } from '../src/supabase';

interface TimerEntry {
  url: string;
  accumulated: number;
  lastTick: number;
  videoInfo: VideoInfo;
  saved: boolean;
}

export default defineBackground(() => {
  /** 阈值计时器 Map<normalizedUrl, TimerEntry> */
  const timers = new Map<string, TimerEntry>();
  let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let autoSyncRunning = false;

  async function setSyncMeta(partial: { state: 'idle' | 'syncing' | 'success' | 'error'; lastSyncAt?: number | null; lastError?: string }) {
    const current = await chrome.storage.local.get(STORAGE_KEYS.SYNC_META);
    const next = {
      state: 'idle',
      lastSyncAt: null,
      ...(current[STORAGE_KEYS.SYNC_META] ?? {}),
      ...partial,
    };

    if (!next.lastError) {
      delete next.lastError;
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.SYNC_META]: next });
  }

  async function getAuthenticatedUser() {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const data = await chrome.storage.local.get(STORAGE_KEYS.AUTH_META);
    const authMeta = data[STORAGE_KEYS.AUTH_META];
    if (!authMeta?.isLoggedIn || !authMeta?.accessToken) {
      throw new Error('User not authenticated');
    }

    await supabase.auth.setSession({
      access_token: authMeta.accessToken,
      refresh_token: authMeta.refreshToken || '',
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) {
      throw new Error('User not authenticated');
    }

    return user;
  }

  async function runAutoSync() {
    if (autoSyncRunning) return;

    const settings = await StorageManager.getSettings();
    if (!settings.autoSync) return;

    const authData = await chrome.storage.local.get(STORAGE_KEYS.AUTH_META);
    const authMeta = authData[STORAGE_KEYS.AUTH_META];
    if (!authMeta?.isLoggedIn || !authMeta?.accessToken) return;

    autoSyncRunning = true;
    await setSyncMeta({ state: 'syncing', lastError: undefined });

    try {
      const user = await getAuthenticatedUser();
      const records = await StorageManager.getRecords();
      const recordsToUpload: CloudRecord[] = records.map(record => ({
        id: `${record.platform}::${record.url}`,
        user_id: user.id,
        platform: record.platform,
        video_id: record.id,
        url: record.url,
        title: record.title,
        thumbnail: record.thumbnail,
        progress: record.progress,
        duration: record.duration,
        watched_at: new Date(record.lastWatchedAt).toISOString(),
        updated_at: new Date().toISOString(),
      }));

      if (recordsToUpload.length > 0) {
        const { error } = await supabase!
          .from('records')
          .upsert(recordsToUpload, { onConflict: 'id' });
        if (error) throw error;
      }

      await setSyncMeta({ state: 'success', lastSyncAt: Date.now(), lastError: undefined });
    } catch (error: any) {
      logger.error('[VideoTracker] 自动同步失败:', error);
      await setSyncMeta({ state: 'error', lastError: error?.message || String(error) });
    } finally {
      autoSyncRunning = false;
    }
  }

  function scheduleAutoSync() {
    if (autoSyncTimer) {
      clearTimeout(autoSyncTimer);
    }

    autoSyncTimer = setTimeout(() => {
      autoSyncTimer = null;
      void runAutoSync();
    }, 15000);
  }

  function createActionIcon(size: number, enabled: boolean): ImageData | undefined {
    if (typeof OffscreenCanvas === 'undefined') return undefined;

    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    drawVideoTrackerIcon(ctx, size, enabled);
    return ctx.getImageData(0, 0, size, size);
  }

  async function setActionIcon(enabled: boolean): Promise<void> {
    const imageData = ICON_SIZES.reduce<Record<number, ImageData>>((icons, size) => {
      const icon = createActionIcon(size, enabled);
      if (icon) icons[size] = icon;
      return icons;
    }, {});

    if (Object.keys(imageData).length > 0) {
      await chrome.action.setIcon({ imageData });
    }
  }

  async function updateActionState(autoRecord?: boolean): Promise<void> {
    const enabled = autoRecord ?? (await StorageManager.getSettings()).autoRecord;
    try {
      await chrome.action.setBadgeText({ text: '' });
      await setActionIcon(enabled);
      await chrome.action.setTitle({
        title: enabled ? 'VideoTracker - 自动记录已开启' : 'VideoTracker - 自动记录已关闭',
      });
    } catch {
      // action API 在测试或部分环境下可能不可用
    }
  }

  /** 生成记录 ID */
  function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 规范化 URL：保留 origin + pathname + search，去除 hash。
   * 保留 search 是必要的，YouTube 的 ?v=xxx、B 站的 ?p=×× 都是区分不同视频的关键参数。 */
  function normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.origin + u.pathname + u.search;
    } catch {
      return url;
    }
  }

  /** 处理心跳 */
  async function handleHeartbeat(
    videoInfo: VideoInfo,
    tabId?: number,
    frameId?: number,
    tabUrl?: string,
    tabTitle?: string
  ): Promise<void> {
    const settings = await StorageManager.getSettings();
    if (!settings.autoRecord) return;

    const normalizedInfo = normalizeFrameVideoInfo(videoInfo, frameId, tabUrl, tabTitle);
    const key = normalizeUrl(normalizedInfo.url);
    const now = Date.now();

    let entry = timers.get(key);
    if (!entry) {
      entry = {
        url: normalizedInfo.url,
        accumulated: 0,
        lastTick: now,
        videoInfo: normalizedInfo,
        saved: false,
      };
      timers.set(key, entry);
    }

    const elapsed = (now - entry.lastTick) / 1000;
    entry.accumulated += elapsed;
    entry.lastTick = now;
    entry.videoInfo = normalizedInfo;

    if (entry.accumulated >= settings.threshold && !entry.saved) {
      const { isNew } = await saveRecord(entry.videoInfo, entry.accumulated);
      entry.saved = true;
      // 仅在首次新建记录时通知页面弹框；SW 重启后记录已存在，不会重复弹框
      if (isNew && tabId !== undefined) {
        chrome.tabs.sendMessage(tabId, {
          type: MSG.AUTO_SAVED,
          data: entry.videoInfo,
        }, { frameId: 0 }).catch(() => {});
      }
    }
  }

  /**
   * iframe 内的 content script 拿到的是播放器 frame 的 location/referrer。
   * 对用户来说记录应该归属于顶层页面，所以 iframe 心跳优先使用 tab.url。
   */
  function normalizeFrameVideoInfo(
    videoInfo: VideoInfo,
    frameId?: number,
    tabUrl?: string,
    tabTitle?: string
  ): VideoInfo {
    if (!frameId || frameId === 0 || !tabUrl) return videoInfo;
    const shouldPreferTabTitle =
      videoInfo.platform === 'generic' ||
      videoInfo.platformName === '通用' ||
      isWeakTitle(videoInfo.title);
    return {
      ...videoInfo,
      url: tabUrl,
      title: shouldPreferTabTitle && tabTitle ? cleanTabTitle(tabTitle) : videoInfo.title,
    };
  }

  function isWeakTitle(title: string): boolean {
    const t = title.trim();
    return !t || t === '未命名视频' || t === 'about:blank';
  }

  function cleanTabTitle(title: string): string {
    return title
      .replace(/\s*[-_]\s*VideoTracker.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim() || title;
  }

  /** 处理手动保存 */
  async function handleManualSave(
    videoInfo: VideoInfo,
    frameId?: number,
    tabUrl?: string,
    tabTitle?: string
  ): Promise<void> {
    const normalizedInfo = normalizeFrameVideoInfo(videoInfo, frameId, tabUrl, tabTitle);
    const key = normalizeUrl(normalizedInfo.url);
    const entry = timers.get(key);
    const accumulated = entry?.accumulated ?? 0;
    await saveRecord(normalizedInfo, accumulated);
    if (entry) entry.saved = true;
  }

  /** 处理页面卸载 */
  async function handlePageUnload(url: string): Promise<void> {
    const key = normalizeUrl(url);
    const entry = timers.get(key);
    if (!entry) return;

    if (!entry.saved) {
      const settings = await StorageManager.getSettings();
      if (entry.accumulated >= settings.threshold) {
        await saveRecord(entry.videoInfo, entry.accumulated);
      }
    } else {
      const records = await StorageManager.getRecords();
      const existing = records.find((r) => r.url === entry.videoInfo.url);
      if (existing) {
        existing.currentTime = entry.videoInfo.currentTime;
        existing.duration = entry.videoInfo.duration;
        existing.progress = entry.videoInfo.duration > 0
          ? entry.videoInfo.currentTime / entry.videoInfo.duration
          : 0;
        existing.lastWatchedAt = Date.now();
        await StorageManager.saveRecord(existing);
      }
    }
    timers.delete(key);
  }

  /** 保存记录，返回是否为新增 */
  async function saveRecord(
    videoInfo: VideoInfo,
    _accumulated: number
  ): Promise<{ isNew: boolean }> {
    // 使用完整 URL（含 query params）作为记录标识，确保不同视频互不覆盖
    const fullUrl = videoInfo.url;
    const existing = await StorageManager.findRecordByUrl(fullUrl);
    const isNew = !existing;

    const record: WatchRecord = {
      id: existing?.id ?? generateId(),
      url: fullUrl,
      title: videoInfo.title,
      episode: videoInfo.episode,
      seriesName: videoInfo.seriesName,
      platform: videoInfo.platform,
      platformName: videoInfo.platformName,
      currentTime: videoInfo.currentTime,
      duration: videoInfo.duration,
      progress: videoInfo.duration > 0 ? videoInfo.currentTime / videoInfo.duration : 0,
      thumbnail: videoInfo.thumbnail,
      lastWatchedAt: Date.now(),
      createdAt: existing?.createdAt ?? Date.now(),
      notes: existing?.notes,
    };

    await StorageManager.saveRecord(record);
    scheduleAutoSync();
    logger.log(`[VideoTracker] 记录已保存: ${record.title} - ${record.episode}`);
    return { isNew };
  }

  // ===== 消息路由 =====
  chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    const { type, data } = message;

    switch (type) {
      case MSG.HEARTBEAT:
        handleHeartbeat(
          data as VideoInfo,
          sender.tab?.id,
          sender.frameId,
          sender.tab?.url,
          sender.tab?.title
        );
        sendResponse({ ok: true });
        break;

      case MSG.MANUAL_SAVE:
        handleManualSave(
          data as VideoInfo,
          sender.frameId,
          sender.tab?.url,
          sender.tab?.title
        )
          .then(() => sendResponse({ success: true }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;

      case MSG.PAGE_UNLOAD:
        handlePageUnload((data as { url: string }).url);
        sendResponse({ ok: true });
        break;

      // GET_RECORDS 与 GET_ALL_RECORDS 语义一致，统一路由，保留两个常量以兼容现有调用方
      case MSG.GET_RECORDS:
      case MSG.GET_ALL_RECORDS:
        StorageManager.getRecords()
          .then((records) => sendResponse({ records }))
          .catch((err: Error) => sendResponse({ records: [], error: err.message }));
        return true;

      case MSG.DELETE_RECORD:
        StorageManager.deleteRecord((data as { id: string }).id)
          .then(() => sendResponse({ success: true }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;

      case MSG.DELETE_RECORDS:
        StorageManager.deleteRecords((data as { ids: string[] }).ids)
          .then(() => sendResponse({ success: true }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;

      case MSG.GET_SETTINGS:
        StorageManager.getSettings()
          .then((settings) => sendResponse({ settings }))
          .catch((err: Error) => sendResponse({ error: err.message }));
        return true;

      case MSG.UPDATE_SETTINGS:
        StorageManager.updateSettings(data as Partial<import('../src/shared/types').Settings>)
          .then(async () => {
            const partial = data as Partial<import('../src/shared/types').Settings>;
            if (typeof partial.autoRecord === 'boolean') {
              await updateActionState(partial.autoRecord);
            }
            sendResponse({ success: true });
          })
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;

      case MSG.ADD_CUSTOM_SITE:
        StorageManager.addCustomSite((data as { domain: string }).domain)
          .then((customSites) => sendResponse({ success: true, customSites }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;

      case MSG.REMOVE_CUSTOM_SITE:
        StorageManager.removeCustomSite((data as { domain: string }).domain)
          .then((customSites) => sendResponse({ success: true, customSites }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;

      case MSG.GET_CUSTOM_SITES:
        StorageManager.getCustomSites()
          .then((customSites) => sendResponse({ customSites }))
          .catch((err: Error) => sendResponse({ customSites: [], error: err.message }));
        return true;

      case MSG.MANUAL_ADD_RECORD: {
        const { url, title } = data as { url: string; title: string };
        const videoInfo: VideoInfo = {
          url,
          title: title || '未命名视频',
          episode: '正片',
          platform: 'generic',
          platformName: '手动添加',
          currentTime: 0,
          duration: 0,
        };
        saveRecord(videoInfo, 0)
          .then(() => sendResponse({ success: true }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;
      }

      case MSG.INSTALL_MAIN_BRIDGE: {
        const tabId = sender.tab?.id;
        const frameId = sender.frameId;
        const interval = (data as { interval?: number } | undefined)?.interval ?? 5000;
        if (!tabId || frameId === undefined) {
          sendResponse({ success: false, error: 'No tab/frame id' });
          break;
        }

        chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          world: 'MAIN',
          args: [interval],
          func: (bridgeInterval: number) => {
            const w = window as any;
            if (w.__VideoTrackerMainBridgeInstalled) return;
            w.__VideoTrackerMainBridgeInstalled = true;

            function readNumber(value: unknown): number | null {
              return typeof value === 'number' && Number.isFinite(value) ? value : null;
            }

            function callNumber(obj: any, names: string[]): number | null {
              for (const name of names) {
                try {
                  if (typeof obj?.[name] === 'function') {
                    const value = obj[name]();
                    if (typeof value === 'number' && Number.isFinite(value)) return value;
                  }
                } catch {}
              }
              return null;
            }

            function readVideo(video: any) {
              if (!video || typeof video !== 'object') return null;
              const currentTime = readNumber(video.currentTime);
              const duration = readNumber(video.duration);
              if (currentTime === null || duration === null || duration <= 0) return null;
              return {
                currentTime,
                duration,
                paused: !!video.paused,
                title: document.title || '',
                source: 'video',
              };
            }

            function readPlayerObject(obj: any, source: string) {
              if (!obj || typeof obj !== 'object') return null;

              const videoCandidate =
                obj.video || obj.media || obj.el?.querySelector?.('video') ||
                obj.root?.querySelector?.('video') || obj.player?.video;
              const fromVideo = readVideo(videoCandidate);
              if (fromVideo) return { ...fromVideo, source };

              const currentTime =
                readNumber(obj.currentTime) ?? readNumber(obj.current) ??
                callNumber(obj, ['getCurrentTime', 'currentTime', 'getPosition', 'getTime']);
              const duration =
                readNumber(obj.duration) ?? callNumber(obj, ['getDuration', 'duration']);
              if (currentTime === null || duration === null || duration <= 0) return null;

              let paused = false;
              try {
                paused = !!(obj.paused ?? obj.pauseState ?? obj.video?.paused);
              } catch {}

              return {
                currentTime,
                duration,
                paused,
                title: document.title || '',
                source,
              };
            }

            function findKnownPlayer() {
              const names = [
                'player', 'videoPlayer', 'dplayer', 'dp', 'art', 'artplayer',
                'ap', 'xgplayer', 'xgPlayer', 'videojsPlayer', 'jwplayerInstance',
              ];
              for (const name of names) {
                try {
                  const data = readPlayerObject(w[name], name);
                  if (data) return data;
                } catch {}
              }

              try {
                if (typeof w.jwplayer === 'function') {
                  const data = readPlayerObject(w.jwplayer(), 'jwplayer');
                  if (data) return data;
                }
              } catch {}

              try {
                if (w.Artplayer?.instances?.length) {
                  for (const instance of w.Artplayer.instances) {
                    const data = readPlayerObject(instance, 'Artplayer.instances');
                    if (data) return data;
                  }
                }
              } catch {}

              return null;
            }

            function tick() {
              const progress = findKnownPlayer();
              if (!progress || progress.paused) return;
              window.postMessage({
                source: 'VideoTrackerMainBridge',
                type: 'PROGRESS',
                data: progress,
              }, '*');
            }

            window.addEventListener('play', tick, true);
            window.addEventListener('seeked', tick, true);
            window.addEventListener('pause', tick, true);
            setInterval(tick, bridgeInterval);
            setTimeout(tick, 1000);
          },
        })
          .then(() => sendResponse({ success: true }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;
      }

      case MSG.PROBE_IFRAME_VIDEO: {
        const tabId = sender.tab?.id;
        const probeFrameId = (data as { frameId?: number } | undefined)?.frameId;
        if (!tabId) {
          sendResponse({ success: false, error: 'No tab id' });
          break;
        }
        chrome.scripting.executeScript({
          target: probeFrameId !== undefined
            ? { tabId, frameIds: [probeFrameId] }
            : { tabId, allFrames: true },
          func: () => {
            const findVideos = (root: ParentNode = document): HTMLVideoElement[] => {
              const videos = Array.from(root.querySelectorAll('video')) as HTMLVideoElement[];
              const elements = Array.from(root.querySelectorAll('*')) as HTMLElement[];
              for (const el of elements) {
                if (el.shadowRoot) {
                  videos.push(...findVideos(el.shadowRoot));
                }
              }
              return videos;
            };
            const scoreVideo = (video: HTMLVideoElement) => {
              const rect = video.getBoundingClientRect();
              const area = Math.max(video.clientWidth * video.clientHeight, rect.width * rect.height, 0);
              return (video.paused ? 0 : 1_000_000) + (area > 0 ? 10_000 : 0) + area;
            };
            const videos = findVideos();
            const usable = videos.filter((v) => Number.isFinite(v.duration) && v.duration > 0);
            const video = (usable.length > 0 ? usable : videos).sort((a, b) => scoreVideo(b) - scoreVideo(a))[0];
            if (!video || video.duration === 0) return null;
            return {
              currentTime: video.currentTime,
              duration: video.duration,
              paused: video.paused,
              src: video.src || video.currentSrc || '',
              frameUrl: location.href,
              frameTitle: document.title || '',
            };
          },
        })
          .then((results) => {
            const found = results
              ?.filter((r) => r.result !== null && r.result !== undefined)
              .sort((a, b) => {
                const ar = a.result as { paused?: boolean; duration?: number } | undefined;
                const br = b.result as { paused?: boolean; duration?: number } | undefined;
                const score = (r?: { paused?: boolean; duration?: number }) =>
                  (r?.paused ? 0 : 1_000_000) + (r?.duration ?? 0);
                return score(br) - score(ar);
              })[0];
            if (found?.result) {
              sendResponse({ success: true, videoData: found.result, frameId: found.frameId });
            } else {
              sendResponse({ success: false, error: 'No video found in any frame' });
            }
          })
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;
      }

      case 'PROBE_IFRAME_TIME_TEXT': {
        // 在所有 frame 中查找包含时间格式（MM:SS / MM:SS）的文本元素
        const tabId2 = sender.tab?.id;
        const probeFrameId2 = (data as { frameId?: number } | undefined)?.frameId;
        if (!tabId2) {
          sendResponse({ success: false, error: 'No tab id' });
          break;
        }
        chrome.scripting.executeScript({
          target: probeFrameId2 !== undefined
            ? { tabId: tabId2, frameIds: [probeFrameId2] }
            : { tabId: tabId2, allFrames: true },
          func: () => {
            // 查找包含时间格式的元素
            // 常见的播放器时间容器 class/属性
            const selectors = [
              '.art-control-time',
              '.art-control-currentTime',
              '.art-control-totalTime',
              '[class*="time"]',
              '[class*="duration"]',
              '[class*="current"]',
              '.vjs-current-time-display',
              '.vjs-duration-display',
              '.plyr__time',
              '.mejs__currenttime',
              '.mejs__duration',
            ];

            // 先尝试特定选择器
            for (const sel of selectors) {
              const els = document.querySelectorAll(sel);
              for (const el of els) {
                const text = el.textContent?.trim() || '';
                // 检查是否包含时间格式
                if (/\d{1,2}:\d{2}/.test(text)) {
                  return text;
                }
              }
            }

            // 回退：遍历所有文本节点查找时间格式
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null
            );
            let node;
            while ((node = walker.nextNode())) {
              const text = node.textContent?.trim() || '';
              // 匹配 "MM:SS / MM:SS" 或 "MM:SS" 格式
              if (/\d{1,2}:\d{2}\s*[\/|]\s*\d{1,2}:\d{2}/.test(text)) {
                return text;
              }
            }

            // 再宽松一点：只要有 MM:SS 格式
            const walker2 = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null
            );
            const timeTexts: string[] = [];
            while ((node = walker2.nextNode())) {
              const text = node.textContent?.trim() || '';
              if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
                timeTexts.push(text);
              }
            }
            // 如果找到两个独立的时间文本，拼接为 "current / duration"
            if (timeTexts.length >= 2) {
              return `${timeTexts[0]} / ${timeTexts[1]}`;
            }
            if (timeTexts.length === 1) {
              return timeTexts[0];
            }

            return null;
          },
        })
          .then((results) => {
            const found = results?.find((r) => r.result !== null && r.result !== undefined);
            if (found?.result) {
              sendResponse({ success: true, timeText: found.result, frameId: found.frameId });
            } else {
              sendResponse({ success: false, error: 'No time text found' });
            }
          })
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;
      }

      case MSG.PICKER_RESULT: {
        // 选择器选择完成，立即保存一条记录
        const pickerData = data as { selector: string; text: string; currentTime: number; duration: number };
        const tabUrl = sender.tab?.url || '';
        const tabTitle = sender.tab?.title || '未命名视频';
        const videoInfo: VideoInfo = {
          url: tabUrl,
          title: tabTitle,
          episode: '正片',
          platform: 'generic',
          platformName: '手动选择',
          currentTime: pickerData.currentTime,
          duration: pickerData.duration,
        };
        saveRecord(videoInfo, 0)
          .then(() => sendResponse({ success: true }))
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;
      }

      case MSG.AUTH_CALLBACK: {
        const authData = data as { accessToken: string; refreshToken: string; type?: string };
        const tabId = sender.tab?.id;
        logger.log('[VideoTracker] 收到认证回调 token，存储到 AUTH_PENDING');
        chrome.storage.local.set({
          [STORAGE_KEYS.AUTH_PENDING]: {
            accessToken: authData.accessToken,
            refreshToken: authData.refreshToken,
            type: authData.type,
            receivedAt: Date.now(),
          },
        })
          .then(() => {
            sendResponse({ success: true });
            // 存储成功后，跳转到扩展页面完成登录
            if (tabId) {
              chrome.tabs.update(tabId, { url: chrome.runtime.getURL('/options.html') });
            }
          })
          .catch((err: Error) => sendResponse({ success: false, error: err.message }));
        return true;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  });

  // ===== 快捷键监听 =====
  try {
    chrome.commands?.onCommand?.addListener(async (command: string) => {
      if (command === 'manual-save') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: MSG.MANUAL_SAVE_REQUEST }, { frameId: 0 }).catch(() => {});
        }
      }
    });
  } catch {
    // commands API may not be available in all contexts
  }

  chrome.runtime.onInstalled?.addListener(() => {
    void updateActionState();
    scheduleAutoSync();
  });
  chrome.runtime.onStartup?.addListener(() => {
    void updateActionState();
    scheduleAutoSync();
  });
  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const settingsChange = changes[STORAGE_KEYS.SETTINGS];
    const autoRecord = settingsChange?.newValue?.autoRecord;
    if (typeof autoRecord === 'boolean') {
      void updateActionState(autoRecord);
    }
    if (settingsChange?.newValue?.autoSync === true) {
      scheduleAutoSync();
    }
    const authChange = changes[STORAGE_KEYS.AUTH_META];
    if (authChange?.newValue?.isLoggedIn === true) {
      scheduleAutoSync();
    }
  });
  void updateActionState();
  scheduleAutoSync();

  logger.log('[VideoTracker] Background service worker 已启动');
});
