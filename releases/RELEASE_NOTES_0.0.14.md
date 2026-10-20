VideoTracker 0.0.14 · 2026-10-20

保存跨网站视频进度，下次接着看。本地记录无需账号，可选端到端加密同步。

本次更新：
- 持续更新已有记录，按实际播放时长判断新增阈值，在暂停、结束及切换视频时及时保存。
- 新增观看中／已看完分类，支持手动标记完成、继续观看及从头重新观看；弹窗聚焦未看完的视频。
- 增加四步首次使用引导、站点图标，优化记录管理页、快捷键设置和弹窗布局。
- 统一视频与分集身份匹配，恢复进度前校验记录，过滤主流平台非播放页面。
- 更新 Chrome／Edge 中英文商店素材、官网及 GitHub README。

安装：下载 video-tracker-0.0.14-chrome-mv3.zip，解压后在 Chrome 或 Edge 扩展管理页开启开发者模式，加载解压目录。已有用户请替换扩展目录并重新加载；安装或更新后刷新已打开的视频页。

自动记录默认关闭。手动保存不受自动记录或站点排除影响；已有记录仍会跟踪。播放器兼容性取决于网站实现。云同步与插件内反馈为可选功能。本次 GitHub Release 不代表已在 Chrome／Edge 商店上架。

验证：276 项测试、TypeScript 检查、生产构建与 ZIP 完整性检查通过。
SHA-256：`e40ac443423b4618ea628c484e16b5bc2b1f8611d3b2034324d0ab00be3e8903`

English:
- Continuous progress tracking, actual-playback thresholds for new records, and saves on pause, end and video switches.
- Watching / Completed views, manual completion controls, resume and watch-again actions; the popup focuses on unfinished videos.
- Four-step first-use tour, site icons, refreshed record actions, shortcut settings and popup.
- Unified video/episode matching and validation before resume; playback-page filtering for supported platforms.
- Refreshed bilingual store materials, website and README.

The ZIP supports Chrome and Edge. Extract it and load the directory in developer mode. Automatic recording is off by default. Existing records keep tracking even when automatic additions are off or a site is excluded. Player compatibility varies. Publishing this release does not submit it to either extension store.
