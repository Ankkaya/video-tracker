# Chrome Web Store / Edge Add-ons 上架资料

适用版本：`0.0.13`。更新日期：2026-10-13。[GitHub Release](https://github.com/Ankkaya/video-tracker/releases/tag/v0.0.13) 已发布。Edge 已提交审核（In review）；Chrome 后台访问被浏览器工具拒绝，未上传或提交。实际商店状态以各自 `output/*-store/submission-status.json` 和后台为准。

以下中英文介绍可用于商店详情页。简短描述与 `public/_locales` 中的扩展描述保持一致；隐私摘要以仓库根目录的 `PRIVACY_POLICY.md` 为准。

## 扩展名称

- 中文：VideoTracker - 视频观看进度记录器
- 英文：VideoTracker

## 简短描述

### 中文

记录 B站、YouTube 等视频网站的观看进度，一键继续观看。默认本地存储，无需账号；可选端到端加密云同步。

### English

Save and resume video progress across sites. Local storage, no account required. Optional end-to-end encrypted cloud sync.

## 详细描述（中文）

VideoTracker 帮你保存跨网站的视频观看进度，下次从上次看到的位置继续观看。本地记录无需注册或登录，也可选择登录后使用端到端加密云同步，在多台设备之间同步记录。

主要功能

• 自动记录：在设置中开启自动记录后，达到设定的观看时长即可保存视频信息和播放进度。自动记录默认关闭，默认时长阈值为 30 秒，可选 0、10、30、60 或 120 秒。
• 手动保存：使用快捷键 Ctrl+Shift+V（Mac：Command+Shift+V）保存当前视频进度，无需等待自动记录阈值。快捷键可在浏览器的扩展快捷键设置中调整。
• 继续观看：点击记录打开对应视频页面，在支持的播放器中恢复上次播放位置。
• 查找记录：在弹窗按标题搜索，在完整记录页按标题、分集信息和观看日期筛选，支持单条和批量删除。
• 站点过滤：支持 B站、YouTube、爱奇艺、腾讯视频，并尝试识别其他兼容的 HTML5 视频网站。输入域名或网页链接加入排除名单，可停止该域名及子域名的自动记录，保留已有记录。移出名单后恢复自动记录；全局自动记录仍需开启。手动保存不受排除名单影响。识别和恢复进度取决于网站与播放器的实现。
• 可选加密同步：登录并开启云同步或执行手动同步时，观看记录和站点规则先在设备端加密，再上传。换设备后输入同步加密密码即可解锁。
• 界面与反馈：支持中文、英文以及浅色、深色或跟随系统主题。从弹窗或选项页进入“反馈问题”，可填写最多 500 字，并附一张不超过 5 MB 的 PNG/JPG/WebP 图片及联系邮箱；无需登录。

数据与隐私

观看记录默认保存在当前浏览器本地，本地功能无需账号。注册或登录时，认证服务会处理邮箱、账号和会话信息。可选云同步使用开发者配置的 Supabase 服务，保存账号元数据、加密后的同步数据及密钥相关信息。同步加密密码不会上传，当前设备会在本地记住同步数据密钥。

加密保护同步记录的内容，不隐藏服务提供方正常处理的账号或连接信息。即使未开启同步，加载远程视频封面也可能向图片提供方发送 IP 地址及请求的图片网址。VideoTracker 不使用广告追踪或分析服务，不出售用户数据。

你可以关闭自动记录或同步、删除本地记录、退出登录。开启同步时，记录删除会在下一次成功同步时传播。退出登录保留本地记录；卸载扩展清除插件本地存储，但不会自动删除云端数据。云端重置会用重新加密的本地数据替换旧云端数据，不等于删除账号。云端数据或账号删除可联系开发者申请。

网站访问权限用于跨网站识别视频、读取相关视频信息并恢复播放位置；存储、脚本、标签页、快捷键及身份验证功能用于记录管理和可选登录。详细的数据处理和删除说明请阅读完整隐私政策。

支持与反馈：首次提交前确认数据用途，反馈文字、图片和填写的邮箱通过 HTTPS 发送至开发者配置的 Supabase 服务，供开发者阅读、排查和回复。邮箱可以留空，登录后预填，允许修改或清空；图片私有存储，不自动公开到 GitHub，不自动附带观看记录、密码或令牌。反馈独立于加密同步；提交失败时页面保留内容供重试。也可通过 https://github.com/Ankkaya/video-tracker/issues 反馈。

## Detailed description (English)

VideoTracker saves your watch progress across video sites so you can pick up where you left off. Local recording works without an account. You can also sign in and choose end-to-end encrypted cloud sync to keep records across devices.

Features

• Automatic recording: Enable automatic recording in settings to save video details and progress after your chosen viewing threshold. Automatic recording is off by default. The default threshold is 30 seconds, with 0, 10, 30, 60 and 120 seconds available.
• Manual saving: Save the current video's progress with Ctrl+Shift+V (Command+Shift+V on Mac), without waiting for the automatic threshold. You can change the shortcut in your browser's extension shortcut settings.
• Resume watching: Open a saved record to return to the video and restore your position in supported players.
• Find your records: Search titles in the popup. Filter the full records page by title, episode text and viewing date, and delete individual or selected records.
• Site exclusions: Supports Bilibili, YouTube, iQIYI and Tencent Video, plus generic detection on other compatible HTML5 video sites. Add a domain or webpage URL to the exclusion list to stop automatic recording for that domain and its subdomains while preserving saved records. Removing it restores automatic recording when the global switch is on. Manual saving still works for excluded sites. Detection and playback restoration depend on the website and player implementation.
• Optional encrypted sync: When you sign in and enable cloud sync or use manual sync, viewing records and site rules are encrypted on your device before upload. Enter your sync encryption password on another device to unlock them.
• Interface and feedback: Choose Chinese or English and a light, dark or system theme. Open the feedback page from the popup or options to send up to 500 characters, one optional PNG/JPG/WebP image up to 5 MB and an optional contact email. No sign-in is required.

Data and privacy

Viewing records are stored locally in your browser by default, and local features require no account. Registration and sign-in involve an authentication service that processes your email, account and session information. Optional sync uses the developer-configured Supabase service to store account metadata, encrypted sync data and key-related information. Your sync encryption password is not uploaded; a sync data key is remembered locally on the device.

Encryption protects the contents of synced records, but does not hide account or connection information normally processed by service providers. Loading remote video thumbnails may send your IP address and the requested image URL to the image provider, even with sync off. VideoTracker does not use advertising trackers or analytics and does not sell user data.

You can turn off automatic recording or sync, delete local records and sign out. With sync enabled, record deletions propagate on the next successful sync. Signing out preserves local records. Uninstalling clears extension-local storage but does not automatically delete cloud data. Cloud reset replaces previous cloud data with newly encrypted local data; it does not delete your account. Contact the developer to request cloud data or account deletion.

Website access supports detecting videos across sites, reading related video information and restoring playback positions. Storage, scripting, tab, shortcut and identity features support record management and optional sign-in. Read the full privacy policy for data handling and deletion details.

Support and feedback: Before the first submission, you confirm that the text, image and entered email are sent over HTTPS to the developer-configured Supabase service for the developer to read, investigate and reply. Email may be left blank; a signed-in email is prefilled but editable or removable. Images are private, with no automatic GitHub publication or attached viewing records, passwords or tokens. Feedback is separate from encrypted sync. Failed submissions retain the form contents for retry. You can also use https://github.com/Ankkaya/video-tracker/issues .

## 单一用途描述 / Single purpose

中文：保存和恢复用户在不同视频网站的观看进度，并通过可选的端到端加密同步在多设备间保持观看记录和站点规则一致。

English: Save and restore video watch progress across websites, with optional end-to-end encrypted sync of viewing records and site rules across devices.

## 权限用途说明

以下说明对应当前扩展配置。权限是否仍有冗余需单独核查；此文案不替代权限精简审查。

| 权限或功能 | 用途说明 |
| --- | --- |
| `storage` | 在浏览器本地保存观看记录、站点规则、偏好设置、登录会话和同步数据密钥。 |
| `activeTab` | 配合用户主动点击扩展或执行快捷键，访问当前页面以手动识别和保存视频进度。自动记录另依赖网站访问权限及内容脚本。 |
| `tabs` | 读取相关标签页的网址和标题，将嵌入播放器的进度关联到正确的页面，并识别登录窗口中的相关标签页。打开记录也会使用标签页 API，但创建标签页本身并非申请该权限的理由。 |
| `scripting` | 向相关页面及嵌入 frame 执行扩展内置脚本，检测视频、播放时间和播放器状态；在需要时通过页面环境中的桥接脚本读取播放器信息。 |
| `identity` | 启动用户主动选择的第三方授权登录并生成扩展回调地址，为可选云同步建立登录会话。本地记录无需登录。 |
| `commands`（Manifest 快捷键配置，无需单独权限） | 注册和查询手动保存快捷键，让用户主动保存当前视频进度。 |
| `*://*/*`（网站访问） | 通用 HTML5 视频识别需要覆盖预先无法列举的网站及嵌入播放器域名；读取相关视频标题、网址、封面信息和播放状态，并在支持的播放器中恢复进度。用户可关闭全局或单个站点的自动记录。 |

## 隐私摘要与表单参考

完整隐私政策：[PRIVACY_POLICY.md](../PRIVACY_POLICY.md)。提交时使用已公开可访问且与该文件一致的政策链接。

填写商店数据使用表单时，应覆盖实际处理的数据，不能因默认本地存储或同步内容已加密而一概声明“不处理任何数据”：

- 视频观看数据：视频网址、标题、进度、时长、观看时间、封面网址，以及站点规则、删除标记和偏好设置。
- 账号与认证数据：用户主动登录时处理的邮箱、账号标识、认证凭据和会话信息。
- 同步数据：用户选择同步时上传的加密记录、受密码保护的数据密钥、盐值和加密参数。
- 主动反馈：最多 500 字、单张不超过 5 MB 的 PNG/JPG/WebP 图片和可选邮箱；原始图片可能带元数据。首次确认后才发送，独立于加密同步，供开发者直接阅读处理。
- 网络请求：认证、同步、主动反馈和远程封面加载所需的连接信息；反馈限流及去重使用加盐 IP 哈希、请求编号、内容哈希和时间状态。同步关闭不代表完全没有网络请求。

根据后台字段核对个人身份信息、身份验证信息、网页浏览记录和网站内容等类别，并与完整隐私政策及实际功能保持一致。还应披露用户主动提交的反馈文字、图片、联系邮箱及服务端正常请求元数据；反馈内容供开发者阅读处理，不属于端到端加密的观看记录同步。

删除与保留说明：退出登录清除本地会话和同步解锁状态，保留本地记录；卸载不会自动删除云端数据；云端重置不是账号删除。云端或账号删除可通过 GitHub Issues 联系开发者申请私下联系渠道，请勿在公开 issue 中发布密码、令牌或私人观看记录。服务提供方的备份与日志可能有单独保留周期。

## 当前源码更新说明（0.0.13）

- 站点过滤改为排除名单，支持粘贴网页链接及子域名匹配；移出名单恢复自动记录，保留已有记录。
- 新增插件内反馈：最多 500 字、单张不超过 5 MB 的图片、可选邮箱，首次提交前确认用途，失败保留内容。
- 简化记录页与弹窗搜索；记录页按标题、分集信息和日期筛选，支持批量删除。
- 更新中英文布局、同步状态、快捷键说明及与当前功能一致的隐私披露。

## 商店素材

- 展示实际功能：记录管理、设置、站点排除、弹窗与反馈页。两种语言各 5 张实际 Vue 界面截图，使用虚构记录和域名；反馈截图不发出请求。
- 中英文资料分别位于 `output/chrome-store/` 和 `output/edge-store/`；文案由 `scripts/generate-store-materials.mjs` 从本文件生成，更新本文件后运行 `npm run generate:store`。
- 已有截图尺寸为 1280×800，小宣传图为 440×280，大宣传图为 1400×560。
- 商店图标可使用 `public/icon-128.png`。
- 分类选择与视频进度管理用途相符的效率工具类别，以提交后台可选项为准。

## 审核测试说明

1. 安装扩展，打开弹窗。本地记录无需注册或登录。
2. 打开支持的视频页面并开始播放，使用快捷键手动保存，确认弹窗出现记录。
3. 在设置中开启自动记录，使用默认 30 秒阈值；在视频页面观看达到阈值后检查记录更新。
4. 点击记录，确认打开视频页面并在支持的播放器中恢复播放位置。
5. 打开完整记录页，验证标题、分集及日期筛选和批量删除；打开站点过滤，加入域名或网页链接，确认该域名和子域名停止自动记录，手动保存及已有记录不受影响；移出名单后恢复自动记录。
6. 可选云同步需登录并设置同步加密密码；在另一台设备登录并使用同一同步密码解锁，验证记录同步。云同步审核所需的测试账号及操作说明应通过商店后台的测试说明字段单独提供，勿写入公开商店介绍。
7. 无需登录打开反馈页，确认 0/500、图片 0/1 和 5 MB 限制及邮箱可清空。首次提交使用无私人数据的审核测试内容：取消确认不发送，同意后成功只显示简短提示；超过字数或图片限制时阻止提交。网络失败时保留草稿，恢复后可重试。登录后邮箱预填但可修改或清空。反馈内容可被开发者阅读，不属于端到端加密同步数据。

## 官方政策参考

- Chrome 数据披露：https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements
- Chrome 隐私表单：https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Edge 开发者政策：https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies
