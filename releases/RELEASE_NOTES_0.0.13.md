VideoTracker 0.0.13 保存和恢复跨网站的视频观看进度，本地功能无需账号，可选端到端加密云同步。

本次更新：

- 新增插件内问题反馈：最多 500 字，可附一张不超过 5 MB 的 PNG/JPG/WebP 图片及联系邮箱。首次提交前确认用途，提交失败保留草稿，登录邮箱预填后仍可修改或清空。
- 站点过滤改为排除名单：支持域名或网页链接及子域名匹配。加入名单停止自动记录，移出后恢复，已有记录保留，手动保存仍可使用。
- 简化弹窗与记录管理页的搜索，支持标题、分集信息及日期筛选和批量删除；优化同步状态、快捷键说明、中英文布局及隐私披露。
- 同步更新中英文官网、README、Chrome 和 Edge 商店资料及实际界面截图。

安装：下载 `video-tracker-0.0.13-chrome-mv3.zip`，解压后在 Chrome 或 Edge 的扩展管理页开启开发者模式，加载解压目录。已有用户更新后重新加载扩展。

自动记录默认关闭，请在设置中主动开启。反馈独立于加密同步，确认后供开发者阅读处理；图片私有存储，不自动附带观看记录或账号令牌。

验证：178 项测试、TypeScript 类型检查、生产构建及 ZIP 完整性校验通过。包内 27 个文件与生产构建逐一一致。

SHA-256：`27bc36c06bc18aa13d16fb4f6f4ce9aae858837bac8c0b9acff4a87bc3f025b8`

English:

- New in-extension feedback: up to 500 characters, one optional PNG/JPG/WebP image up to 5 MB and optional email, with first-submission consent and draft-preserving retries.
- Domain or webpage URL exclusions cover subdomains, preserve existing records and leave manual saving available.
- Simplified search, viewing-date filters and batch deletion, plus improved sync status, shortcut guidance and bilingual privacy materials.

The Chrome MV3 ZIP works in Chrome and Edge. Extract it and load the directory in developer mode. Automatic recording is off by default. Feedback is readable developer support data, separately from end-to-end encrypted viewing-record sync.
