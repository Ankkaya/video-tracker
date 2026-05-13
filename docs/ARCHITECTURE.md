# VideoTracker 架构设计

## 技术选型
- 构建: WXT
- 前端: Vue 3 + TypeScript
- CSS: UnoCSS
- 存储: chrome.storage.local

## 目录结构
src/
├── background/index.ts      # Service Worker
├── content/
│   ├── index.ts             # Content Script
│   └── adapters/            # 适配器
│       ├── types.ts         # VideoAdapter 接口
│       ├── registry.ts      # 注册中心
│       ├── bilibili.ts
│       ├── youtube.ts
│       ├── iqiyi.ts
│       └── vqq.ts
├── popup/                   # Popup UI (Vue3)
│   ├── App.vue
│   └── components/
├── options/                 # 设置页面
│   └── App.vue
└── shared/                  # 共享模块
    ├── types.ts
    ├── constants.ts
    ├── messages.ts
    └── storage.ts

## 核心设计
1. 适配器模式 - 每平台一个Adapter，统一VideoAdapter接口
2. 阈值计时 - Content Script每5秒心跳，Background累计计时
3. SPA监听 - pushState + popstate + MutationObserver
4. 快捷键 - Ctrl+Shift+V 手动记录
5. 通信 - HEARTBEAT / MANUAL_SAVE / PAGE_UNLOAD / VIDEO_CHANGED
