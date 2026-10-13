# 反馈功能

入口：选项页左侧“反馈问题”，或弹窗的反馈按钮。文字 1～500 字、一张不超过 5 MB 的 PNG/JPG/WebP 图片、可选联系邮箱。登录邮箱只用于预填，可以修改或清空。表单不显示隐私政策链接；首次提交确认弹窗提供打包的最新隐私政策。确认版本存入本地，改动数据用途时必须提升 `FEEDBACK_CONSENT_VERSION` 并同步修改服务端接受的版本。

## 部署

1. 对当前 Supabase 项目运行 `docs/supabase-feedback.sql`。只新增反馈表、限流表、三个后台专用 RPC 和 `feedback-images` 私有 bucket，不改动同步数据。
2. 部署 `supabase/functions/submit-feedback/index.ts` 及 `_shared/feedback-handler.ts`。配置见 `supabase/config.toml`。此函数在函数内部核对 Supabase 的匿名 API key，允许未登录提交；API key 是公开的，不能用作可信安装证明。
3. 函数使用平台提供的 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。前端沿用 `.env` 的 URL/anon key，任何管理密钥都不能进入扩展。
4. 执行 `npm run generate:privacy` 同步隐私政策，重新构建。更新商店描述和数据披露，覆盖用户主动提交的反馈文字、图片、邮箱和服务端请求元数据。

## 处理反馈

在 Supabase Dashboard 的 `feedback_submissions` 中筛选 `submission_state = submitted`。`status` 可设为 `new`、`reviewing`、`resolved`。图片在 `feedback-images` 私有 bucket，只有后台管理者可读取；不公开图片链接，不自动转成 GitHub issue。页面仅显示提交成功提示，反馈编号用于后台处理和请求去重。用户可通过提交时间、内容或联系邮箱协助开发者定位反馈并申请删除。

服务端校验图片魔数、MIME、文件大小、总请求大小、字数、邮箱和确认版本。客户端与数据库同时限制 500 个 Unicode 字符。每个 IP 的加盐哈希每 10 分钟最多 5 次新尝试，整个接口每小时最多 200 次，用数据库原子更新实施；限流窗口记录超过一天后在新请求中清理。IP 限流是尽力而为，不能替代全局限制；平台转发头的可信来源须在托管环境中维护。

重试沿用请求编号，内容变化生成新编号。同一编号只允许同一内容；并发请求用 3 分钟租约防止重复上传。数据库确认保存后才显示成功。连接超时/中断后保留草稿；若服务端已保存，重试返回同一编号。遇到图片已保存但数据库响应不明确的情况，保留确定性路径供重试恢复，避免误删已提交图片。

运维时查看 `processing`/`failed` 的旧记录；对于超过 24 小时且确认无需重试的记录，先从私有 bucket 删除同编号的图片，再删除反馈记录。已处理的反馈在支持和跟进用途结束后删除相应图片及记录。不要通过 SQL 直接删除 `storage.objects`，使用 Storage Dashboard/SDK 删除文件。

## 验证

`npm test` 覆盖客户端和接口边界：500 字、Unicode、邮箱清空、伪装/超大/多图片、确认版本、失败重试、去重、限流和不确定提交。部署后还应验证真实的文字提交、图片提交及匿名 API 无法读取反馈或图片。开发服务启动后保持运行。
