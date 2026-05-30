# VideoTracker - 视频观看进度记录器

一款浏览器扩展，自动记录你在 B站、YouTube、爱奇艺、腾讯视频等平台的视频观看进度，支持一键跳转继续观看，并可登录账号在多设备间同步记录。

## 功能特性

- **自动记录** — 访问支持的视频平台播放页面时，自动提取视频信息并记录观看进度
- **阈值过滤** — 默认观看满 30 秒才自动记录，避免短暂浏览产生无效记录
- **手动记录** — 按快捷键立即记录当前视频，无需等待阈值
- **记录列表** — 点击插件图标查看所有记录，按最近观看时间排序
- **一键跳转** — 点击记录直接打开对应页面并定位到上次播放位置
- **搜索筛选** — 支持关键词搜索、按平台筛选记录
- **登录同步** — 可登录账号将观看记录同步到云端，在多台设备间保持一致
- **删除记录** — 可删除单条记录
- **灵活设置** — 自动记录开关、阈值时间自定义（0/10/30/60/120 秒）

## 安装方法

### 开发者模式加载（推荐）

1. 下载或构建项目，获取 `.output/chrome-mv3/` 目录
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择项目中的 `.output/chrome-mv3/` 目录
6. 扩展安装完成，工具栏会出现 VideoTracker 图标

### 从构建产物安装

如果你已经通过 `npm run build` 构建了项目，构建产物位于 `.output/chrome-mv3/`，直接按上述步骤加载即可。

## 使用说明

### 自动记录

安装后，VideoTracker 会自动监听你访问的视频页面：

1. 打开 B站、YouTube、爱奇艺或腾讯视频的任意视频播放页
2. 开始观看视频
3. 观看时间达到阈值（默认 30 秒）后，视频信息和播放进度会自动记录
4. 记录包括：视频标题、平台、封面、当前播放时间、记录时间

### 手动记录

如果你想立即记录当前视频，无需等待阈值：

- 按快捷键 `Ctrl+Shift+V`（Mac: `Cmd+Shift+V`）
- 当前视频会立即被记录，包括标题、进度等信息

### 查看记录

1. 点击浏览器工具栏中的 VideoTracker 图标
2. 弹出窗口中显示所有记录的视频列表
3. 列表按最近观看时间排序，最新的在最上面
4. 每条记录显示：视频标题、平台图标、观看进度、记录时间

### 跳转继续观看

1. 在记录列表中找到想继续观看的视频
2. 点击该记录
3. 浏览器会自动打开对应视频页面，并定位到上次播放位置

### 搜索筛选

在 Popup 顶部的搜索栏中：

- **关键词搜索** — 输入视频标题关键词，实时过滤记录
- **平台筛选** — 选择特定平台（B站/YouTube/爱奇艺/腾讯视频），只显示该平台的记录

### 登录与同步

VideoTracker 支持可选的云同步能力：

1. 在 Popup 或选项页点击登录入口
2. 使用账号登录后，当前本地记录可同步到云端
3. 在另一台设备安装扩展并登录同一账号
4. 点击同步后即可拉取云端记录，继续从上次进度观看

同步功能默认不会开启；未登录时，记录仍只保存在当前浏览器本地。你可以在同步弹窗中手动触发上传、下载或双向同步。

### 设置

点击 Popup 中的设置图标或右键扩展图标选择"选项"：

- **自动记录开关** — 开启/关闭自动记录功能
- **阈值设置** — 设置自动记录的观看时长阈值：
  - `0 秒` — 立即记录（相当于始终手动记录）
  - `10 秒` — 观看 10 秒后自动记录
  - `30 秒` — 观看 30 秒后自动记录（默认）
  - `60 秒` — 观看 1 分钟后自动记录
  - `120 秒` — 观看 2 分钟后自动记录
- **快捷键说明** — 显示当前可用的快捷键

## 支持的平台

| 平台 | 网址 | 说明 |
|------|------|------|
| B站 | bilibili.com | 支持番剧、视频、电影等 |
| YouTube | youtube.com | 支持普通视频、Shorts 等 |
| 爱奇艺 | iqiyi.com | 支持电影、电视剧、综艺等 |
| 腾讯视频 | v.qq.com | 支持电影、电视剧、综艺等 |

## 快捷键说明

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+V` | 立即记录当前视频（Mac: `Cmd+Shift+V`） |

> 快捷键可在 `chrome://extensions/shortcuts` 中自定义修改。

## 隐私说明

VideoTracker 高度重视你的隐私：

- **默认本地存储** — 未登录时，所有数据存储在浏览器本地（`chrome.storage.local`）
- **同步需主动登录** — 只有登录并触发同步时，观看记录才会发送到配置的 Supabase 项目
- **不收集数据** — 不收集、不传输、不分析你的任何个人信息或浏览数据
- **权限最小化** — 仅请求必要的浏览器权限，不获取多余权限
- **可控删除** — 可删除本地记录，也可通过同步设置管理云端数据

如果不使用登录同步，你的观看记录只存在于当前浏览器本地。

## 技术栈

- **框架**: [WXT](https://wxt.dev/) — 下一代浏览器扩展开发框架
- **前端**: [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **状态管理**: Vue 3 Composition API
- **存储**: Chrome Storage API (`chrome.storage.local`)
- **云同步**: Supabase Auth + Database
- **构建工具**: Vite（WXT 内置）

## 开发指南

### 环境要求

- Node.js >= 18
- npm 或 pnpm

### 安装依赖

```bash
cd video-tracker
npm install
```

### 开发模式

```bash
npm run dev
```

启动后会自动打开 Chrome 并加载扩展，修改代码后自动热更新。

### 构建

```bash
npm run build
```

构建产物位于 `.output/chrome-mv3/`，可直接在 Chrome 中加载。

### 添加新平台适配器

VideoTracker 使用适配器模式支持多平台，添加新平台只需以下步骤：

#### 1. 创建平台适配器文件

在 `src/adapters/` 目录下创建新文件，例如 `douyin.ts`：

```typescript
import { VideoAdapter } from './types'

export const douyinAdapter: VideoAdapter = {
  platform: 'douyin',
  platformName: '抖音',
  platformIcon: '🎵',
  
  // URL 匹配规则
  match(url: string): boolean {
    return url.includes('douyin.com/video/')
  },
  
  // 提取视频信息
  async extractVideoInfo(): Promise<VideoInfo | null> {
    const title = document.querySelector('.video-info-detail')?.textContent
    const video = document.querySelector('video')
    if (!title || !video) return null
    
    return {
      title: title.trim(),
      platform: 'douyin',
      url: window.location.href,
      currentTime: video.currentTime,
      duration: video.duration,
      timestamp: Date.now(),
    }
  },
  
  // 跳转到指定进度
  seekTo(time: number): void {
    const video = document.querySelector('video')
    if (video) {
      video.currentTime = time
    }
  }
}
```

#### 2. 注册适配器

在 `src/adapters/index.ts` 中导入并注册：

```typescript
import { douyinAdapter } from './douyin'

export const adapters = [
  bilibiliAdapter,
  youtubeAdapter,
  iqiyiAdapter,
  qqliveAdapter,
  douyinAdapter,  // 新增
]
```

#### 3. 测试

运行 `npm run dev`，访问新平台的视频页面，验证：
- 视频信息能否正确提取
- 播放进度能否正确记录
- 跳转功能是否正常

## 许可证

MIT License
