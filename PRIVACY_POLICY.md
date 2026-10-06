# VideoTracker Privacy Policy / 隐私政策

Last updated / 更新日期: 2026-10-06

## English

VideoTracker, published by Ankkaya, records video viewing progress so you can resume watching. Local recording works without an account. This policy covers the browser extension and its optional cloud sync.

### Data we process
We store video page URLs, titles, playback position and duration, viewing timestamps, thumbnail URLs, site rules, deletion markers and preferences in browser local storage. These are video viewing records, not a general log of all visited pages. Automatic recording can be disabled globally or per site; manual recording remains user initiated.

If you choose to register or sign in, the configured Supabase service processes your email, account identifier, authentication credentials and session information. OAuth providers such as Google or GitHub process authorization according to their own policies. Access and refresh tokens are stored locally to maintain your session. Account authentication passwords are sent to the authentication service over HTTPS; they are different from your sync encryption password.

### Optional encrypted sync
When you enable sync or use manual sync, viewing records, site rules and deletion markers are encrypted on your device before being sent to the developer-configured Supabase project. This is not a database hosted in your own Supabase account. The service stores account metadata, ciphertext, password-protected data keys, salts and encryption parameters. Your sync encryption password is not uploaded. A data key is remembered locally. Encryption protects the contents of synced records; it does not conceal account metadata or ordinary connection metadata such as IP addresses from service providers.

### Network requests and use
Data is used to record and resume videos, authenticate accounts and synchronize your data. Loading remote video thumbnails can send your IP address and requested image URL to the image host, even when sync is off. We do not use advertising trackers or analytics, sell data, or use it for unrelated profiling, creditworthiness or lending. Supabase and chosen login/image providers receive data needed for these services, not for advertising by VideoTracker.

### Control, retention and deletion
You can delete local records in the extension, disable recording or sync, and sign out. Signing out clears the remembered sync key and session but preserves local records. Uninstalling removes extension-local storage; it does not delete cloud data. With sync enabled, record deletion is propagated on the next successful sync. Cloud reset replaces the previous encrypted snapshot and key with newly encrypted local data, preserving local records; other devices need the new password. Reset is not account deletion. Cloud account metadata remains while the account exists. Contact the developer to request cloud/account deletion. Provider backups and logs may have separate retention periods; we do not promise immediate removal from them. Forgotten sync passwords cannot decrypt the old cloud snapshot.

### Permissions and security
Storage saves records/settings/session/key locally; activeTab, tabs and host access associate video state with the page; scripting detects players including embedded frames; commands enables manual recording; identity enables optional OAuth. We use HTTPS and device-side encryption for sync. No security measure guarantees absolute protection; protect your browser profile and sync password.

### Contact and changes
For questions or deletion requests, contact Ankkaya via https://github.com/Ankkaya/video-tracker/issues (do not post passwords, tokens or private viewing records in public issues). Ask for a private contact channel if necessary. Material changes will be reflected in the update date.

## 中文

VideoTracker 由 Ankkaya 发布，用于保存视频观看进度并恢复播放。本地记录无需账号。本政策适用于浏览器插件及可选云同步。

### 处理的数据
插件在浏览器本地保存视频页面网址、标题、播放位置与时长、观看时间、缩略图网址、站点规则、删除标记和偏好设置。这是视频观看记录，并非所有访问页面的完整浏览历史。可关闭全局或单个站点的自动记录；手动记录由用户主动触发。

注册或登录时，配置的 Supabase 服务处理邮箱、账号标识、认证凭据和会话信息。Google、GitHub 等 OAuth 提供方按其政策处理授权。访问令牌和刷新令牌保存在本地以维持会话。账号登录密码通过 HTTPS 发送至认证服务，与同步加密密码不同。

### 可选加密同步
开启同步或执行手动同步时，观看记录、站点规则和删除标记在设备端加密，再发送到开发者配置的 Supabase 项目，并非用户自己托管的 Supabase 数据库。服务保存账号元数据、密文、受密码保护的数据密钥、盐值与加密参数。同步加密密码不上传；设备会在本地记住数据密钥。加密保护同步记录的内容，但不隐藏账号元数据和服务提供方正常处理的 IP 地址等连接信息。

### 网络请求与用途
数据仅用于记录、恢复播放、认证和同步。加载远程视频缩略图时，即使未开启同步，图片提供方也可能收到 IP 地址及请求的图片网址。插件不使用广告追踪或分析服务，不出售数据，不用于无关画像、信用评估或借贷。Supabase 和用户选择的登录或图片服务接收提供相关功能所需的数据。

### 控制、保留与删除
可以删除本地记录、关闭记录或同步、退出登录。退出登录清除同步解锁密钥及会话，保留本地记录。卸载清除插件本地存储，不会自动删除云端数据。开启同步时，记录删除会在下一次成功同步时传播。重置云端用新密钥和重新加密的本地数据替换旧密文及密钥，不删除本地记录；其他设备需用新密码解锁。重置不等于删除账号，账号元数据会在账号存在期间保留。可联系开发者申请删除云端数据或账号。服务提供方的备份与日志可能有单独保留周期，不保证立即清除。忘记同步密码后无法解密旧云端数据。

### 权限与安全
storage 保存本地数据、设置、会话和密钥；activeTab、tabs 及网站权限关联视频与页面；scripting 识别播放器及嵌入 frame；commands 支持快捷键记录；identity 用于可选 OAuth。同步采用 HTTPS 和设备端加密。请保护浏览器配置及同步密码，任何安全措施均不能保证绝对安全。

### 联系与政策更新
可通过 https://github.com/Ankkaya/video-tracker/issues 联系 Ankkaya，咨询或申请删除。请勿在公开 issue 中发布密码、令牌或私人观看记录，需要时先申请私下联系渠道。政策变更将更新顶部日期。
