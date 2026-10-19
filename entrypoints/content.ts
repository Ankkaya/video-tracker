import { isSiteAutoRecordEnabled } from '../src/shared/siteRules';
import { isPlaybackPage } from '../src/shared/playbackPage';
import { registry } from '../src/content/adapters/registry';
import { bilibiliAdapter } from '../src/content/adapters/bilibili';
import { youtubeAdapter } from '../src/content/adapters/youtube';
import { iqiyiAdapter } from '../src/content/adapters/iqiyi';
import { vqqAdapter } from '../src/content/adapters/vqq';
import { genericAdapter } from '../src/content/adapters/generic';
import type { VideoAdapter } from '../src/content/adapters/types';
import type { VideoInfo } from '../src/shared/types';
import { MSG, HEARTBEAT_INTERVAL, STORAGE_KEYS } from '../src/shared/constants';
import { logger } from '../src/shared/logger';
import { startPicker, parseTimePair } from '../src/content/picker';
import { findVideoElements } from '../src/content/videoProbe';
import { parseResumeTimeFromUrl } from '../src/shared/resume';
import { mediaSourceId, videoIdentity } from '../src/shared/videoIdentity';

export default defineContentScript({
  matches: ['*://*/*'],
  allFrames: true,
  main() {
    // 注册所有内置适配器
    registry.register(bilibiliAdapter);
    registry.register(youtubeAdapter);
    registry.register(iqiyiAdapter);
    registry.register(vqqAdapter);

    /** 当前是否运行在 iframe 中 */
    const isInIframe = window !== window.top;

    /**
     * 获取顶层页面的域名（用于站点规则匹配）
     * 在 iframe 中时，尝试通过 document.referrer 或 location.ancestorOrigins 获取
     */
    function getTopDomain(): string {
      if (!isInIframe) return location.hostname;
      try {
        // 某些浏览器支持 ancestorOrigins
        if (location.ancestorOrigins && location.ancestorOrigins.length > 0) {
          const topOrigin = location.ancestorOrigins[location.ancestorOrigins.length - 1];
          return new URL(topOrigin).hostname;
        }
      } catch {}
      try {
        // 回退：使用 document.referrer
        if (document.referrer) {
          return new URL(document.referrer).hostname;
        }
      } catch {}
      return location.hostname;
    }

    /**
     * 获取用于记录的页面 URL（顶层页面 URL）
     */
    function getPageUrl(): string {
      if (!isInIframe) return location.href;
      try {
        if (document.referrer) {
          const u = new URL(document.referrer);
          return u.href;
        }
      } catch {}
      return location.href;
    }

    /**
     * 获取用于记录的页面标题
     * iframe 中 document.title 通常为空或无意义，尝试获取顶层标题
     */
    function getPageTitle(): string {
      if (!isInIframe) return document.title?.trim() || '未命名视频';
      // iframe 中无法直接访问 top.document.title（跨域），使用 document.referrer 域名 + iframe 自身 title
      const title = document.title?.trim();
      if (title && title !== '' && !title.startsWith('about:')) return title;
      return '未命名视频';
    }

    let currentAdapter: VideoAdapter | null = null;
    let lastVideoInfo: VideoInfo | null = null;
    let lastVideoSource = '';
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let isActivated = false;
    let lastAutoSavedToastKey = '';
    let lastAutoSavedToastAt = 0;
    let resumeAttemptStarted = false;
    let resumeToastShown = false;
    let mainWorldBridgeEnabled = false;
    let mainWorldBridgeInstalled = false;
    /** 扩展上下文是否已失效（重载/更新/禁用后为 true） */
    let contextInvalidated = false;

    /** 检查扩展上下文是否仍可用 */
    function isExtensionAlive(): boolean {
      try {
        return !!chrome?.runtime?.id;
      } catch {
        return false;
      }
    }

    /** 上下文失效后的全量清理：停掉定时器、解绑 video 事件，避免后续调用继续报错 */
    function teardownOnInvalidated() {
      if (contextInvalidated) return;
      contextInvalidated = true;
      isActivated = false;
      mainWorldBridgeEnabled = false;
      logger.warn('[VideoTracker] 扩展上下文已失效，已停止所有后台任务（请刷新页面恢复）');
      stopHeartbeat();
      stopRetryDetection();
      stopVideoDiscoveryObserver();
    }

    /**
     * 统一的消息发送包装：
     * - context 失效时静默返回 null
     * - 同步/异步异常都吃掉，并触发 teardown
     */
    async function safeSendMessage(message: unknown): Promise<any> {
      if (contextInvalidated || !isExtensionAlive()) {
        teardownOnInvalidated();
        return null;
      }

      try {
        return await chrome.runtime.sendMessage(message);
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes('Extension context invalidated') || !isExtensionAlive()) {
          teardownOnInvalidated();
        }
        return null;
      }
    }

    function enableMainWorldBridge() {
      mainWorldBridgeEnabled = true;
      installMainWorldBridge();
    }

    function installMainWorldBridge() {
      if (mainWorldBridgeInstalled) return;
      mainWorldBridgeInstalled = true;

      window.addEventListener('message', (event) => {
        if (event.source !== window || contextInvalidated || !mainWorldBridgeEnabled) return;
        const payload = event.data;
        if (!payload || payload.source !== 'VideoTrackerMainBridge' || payload.type !== 'PROGRESS') return;
        handleMainWorldProgress(payload.data);
      });

      void safeSendMessage({
        type: MSG.INSTALL_MAIN_BRIDGE,
        data: { interval: HEARTBEAT_INTERVAL },
      });
    }

    function handleMainWorldProgress(data: any) {
      if (!data || currentAdapter?.getVideoElement()) return;
      const currentTime = Number(data.currentTime);
      const duration = Number(data.duration);
      if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return;

      const videoInfo: VideoInfo = {
        url: getPageUrl(),
        title: (data.title || getPageTitle()).trim() || '未命名视频',
        episode: '正片',
        platform: 'generic',
        platformName: '通用',
        currentTime,
        duration,
        mediaId: data.mediaId || mediaSourceId(data.src, data.frameUrl || getPageUrl()),
        event: data.event,
        isPlaying: !data.paused,
      };

      isActivated = true;
      publishProgress(videoInfo);
    }

    let autoRecordAllowed = false;
    let recordingPageUrl = getPageUrl();
    let trackingAllowed = false;
    let matchedKey = '';
    let matchGeneration = 0;

    async function refreshTracking(info = currentAdapter?.extract(), event?: VideoInfo['event']) {
      if (!isPlaybackPage(getPageUrl())) return;
      if (!info || contextInvalidated) return;
      if (lastVideoInfo && videoIdentity(lastVideoInfo).key !== videoIdentity(info).key) flushCurrent('switch');
      const generation = ++matchGeneration;
      const previouslyAllowed = trackingAllowed;
      const previousKey = matchedKey;
      const result = await safeSendMessage({ type: MSG.MATCH_VIDEO, data: info });
      if (generation !== matchGeneration || contextInvalidated) return;
      matchedKey = videoIdentity(info).key;
      trackingAllowed = !!result?.record || (result?.allowNew ?? autoRecordAllowed);
      const player = currentAdapter?.getVideoElement();
      if (trackingAllowed && player && !player.paused) startProgressPolling();
      else clearProgressPolling();
      if (event && trackingAllowed) publishProgress({ ...info, event, isPlaying: event === 'play' });
      else if (trackingAllowed && player && !player.paused && (!previouslyAllowed || previousKey !== matchedKey)) {
        publishProgress({ ...info, event: 'play', isPlaying: true });
      }
    }

    function publishProgress(info: VideoInfo) {
      if (!isPlaybackPage(getPageUrl()) || !isPlaybackPage(info.url)) return;
      const key = videoIdentity(info).key;
      if (lastVideoInfo && videoIdentity(lastVideoInfo).key !== key) flushCurrent('switch');
      lastVideoInfo = info;
      lastVideoSource = boundVideo?.currentSrc || boundVideo?.getAttribute('src') || '';
      if (key !== matchedKey) {
        void refreshTracking(info, info.event ?? (info.isPlaying === false ? 'pause' : 'play'));
        return;
      }
      if (trackingAllowed) void safeSendMessage({ type: MSG.HEARTBEAT, data: info });
    }

    function flushCurrent(event: 'switch' | 'unload') {
      if (!lastVideoInfo) return;
      const info = { ...lastVideoInfo, event, isPlaying: false };
      void safeSendMessage({ type: MSG.PAGE_UNLOAD, data: { url: info.url, info } });
      lastVideoInfo = null;
    }
    let initGeneration = 0;
    async function init() {
      const generation = ++initGeneration;
      autoRecordAllowed = false;
      trackingAllowed = false;
      matchGeneration++;
      stopHeartbeat();
      stopRetryDetection();
      stopVideoDiscoveryObserver();
      mainWorldBridgeEnabled = false;
      isActivated = false;
      currentAdapter = isInIframe ? genericAdapter : registry.detect() ?? genericAdapter;
      // 恢复进度不受自动记录开关影响。
      startResumeAttempt();
      const response = await safeSendMessage({ type: MSG.GET_SETTINGS });
      if (generation !== initGeneration || contextInvalidated) return;
      const settings = response?.settings;
      recordingPageUrl = response?.pageUrl || getPageUrl();
      if (!isPlaybackPage(recordingPageUrl) || !isPlaybackPage(getPageUrl())) return;
      autoRecordAllowed = !!settings?.autoRecord && isSiteAutoRecordEnabled(response.pageUrl || 'https://' + getTopDomain(), settings.siteRules ?? []);

      if (currentAdapter?.getVideoElement()) {
        isActivated = true;
        startHeartbeat({ enableBridge: currentAdapter === genericAdapter });
      } else {
        // 仅在有 iframe 且实际探测到视频时启动持续探测。
        if (!isInIframe && document.querySelector('iframe')) {
          const probe = await safeSendMessage({ type: MSG.PROBE_IFRAME_VIDEO });
          if (generation !== initGeneration) return;
          if (probe?.success && probe.videoData) {
            isActivated = true;
            startIframeProbeHeartbeat();
            return;
          }
        }
        startRetryDetection();
        startVideoDiscoveryObserver();
      }
    }

    /** 重试检测：每2秒检测一次，最多10次 */
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 10;
    const RETRY_INTERVAL = 2000;
    let discoveryObserver: MutationObserver | null = null;

    function startRetryDetection() {
      stopRetryDetection();
      retryCount = 0;
      const frameLabel = isInIframe ? '[iframe]' : '[top]';
      retryTimer = setInterval(async () => {
        retryCount++;
        logger.log(`[VideoTracker]${frameLabel} 重试检测 (${retryCount}/${MAX_RETRIES})...`);

        // 检测当前 video 元素状态
        const videos = findVideoElements();
        logger.log(`[VideoTracker]${frameLabel}   当前 video 数量: ${videos.length}`);

        // 先尝试内置适配器
        if (!isInIframe) {
          currentAdapter = registry.detect();
        }

        if (!currentAdapter) currentAdapter = genericAdapter;

        if (currentAdapter) {
          // 验证是否有 video 元素
          const video = currentAdapter.getVideoElement();
          if (video) {
            logger.log(`[VideoTracker]${frameLabel} ✅ 重试成功！video.duration=${video.duration}, paused=${video.paused}`);
            isActivated = true;
            startHeartbeat({ enableBridge: currentAdapter === genericAdapter });
            stopRetryDetection();
          } else {
            logger.log(`[VideoTracker]${frameLabel}   适配器存在但 getVideoElement() 返回 null`);
            currentAdapter = null;
          }
        }

        if (retryCount >= MAX_RETRIES) {
          logger.log(`[VideoTracker]${frameLabel} ❌ 重试已达最大次数，停止`);
          stopRetryDetection();
        }
      }, RETRY_INTERVAL);
    }

    function stopRetryDetection() {
      if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    }

    /**
     * 持续观察延迟注入的播放器。
     * 很多 iframe 播放器会在反爬/广告/播放器脚本加载后才创建 video，固定次数重试容易错过。
     */
    function startVideoDiscoveryObserver() {
      if (discoveryObserver || contextInvalidated) return;

      discoveryObserver = new MutationObserver((mutations) => {
        if (contextInvalidated) return;
        const hasPlayer = mutations.some(m => [...m.addedNodes, ...m.removedNodes].some(n => n instanceof Element &&
          (n.matches('video, iframe') || n.querySelector('video, iframe') || n.shadowRoot)));
        if (!hasPlayer) return;
        if (isActivated) {
          attachVideoListeners();
          void refreshTracking();
        } else void init();
      });

      discoveryObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    function stopVideoDiscoveryObserver() {
      discoveryObserver?.disconnect();
      discoveryObserver = null;
    }

    /** 当前已绑定 video 事件的元素 */
    let boundVideo: HTMLVideoElement | null = null;

    const videoEvents = ['play', 'pause', 'seeked', 'ended', 'loadedmetadata', 'emptied', 'loadstart'] as const;
    function attachVideoListeners() {
      const video = currentAdapter?.getVideoElement();
      if (!video || video === boundVideo) return;
      if (boundVideo) flushCurrent('switch');
      detachVideoListeners();
      boundVideo = video;
      for (const name of videoEvents) video.addEventListener(name, onVideoMoment);
      video.addEventListener('timeupdate', cacheCurrentPosition);
    }

    function detachVideoListeners() {
      if (!boundVideo) return;
      for (const name of videoEvents) boundVideo.removeEventListener(name, onVideoMoment);
      boundVideo.removeEventListener('timeupdate', cacheCurrentPosition);
      boundVideo = null;
    }

    // No storage or DOM scanning here; keep an accurate old-video snapshot for a switch.
    function cacheCurrentPosition() {
      if (lastVideoInfo && boundVideo && Number.isFinite(boundVideo.duration) && boundVideo.duration > 0) {
        const source = boundVideo.currentSrc || boundVideo.getAttribute('src') || '';
        if (source !== lastVideoSource) return;
        lastVideoInfo = { ...lastVideoInfo, currentTime: boundVideo.currentTime, duration: boundVideo.duration };
      }
    }

    function onVideoMoment(event: Event) {
      if (!currentAdapter || contextInvalidated) return;
      if (event.type === 'emptied' || event.type === 'loadstart') {
        flushCurrent('switch');
        matchedKey = '';
        trackingAllowed = false;
        clearProgressPolling();
        return;
      }
      const videoInfo = currentAdapter.extract();
      if (!videoInfo) return;
      if (event.type === 'loadedmetadata') { void refreshTracking(videoInfo); return; }
      const type = event.type as VideoInfo['event'];
      if (type === 'play') {
        void refreshTracking(videoInfo, 'play');
        return;
      }
      if (boundVideo?.paused || type === 'ended') clearProgressPolling();
      publishProgress({ ...videoInfo, event: type, isPlaying: type === 'seeked' ? !boundVideo?.paused : false });
    }

    function clearProgressPolling() {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    function startProgressPolling() {
      if (heartbeatTimer) return;
      heartbeatTimer = setInterval(() => {
        attachVideoListeners();
        sendHeartbeat();
      }, HEARTBEAT_INTERVAL);
    }

    function formatResumeTime(seconds: number): string {
      const total = Math.max(0, Math.floor(seconds));
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const secs = total % 60;
      if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      return `${minutes}:${String(secs).padStart(2, '0')}`;
    }

    function startResumeAttempt() {
      if (resumeAttemptStarted || isInIframe || contextInvalidated) return;

      const resumeTime = parseResumeTimeFromUrl(location.href);
      if (!resumeTime) return;

      resumeAttemptStarted = true;
      let attempts = 0;
      const maxAttempts = 40;

      const initialUrl = location.href;
      const trySeek = async () => {
        if (contextInvalidated) return;
        if (location.href !== initialUrl) return;
        attempts += 1;

        const video = currentAdapter?.getVideoElement() ?? document.querySelector('video');
        if (video) {
          try {
            const expectedId = new URL(initialUrl).searchParams.get('vt_record');
            if (expectedId) {
              const info = currentAdapter?.extract();
              const match = info && await safeSendMessage({ type: MSG.MATCH_VIDEO, data: info });
              if (location.href !== initialUrl || !match?.record || match.record.id !== expectedId) {
                if (attempts < maxAttempts && location.href === initialUrl) setTimeout(trySeek, 500);
                return;
              }
            }
            const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : resumeTime + 1;
            const target = Math.min(resumeTime, Math.max(duration - 1, 0));
            if (Math.abs(video.currentTime - target) > 2) {
              video.currentTime = target;
            }

            if (!resumeToastShown && Math.abs(video.currentTime - target) <= 3) {
              resumeToastShown = true;
              showToast(`Resume from ${formatResumeTime(target)}`, '▶️');
            }

            if (resumeToastShown) return;
          } catch (error) {
            logger.warn('[VideoTracker] Resume seek failed:', error);
          }
        }

        if (attempts < maxAttempts) {
          setTimeout(trySeek, 500);
        }
      };

      trySeek();
    }

    /** Player listeners stay attached while paused; only playback uses the 5-second poll. */
    function startHeartbeat(options: { enableBridge?: boolean } = {}) {
      stopHeartbeat();
      attachVideoListeners();
      startVideoDiscoveryObserver();
      if (options.enableBridge && !currentAdapter?.getVideoElement()) enableMainWorldBridge();
      startResumeAttempt();
      void refreshTracking(undefined, currentAdapter?.getVideoElement()?.paused ? undefined : 'play');
    }

    /** iframe 探测心跳定时器 */
    let iframeProbeTimer: ReturnType<typeof setInterval> | null = null;
    /** 基于 CSS 选择器的心跳定时器 */
    let selectorHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
    /** iframe 时间文本探测心跳定时器 */
    let iframeTimeProbeTimer: ReturnType<typeof setInterval> | null = null;
    /** 已锁定的播放器 frameId，后续探测优先定向到该 frame */
    let preferredIframeProbeFrameId: number | undefined;

    /** 停止心跳（停止所有模式的定时器） */
    function stopHeartbeat() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      detachVideoListeners();
      if (iframeProbeTimer) {
        clearInterval(iframeProbeTimer);
        iframeProbeTimer = null;
      }
      if (selectorHeartbeatTimer) {
        clearInterval(selectorHeartbeatTimer);
        selectorHeartbeatTimer = null;
      }
      if (iframeTimeProbeTimer) {
        clearInterval(iframeTimeProbeTimer);
        iframeTimeProbeTimer = null;
      }
      preferredIframeProbeFrameId = undefined;
    }

    /**
     * iframe 探测模式心跳：
     * 当顶层页面通过探测发现 iframe 播放器时，
     * 通过 background 的 chrome.scripting.executeScript 探测所有 frame 中的 video
     */
    function startIframeProbeHeartbeat() {
      if (iframeProbeTimer) {
        clearInterval(iframeProbeTimer);
      }
      enableMainWorldBridge();
      preferredIframeProbeFrameId = undefined;
      const frameLabel = '[top/probe]';
      logger.log(`[VideoTracker]${frameLabel} 启动 iframe 探测心跳`);

      iframeProbeTimer = setInterval(async () => {
        if (!isActivated || contextInvalidated) return;

        const response = await safeSendMessage({
          type: MSG.PROBE_IFRAME_VIDEO,
          data: preferredIframeProbeFrameId !== undefined
            ? { frameId: preferredIframeProbeFrameId }
            : undefined,
        });
        if (!response?.success || !response.videoData) {
          logger.log(`[VideoTracker]${frameLabel} 探测: 未找到 video`);
          preferredIframeProbeFrameId = undefined;
          return;
        }
        if (typeof response.frameId === 'number') {
          preferredIframeProbeFrameId = response.frameId;
        }

        const vd = response.videoData;
        // Fallback probes do not always receive media events, so detect their transitions here.

        const title = document.title?.trim() || '未命名视频';
        const currentUrl = getPageUrl();

        const videoInfo: VideoInfo = {
          url: currentUrl,
          title,
          episode: '正片',
          platform: 'generic',
          platformName: '通用',
          currentTime: vd.currentTime,
          duration: vd.duration,
          mediaId: mediaSourceId(vd.src, vd.frameUrl || getPageUrl()),
          isPlaying: !vd.paused,
          event: vd.ended ? 'ended' : vd.paused ? 'pause' : undefined,
        };

        publishProgress(videoInfo);
        logger.log(`[VideoTracker]${frameLabel} 💓 探测心跳: ${title} | ${Math.floor(vd.currentTime)}/${Math.floor(vd.duration)}s`);


      }, HEARTBEAT_INTERVAL);
    }

    /** 发送心跳 */
    function sendHeartbeat() {
      if (!currentAdapter || !isActivated) return;

      const videoInfo = currentAdapter.extract();
      if (!videoInfo) {
        logger.log(`[VideoTracker]${isInIframe ? '[iframe]' : '[top]'} 心跳: extract() 返回 null`);
        return;
      }

      const video = currentAdapter.getVideoElement();
      if (!video || video.paused) return;

      publishProgress({ ...videoInfo, isPlaying: true });
    }

    /** 显示 Toast 提示 */
    function showToast(title: string, prefix = '✅ 已保存') {
      const toast = document.createElement('div');
      toast.textContent = `${prefix}：${title}`;
      Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: '#2ecc71',
        color: '#ffffff',
        padding: '12px 20px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '600',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        zIndex: '2147483647',
        boxShadow: '0 4px 12px rgba(46, 204, 113, 0.4)',
        opacity: '0',
        transform: 'translateY(-10px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        maxWidth: '400px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      });

      document.body.appendChild(toast);

      // Fade in
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
      });

      // Fade out after 2 seconds
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, 2000);
    }

    /** 手动保存 */
    async function handleManualSave() {
      if (contextInvalidated) return { success: false, error: 'PAGE_UNAVAILABLE' };
      if (!isPlaybackPage(getPageUrl()) || !isPlaybackPage(recordingPageUrl)) return { success: false, error: 'NO_VIDEO' };

      let videoInfo = currentAdapter?.extract()
        ?? (!isInIframe ? registry.detect()?.extract() : null)
        ?? genericAdapter.extract();
      // 快捷键发给顶层页面；跨域播放器必须由后台在所有 frame 中探测。
      if (!videoInfo && !isInIframe) {
        const probe = await safeSendMessage({ type: MSG.PROBE_IFRAME_VIDEO });
        if (probe?.success && probe.videoData) {
          const { currentTime, duration } = probe.videoData;
          if (Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0) {
            videoInfo = {
              url: getPageUrl(),
              title: getPageTitle(),
              episode: '正片',
              platform: 'generic',
              platformName: location.hostname,
              currentTime,
              duration,
            };
          }
        }
      }
      if (!videoInfo || !Number.isFinite(videoInfo.duration) || videoInfo.duration <= 0
        || !Number.isFinite(videoInfo.currentTime) || videoInfo.currentTime < 0) {
        return { success: false, error: 'NO_VIDEO' };
      }

      const response = await safeSendMessage({
        type: MSG.MANUAL_SAVE,
        data: videoInfo,
      });
      if (response?.success) {
        void refreshTracking(videoInfo);
        showToast(videoInfo.title);
        return { success: true };
      }
      return { success: false, error: 'SAVE_FAILED' };
    }

    // ===== SPA 路由监听（仅顶层页面，iframe 中不需要） =====
    let lastUrl = location.href;

    async function checkUrlChange() {
      if (location.href !== lastUrl) {
        const oldUrl = lastUrl;
        lastUrl = location.href;

        flushCurrent('switch');

        // 停止当前心跳和激活状态
        if (isActivated) {
          stopHeartbeat();
          isActivated = false;
          currentAdapter = null;
          resumeAttemptStarted = false;
          resumeToastShown = false;
        }

        logger.log(`[VideoTracker] URL 变化: ${oldUrl} -> ${location.href}`);

        // 重新检测适配器（包括重新获取站点规则）
        await init();
      }
    }

    if (!isInIframe) {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = function (...args) {
        originalPushState.apply(this, args);
        checkUrlChange();
      };

      history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        checkUrlChange();
      };

      window.addEventListener('popstate', () => {
        checkUrlChange();
      });
    }

    // ===== 消息监听 =====
    try {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (contextInvalidated) return false;
        try {
          if (message.type === MSG.MANUAL_SAVE_REQUEST) {
            void handleManualSave().then(sendResponse)
              .catch(() => sendResponse({ success: false, error: 'SAVE_FAILED' }));
          } else if (message.type === MSG.AUTO_SAVED) {
            // background 在首次自动落库时通知，弹一次 Toast
            const info = message.data as VideoInfo | undefined;
            const key = info ? `${info.url}|${info.title}` : '';
            const now = Date.now();
            if (info?.title && (key !== lastAutoSavedToastKey || now - lastAutoSavedToastAt > 3000)) {
              lastAutoSavedToastKey = key;
              lastAutoSavedToastAt = now;
              showToast(info.title, '✅ 已自动记录');
            }
            sendResponse({ ok: true });
          } else if (message.type === MSG.START_PICKER) {
            // 启动 DOM 选择器模式
            if (isInIframe) {
              sendResponse({ success: false, error: 'Cannot start picker in iframe' });
              return true;
            }
            startPicker(
              (result) => {
                logger.log('[VideoTracker] 选择器结果:', result);

                if (result.isIframe) {
                  // 用户点击了 iframe 区域 → 启动 iframe 时间探测心跳
                  logger.log('[VideoTracker] 用户选中了 iframe，启动 iframe 时间探测模式');
                  showToast('已锁定播放器区域，正在探测进度...', '🎯');
                  startIframeTimeProbeHeartbeat(result.selector);
                } else {
                  // 用户选中了顶层页面的元素
                  const timePair = parseTimePair(result.text);
                  startSelectorHeartbeat(result.selector);
                  void safeSendMessage({
                    type: MSG.PICKER_RESULT,
                    data: {
                      selector: result.selector,
                      text: result.text,
                      currentTime: timePair?.current ?? 0,
                      duration: timePair?.duration ?? 0,
                    },
                  });
                  showToast(`已锁定时间元素: ${result.text}`, '🎯');
                }
              },
              () => {
                logger.log('[VideoTracker] 选择器已取消');
              }
            );
            sendResponse({ success: true });
          }
        } catch {
          // 处理过程中如果 context 失效，静默处理
        }
        return true;
      });
    } catch {
      // 如果连 addListener 都失败（context 已失效），也静默处理
    }

    /** 基于 CSS 选择器的心跳定时器 — 已在上方声明 */

    /**
     * 基于选择器的心跳模式：
     * 定期读取用户选中的 DOM 元素文本，解析出时间，发送心跳
     */
    function startSelectorHeartbeat(selector: string) {
      // 停止其他心跳模式
      stopHeartbeat();
      enableMainWorldBridge();
      isActivated = true;

      if (selectorHeartbeatTimer) {
        clearInterval(selectorHeartbeatTimer);
      }

      logger.log(`[VideoTracker][selector] 启动选择器心跳, selector: ${selector}`);

      selectorHeartbeatTimer = setInterval(() => {
        if (contextInvalidated) {
          if (selectorHeartbeatTimer) clearInterval(selectorHeartbeatTimer);
          return;
        }

        const el = document.querySelector(selector);
        if (!el) {
          logger.log(`[VideoTracker][selector] 元素未找到: ${selector}`);
          return;
        }

        const text = el.textContent?.trim() || '';
        const timePair = parseTimePair(text);
        if (!timePair) {
          logger.log(`[VideoTracker][selector] 无法解析时间: "${text}"`);
          return;
        }

        const title = document.title?.trim() || '未命名视频';
        const currentUrl = getPageUrl();

        const videoInfo: VideoInfo = {
          url: currentUrl,
          title,
          episode: '正片',
          platform: 'generic',
          platformName: '通用',
          currentTime: timePair.current,
          duration: timePair.duration,
        };

        publishProgress(videoInfo);
        logger.log(`[VideoTracker][selector] 💓 心跳: ${title} | ${Math.floor(timePair.current)}/${Math.floor(timePair.duration)}s`);


      }, HEARTBEAT_INTERVAL);
    }

    /**
     * iframe 时间探测心跳：
     * 用户选中了 iframe 区域后，通过 background 的 chrome.scripting.executeScript
     * 在 iframe 内部查找包含时间文本的元素并解析进度。
     * 同时也尝试直接读取 video.currentTime。
     */

    function startIframeTimeProbeHeartbeat(iframeSelector: string) {
      stopHeartbeat();
      enableMainWorldBridge();
      isActivated = true;
      preferredIframeProbeFrameId = undefined;

      if (iframeTimeProbeTimer) {
        clearInterval(iframeTimeProbeTimer);
      }

      logger.log(`[VideoTracker][iframe-probe] 启动 iframe 时间探测心跳`);

      // 立即执行一次
      void doIframeTimeProbe();

      iframeTimeProbeTimer = setInterval(() => {
        if (contextInvalidated) {
          if (iframeTimeProbeTimer) clearInterval(iframeTimeProbeTimer);
          return;
        }
        void doIframeTimeProbe();
      }, HEARTBEAT_INTERVAL);
    }

    async function doIframeTimeProbe() {
      // 通过 PROBE_IFRAME_VIDEO 让 background 在所有 frame 中执行探测
      // 这次我们不仅查找 video 元素，还查找时间文本
      const response = await safeSendMessage({
        type: MSG.PROBE_IFRAME_VIDEO,
        data: preferredIframeProbeFrameId !== undefined
          ? { frameId: preferredIframeProbeFrameId }
          : undefined,
      });

      let currentTime = 0;
      let duration = 0;
      let found = false;

      if (response?.success && response.videoData) {
        if (typeof response.frameId === 'number') {
          preferredIframeProbeFrameId = response.frameId;
        }
        // 方式1：直接从 video 元素获取（如果 executeScript 能访问到）
        currentTime = response.videoData.currentTime;
        duration = response.videoData.duration;
        found = true;
        logger.log(`[VideoTracker][iframe-probe] 从 video 元素获取: ${Math.floor(currentTime)}/${Math.floor(duration)}s`);
      }

      if (!found) {
        // 方式2：尝试通过 background 在 iframe 中查找时间文本
        const textResponse = await safeSendMessage({
          type: 'PROBE_IFRAME_TIME_TEXT',
          data: preferredIframeProbeFrameId !== undefined
            ? { frameId: preferredIframeProbeFrameId }
            : undefined,
        });
        if (textResponse?.success && textResponse.timeText) {
          if (typeof textResponse.frameId === 'number') {
            preferredIframeProbeFrameId = textResponse.frameId;
          }
          const timePair = parseTimePair(textResponse.timeText);
          if (timePair) {
            currentTime = timePair.current;
            duration = timePair.duration;
            found = true;
            logger.log(`[VideoTracker][iframe-probe] 从时间文本获取: "${textResponse.timeText}" → ${Math.floor(currentTime)}/${Math.floor(duration)}s`);
          }
        }
      }

      if (!found) {
        logger.log(`[VideoTracker][iframe-probe] 未能获取进度`);
        return;
      }

      // 如果 currentTime 没变化（暂停状态），不上报
      if (lastVideoInfo && lastVideoInfo.currentTime === currentTime && currentTime > 0) {
        return;
      }

      const title = document.title?.trim() || '未命名视频';
      const currentUrl = getPageUrl();

      const videoInfo: VideoInfo = {
        url: currentUrl,
        title,
        episode: '正片',
        platform: 'generic',
        platformName: '通用',
        currentTime,
        duration,
      };

      publishProgress(videoInfo);
      logger.log(`[VideoTracker][iframe-probe] 💓 心跳: ${title} | ${Math.floor(currentTime)}/${Math.floor(duration)}s`);


    }

    // Page lifecycle saves are best effort; periodic persistence covers crashes.
    function leavePage() {
      cacheCurrentPosition();
      flushCurrent('unload');
      stopHeartbeat();
    }
    window.addEventListener('beforeunload', leavePage);
    window.addEventListener('pagehide', leavePage);
    window.addEventListener('pageshow', (event) => { if (event.persisted) void init(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && lastVideoInfo) {
        cacheCurrentPosition();
        void safeSendMessage({ type: MSG.HEARTBEAT, data: { ...lastVideoInfo, event: 'pause', isPlaying: !boundVideo?.paused } });
      }
    });

    // ===== 认证回调检测 =====
    (function handleAuthCallback() {
      if (!location.pathname.includes('auth-redirect.html')) return;

      const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (accessToken) {
        logger.log('[VideoTracker] 检测到认证回调，发送 token 到 background');
        void safeSendMessage({
          type: MSG.AUTH_CALLBACK,
          data: { accessToken, refreshToken, type },
        });
      }
    })();

    // ===== 启动 =====
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || contextInvalidated) return;
      if (changes[STORAGE_KEYS.SETTINGS]) {
        const settings = changes[STORAGE_KEYS.SETTINGS].newValue;
        autoRecordAllowed = !!settings?.autoRecord && isSiteAutoRecordEnabled(recordingPageUrl, settings.siteRules ?? []);
      }
      if (changes[STORAGE_KEYS.SETTINGS] || changes[STORAGE_KEYS.RECORDS]) void refreshTracking();
    });
    void init();
  },
});
