import { registry } from '../src/content/adapters/registry';
import { bilibiliAdapter } from '../src/content/adapters/bilibili';
import { youtubeAdapter } from '../src/content/adapters/youtube';
import { iqiyiAdapter } from '../src/content/adapters/iqiyi';
import { vqqAdapter } from '../src/content/adapters/vqq';
import { genericAdapter } from '../src/content/adapters/generic';
import type { VideoAdapter } from '../src/content/adapters/types';
import type { VideoInfo, CustomSite } from '../src/shared/types';
import { MSG, HEARTBEAT_INTERVAL } from '../src/shared/constants';
import { startPicker, parseTimePair } from '../src/content/picker';
import { findVideoElements } from '../src/content/videoProbe';

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
     * 获取顶层页面的域名（用于自定义站点匹配）
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
      if (!isInIframe) return location.origin + location.pathname + location.search;
      try {
        if (document.referrer) {
          const u = new URL(document.referrer);
          return u.origin + u.pathname + u.search;
        }
      } catch {}
      return location.origin + location.pathname + location.search;
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
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let isActivated = false;
    let lastAutoSavedToastKey = '';
    let lastAutoSavedToastAt = 0;
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
      console.warn('[VideoTracker] 扩展上下文已失效，已停止所有后台任务（请刷新页面恢复）');
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
      if (!data || data.paused) return;
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
      };

      isActivated = true;
      lastVideoInfo = videoInfo;
      console.log(`[VideoTracker][main-bridge] 💓 ${data.source || 'player'}: ${Math.floor(currentTime)}/${Math.floor(duration)}s`);
      void safeSendMessage({
        type: MSG.HEARTBEAT,
        data: videoInfo,
      });
    }

    /**
     * 获取当前域名（用于自定义站点匹配，始终使用顶层域名）
     */
    function getCurrentDomain(): string {
      return getTopDomain();
    }

    /**
     * 检查域名是否在自定义站点列表中
     */
    function isInCustomSites(domain: string, customSites: CustomSite[]): boolean {
      return customSites.some(
        (site) => site.enabled !== false && domain.includes(site.domain)
      );
    }

    /** 初始化：获取自定义站点列表并检测适配器 */
    async function init() {
      // 停止之前的重试检测
      stopRetryDetection();
      mainWorldBridgeEnabled = false;

      const frameLabel = isInIframe ? '[iframe]' : '[top]';
      console.log(`[VideoTracker]${frameLabel} === 初始化开始 ===`);
      console.log(`[VideoTracker]${frameLabel} location.href: ${location.href}`);
      console.log(`[VideoTracker]${frameLabel} location.hostname: ${location.hostname}`);
      console.log(`[VideoTracker]${frameLabel} getTopDomain(): ${getTopDomain()}`);
      console.log(`[VideoTracker]${frameLabel} document.referrer: ${document.referrer}`);

      // 检测页面中的 video 元素
      const allVideos = findVideoElements();
      console.log(`[VideoTracker]${frameLabel} 当前文档 video 元素数量: ${allVideos.length}`);
      allVideos.forEach((v, i) => {
        console.log(`[VideoTracker]${frameLabel}   video[${i}]: src=${v.src || v.currentSrc || '(无src)'}, duration=${v.duration}, paused=${v.paused}`);
      });

      // 检测 iframe 数量
      const allIframes = document.querySelectorAll('iframe');
      console.log(`[VideoTracker]${frameLabel} 当前文档 iframe 数量: ${allIframes.length}`);
      allIframes.forEach((iframe, i) => {
        console.log(`[VideoTracker]${frameLabel}   iframe[${i}]: src=${iframe.src || '(无src)'}`);
      });

      // 在 iframe 中时，跳过内置适配器检测（内置适配器基于域名，iframe 域名通常是 CDN）
      if (!isInIframe) {
        // 先尝试用内置适配器检测
        currentAdapter = registry.detect();

        if (currentAdapter) {
          // 内置站点匹配成功
          console.log(`[VideoTracker]${frameLabel} ✅ 内置适配器匹配: ${currentAdapter.platformName}`);
          isActivated = true;
          startHeartbeat();
          return;
        }
        console.log(`[VideoTracker]${frameLabel} ❌ 内置适配器未匹配`);
      } else {
        console.log(`[VideoTracker]${frameLabel} 跳过内置适配器检测（在 iframe 中）`);
      }

      // 内置适配器未匹配（或在 iframe 中），检查自定义站点
      const response = await safeSendMessage({ type: MSG.GET_CUSTOM_SITES });
      const customSites: CustomSite[] = response?.customSites ?? [];
      console.log(`[VideoTracker]${frameLabel} 自定义站点列表:`, customSites.map(s => `${s.domain}(${s.enabled !== false ? '启用' : '禁用'})`));

      const domain = getCurrentDomain();
      console.log(`[VideoTracker]${frameLabel} 用于匹配的域名: ${domain}`);

      if (isInCustomSites(domain, customSites)) {
        // 注册并使用通用适配器
        currentAdapter = genericAdapter;
        const video = currentAdapter.getVideoElement();
        console.log(`[VideoTracker]${frameLabel} ✅ 自定义站点匹配成功: ${domain}`);
        console.log(`[VideoTracker]${frameLabel} genericAdapter.getVideoElement(): ${video ? '找到 video' : '未找到 video'}`);
        if (video) {
          console.log(`[VideoTracker]${frameLabel}   video.src: ${video.src || video.currentSrc || '(无src)'}`);
          console.log(`[VideoTracker]${frameLabel}   video.duration: ${video.duration}`);
          console.log(`[VideoTracker]${frameLabel}   video.currentTime: ${video.currentTime}`);
          console.log(`[VideoTracker]${frameLabel}   video.paused: ${video.paused}`);
          isActivated = true;
          startHeartbeat({ enableBridge: true });
        } else {
          // 本地没有 video，尝试通过 background 探测 iframe 中的 video
          console.log(`[VideoTracker]${frameLabel} 本地无 video，启动 iframe 探测模式...`);
          isActivated = true;
          startIframeProbeHeartbeat();
        }
        return;
      }

      // iframe 中如果顶层域名匹配自定义站点，也尝试用通用适配器（直接检测 video）
      if (isInIframe) {
        console.log(`[VideoTracker]${frameLabel} 顶层域名未匹配，尝试 iframe 自身域名...`);
        const video = genericAdapter.getVideoElement();
        console.log(`[VideoTracker]${frameLabel} iframe 内 genericAdapter.getVideoElement(): ${video ? '找到 video' : '未找到 video'}`);
        if (video) {
          // iframe 内有 video 元素，检查顶层域名是否在自定义站点中
          // 这里 domain 已经是 getTopDomain() 的结果
          // 如果顶层域名不在列表中，再用 iframe 自身域名试一次
          const iframeDomain = location.hostname;
          console.log(`[VideoTracker]${frameLabel} iframe 自身域名: ${iframeDomain}`);
          if (isInCustomSites(iframeDomain, customSites)) {
            currentAdapter = genericAdapter;
            console.log(`[VideoTracker]${frameLabel} ✅ iframe 域名匹配成功: ${iframeDomain}`);
            isActivated = true;
            startHeartbeat({ enableBridge: true });
            return;
          }
          console.log(`[VideoTracker]${frameLabel} ❌ iframe 域名也未匹配自定义站点`);
          // 新增：如果 iframe 中有 video 且顶层域名在自定义站点中（通过 referrer 判断），直接激活
          console.log(`[VideoTracker]${frameLabel} 🔄 尝试无条件激活（iframe 中有 video 元素）...`);
          currentAdapter = genericAdapter;
          isActivated = true;
          startHeartbeat({ enableBridge: true });
          return;
        }
      }

      // 不在任何列表中，不激活
      if (!isInIframe) {
        console.log(`[VideoTracker]${frameLabel} ❌ 当前站点不在支持列表中，不激活: ${getCurrentDomain()}`);
      } else {
        console.log(`[VideoTracker]${frameLabel} ❌ iframe 中未找到 video 元素，不激活`);
      }

      // 启动重试机制：每2秒检测一次，最多重试10次（20秒）
      // 用于 WAF 验证页跳转到视频页面后 video 元素延迟加载的场景
      startRetryDetection();
      startVideoDiscoveryObserver();
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
        console.log(`[VideoTracker]${frameLabel} 重试检测 (${retryCount}/${MAX_RETRIES})...`);

        // 检测当前 video 元素状态
        const videos = findVideoElements();
        console.log(`[VideoTracker]${frameLabel}   当前 video 数量: ${videos.length}`);

        // 先尝试内置适配器
        if (!isInIframe) {
          currentAdapter = registry.detect();
        }

        if (!currentAdapter) {
          // 再尝试自定义站点
          const response = await safeSendMessage({ type: MSG.GET_CUSTOM_SITES });
          const customSites: CustomSite[] = response?.customSites ?? [];
          const domain = getCurrentDomain();
          if (isInCustomSites(domain, customSites)) {
            currentAdapter = genericAdapter;
          } else if (isInIframe) {
            // iframe 中：如果有 video 元素就直接用通用适配器
            if (videos.length > 0) {
              console.log(`[VideoTracker]${frameLabel}   iframe 中发现 video，无条件激活`);
              currentAdapter = genericAdapter;
            }
          }
        }

        if (currentAdapter) {
          // 验证是否有 video 元素
          const video = currentAdapter.getVideoElement();
          if (video) {
            console.log(`[VideoTracker]${frameLabel} ✅ 重试成功！video.duration=${video.duration}, paused=${video.paused}`);
            isActivated = true;
            startHeartbeat({ enableBridge: currentAdapter === genericAdapter });
            stopRetryDetection();
            stopVideoDiscoveryObserver();
          } else {
            console.log(`[VideoTracker]${frameLabel}   适配器存在但 getVideoElement() 返回 null`);
            currentAdapter = null;
          }
        }

        if (retryCount >= MAX_RETRIES) {
          console.log(`[VideoTracker]${frameLabel} ❌ 重试已达最大次数，停止`);
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

      discoveryObserver = new MutationObserver(() => {
        if (isActivated || contextInvalidated) return;
        if (findVideoElements().length === 0) return;
        void init();
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

    /** 在 video 元素上绑定 pause/seeked 监听，确保关键节点立即上报最新进度 */
    function attachVideoListeners() {
      if (!currentAdapter) return;
      const video = currentAdapter.getVideoElement();
      if (!video || video === boundVideo) return;
      detachVideoListeners();
      boundVideo = video;
      video.addEventListener('pause', onVideoMoment);
      video.addEventListener('seeked', onVideoMoment);
    }

    function detachVideoListeners() {
      if (!boundVideo) return;
      boundVideo.removeEventListener('pause', onVideoMoment);
      boundVideo.removeEventListener('seeked', onVideoMoment);
      boundVideo = null;
    }

    /** pause/seeked 时立即上报一次最新进度 */
    function onVideoMoment() {
      if (!currentAdapter || !isActivated || contextInvalidated) return;
      const videoInfo = currentAdapter.extract();
      if (!videoInfo) return;
      lastVideoInfo = videoInfo;
      void safeSendMessage({ type: MSG.HEARTBEAT, data: videoInfo });
    }

    /** 启动心跳 */
    function startHeartbeat(options: { enableBridge?: boolean } = {}) {
      stopVideoDiscoveryObserver();
      stopHeartbeat();
      if (options.enableBridge) enableMainWorldBridge();
      attachVideoListeners();
      heartbeatTimer = setInterval(() => {
        // 适配器可能在 SPA 切换后被替换；每次尝试重新绑定
        attachVideoListeners();
        sendHeartbeat();
      }, HEARTBEAT_INTERVAL);
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
     * 当顶层页面匹配自定义站点但本地没有 video 时，
     * 通过 background 的 chrome.scripting.executeScript 探测所有 frame 中的 video
     */
    function startIframeProbeHeartbeat() {
      if (iframeProbeTimer) {
        clearInterval(iframeProbeTimer);
      }
      enableMainWorldBridge();
      preferredIframeProbeFrameId = undefined;
      const frameLabel = '[top/probe]';
      console.log(`[VideoTracker]${frameLabel} 启动 iframe 探测心跳`);

      iframeProbeTimer = setInterval(async () => {
        if (!isActivated || contextInvalidated) return;

        const response = await safeSendMessage({
          type: MSG.PROBE_IFRAME_VIDEO,
          data: preferredIframeProbeFrameId !== undefined
            ? { frameId: preferredIframeProbeFrameId }
            : undefined,
        });
        if (!response?.success || !response.videoData) {
          console.log(`[VideoTracker]${frameLabel} 探测: 未找到 video`);
          preferredIframeProbeFrameId = undefined;
          return;
        }
        if (typeof response.frameId === 'number') {
          preferredIframeProbeFrameId = response.frameId;
        }

        const vd = response.videoData;
        // 视频暂停时不上报
        if (vd.paused) return;

        const title = document.title?.trim() || '未命名视频';
        const currentUrl = location.origin + location.pathname + location.search;

        const videoInfo: VideoInfo = {
          url: currentUrl,
          title,
          episode: '正片',
          platform: 'generic',
          platformName: '通用',
          currentTime: vd.currentTime,
          duration: vd.duration,
        };

        lastVideoInfo = videoInfo;
        console.log(`[VideoTracker]${frameLabel} 💓 探测心跳: ${title} | ${Math.floor(vd.currentTime)}/${Math.floor(vd.duration)}s`);

        void safeSendMessage({
          type: MSG.HEARTBEAT,
          data: videoInfo,
        });
      }, HEARTBEAT_INTERVAL);
    }

    /** 发送心跳 */
    function sendHeartbeat() {
      if (!currentAdapter || !isActivated) return;

      const videoInfo = currentAdapter.extract();
      if (!videoInfo) {
        console.log(`[VideoTracker]${isInIframe ? '[iframe]' : '[top]'} 心跳: extract() 返回 null`);
        return;
      }

      const video = currentAdapter.getVideoElement();
      if (!video || video.paused) return;

      lastVideoInfo = videoInfo;
      console.log(`[VideoTracker]${isInIframe ? '[iframe]' : '[top]'} 💓 心跳: ${videoInfo.title} | ${Math.floor(videoInfo.currentTime)}/${Math.floor(videoInfo.duration)}s | url=${videoInfo.url.substring(0, 80)}`);

      void safeSendMessage({
        type: MSG.HEARTBEAT,
        data: videoInfo,
      });
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
      if (contextInvalidated) return;

      const videoInfo = currentAdapter?.extract() ?? lastVideoInfo;
      if (!videoInfo) return;

      const response = await safeSendMessage({
        type: MSG.MANUAL_SAVE,
        data: videoInfo,
      });
      if (response?.success) {
        showToast(videoInfo.title);
      }
    }

    // ===== SPA 路由监听（仅顶层页面，iframe 中不需要） =====
    let lastUrl = location.href;

    async function checkUrlChange() {
      if (location.href !== lastUrl) {
        const oldUrl = lastUrl;
        lastUrl = location.href;

        // 如果之前是激活状态，先发送 PAGE_UNLOAD
        if (isActivated && lastVideoInfo) {
          void safeSendMessage({
            type: MSG.PAGE_UNLOAD,
            data: { url: lastVideoInfo.url },
          });
        }

        // 停止当前心跳和激活状态
        if (isActivated) {
          stopHeartbeat();
          isActivated = false;
          currentAdapter = null;
        }

        console.log(`[VideoTracker] URL 变化: ${oldUrl} -> ${location.href}`);

        // 重新检测适配器（包括重新获取自定义站点列表）
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
            void handleManualSave();
            sendResponse({ success: true });
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
                console.log('[VideoTracker] 选择器结果:', result);

                if (result.isIframe) {
                  // 用户点击了 iframe 区域 → 启动 iframe 时间探测心跳
                  console.log('[VideoTracker] 用户选中了 iframe，启动 iframe 时间探测模式');
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
                console.log('[VideoTracker] 选择器已取消');
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

      console.log(`[VideoTracker][selector] 启动选择器心跳, selector: ${selector}`);

      selectorHeartbeatTimer = setInterval(() => {
        if (contextInvalidated) {
          if (selectorHeartbeatTimer) clearInterval(selectorHeartbeatTimer);
          return;
        }

        const el = document.querySelector(selector);
        if (!el) {
          console.log(`[VideoTracker][selector] 元素未找到: ${selector}`);
          return;
        }

        const text = el.textContent?.trim() || '';
        const timePair = parseTimePair(text);
        if (!timePair) {
          console.log(`[VideoTracker][selector] 无法解析时间: "${text}"`);
          return;
        }

        const title = document.title?.trim() || '未命名视频';
        const currentUrl = location.origin + location.pathname + location.search;

        const videoInfo: VideoInfo = {
          url: currentUrl,
          title,
          episode: '正片',
          platform: 'generic',
          platformName: '通用',
          currentTime: timePair.current,
          duration: timePair.duration,
        };

        lastVideoInfo = videoInfo;
        console.log(`[VideoTracker][selector] 💓 心跳: ${title} | ${Math.floor(timePair.current)}/${Math.floor(timePair.duration)}s`);

        void safeSendMessage({
          type: MSG.HEARTBEAT,
          data: videoInfo,
        });
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

      console.log(`[VideoTracker][iframe-probe] 启动 iframe 时间探测心跳`);

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
        console.log(`[VideoTracker][iframe-probe] 从 video 元素获取: ${Math.floor(currentTime)}/${Math.floor(duration)}s`);
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
            console.log(`[VideoTracker][iframe-probe] 从时间文本获取: "${textResponse.timeText}" → ${Math.floor(currentTime)}/${Math.floor(duration)}s`);
          }
        }
      }

      if (!found) {
        console.log(`[VideoTracker][iframe-probe] 未能获取进度`);
        return;
      }

      // 如果 currentTime 没变化（暂停状态），不上报
      if (lastVideoInfo && lastVideoInfo.currentTime === currentTime && currentTime > 0) {
        return;
      }

      const title = document.title?.trim() || '未命名视频';
      const currentUrl = location.origin + location.pathname + location.search;

      const videoInfo: VideoInfo = {
        url: currentUrl,
        title,
        episode: '正片',
        platform: 'generic',
        platformName: '通用',
        currentTime,
        duration,
      };

      lastVideoInfo = videoInfo;
      console.log(`[VideoTracker][iframe-probe] 💓 心跳: ${title} | ${Math.floor(currentTime)}/${Math.floor(duration)}s`);

      void safeSendMessage({
        type: MSG.HEARTBEAT,
        data: videoInfo,
      });
    }

    // ===== 页面卸载 =====
    window.addEventListener('beforeunload', () => {
      if (lastVideoInfo && isActivated && !contextInvalidated) {
        void safeSendMessage({
          type: MSG.PAGE_UNLOAD,
          data: { url: lastVideoInfo.url },
        });
      }
      stopHeartbeat();
    });

    // ===== 启动 =====
    init();
  },
});
